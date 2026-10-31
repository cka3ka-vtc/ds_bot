// server/api/routes/levels.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import { levelsTestBody } from '../../validators/schemas.js';
import { testMessageLimiter } from '../middleware/rate-limit.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../core/v2-to-embed.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../shared/titles.js';

function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

export function levelsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/leaderboard', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 10);
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const db = req.app.locals.db;
    const rows = db.getLeaderboard(botId, guildId, limit, offset);
    const total = db.countLeaderboard(botId, guildId);
    res.json({
      items: rows.map((r, i) => ({
        userId: r.user_id, xp: r.xp, level: r.level, rank: offset + i + 1,
      })),
      total, limit, offset,
    });
  });

  router.get('/member/:userId', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const { userId } = req.params;
    const db = req.app.locals.db;

    const data = db.getMemberData(botId, guildId, userId) || { xp: 0, level: 0 };
    const rank = db.getUserRank(botId, guildId, userId);
    const cfg = db.getModuleConfig(botId, guildId, 'levels');
    const config = cfg?.config || {};
    const formula = config.formula === 'linear' ? 'linear' : 'classic';
    const titles = config.titles || DEFAULT_TITLES;

    const progress = progressOf(data.xp, data.level, formula, config);
    res.json({
      userId,
      xp: data.xp,
      level: data.level,
      title: getTitleForLevel(data.level, titles),
      rank,
      progress: {
        current: progress.current,
        total: progress.total,
        percent: progress.percent,
        toNext: progress.toNext,
      },
      nextLevelXp: xpForLevel(data.level + 1, formula, config),
    });
  });

  router.post('/inactivity/run', requireBotAccess, async (req, res) => {
    const registry = req.app.locals.registry;
    const levelsMod = registry?.get?.('levels');
    if (!levelsMod?._inactivityTick) return res.status(503).json({ error: 'module_not_loaded' });

    try {
      await levelsMod._inactivityTick();
      audit(req, 'levels.inactivity.run', null);
      res.json({ ok: true });
    } catch (err) {
      req.app.locals.logger.warn({ err }, 'inactivity manual run failed');
      res.status(500).json({ error: 'failed' });
    }
  });

  /**
   * Тест сообщения.
   *
   * `which`:
   *   - `levelUp`      → channel.send с FLAG_COMPONENTS_V2 (как реальный анонс)
   *   - `rank`         → channel.send с embeds (как реальный /rank)
   *   - `leaderboard`  → channel.send с embeds (как реальный /leaderboard)
   *   - `daily`        → channel.send с embeds (как реальный /daily)
   *
   * ВАЖНО: `<t:...>` в Components V2 Text Display НЕ рендерится Discord'ом —
   * показывается как raw строка. В embed description/footer — рендерится.
   * Поэтому для rank/leaderboard/daily тест обязан идти через embed.
   */
  router.post('/test', testMessageLimiter, validateBody(levelsTestBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, channelId, messageConfig, which } = req.body;

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'invalid_channel' });

    const channel = await inst.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.() || channel.guild.id !== guildId) {
      return res.status(400).json({ error: 'invalid_channel' });
    }

    const user = req.user;
    let displayName = user.username;
    let avatarUrl = '';
    try {
      const m = await guild.members.fetch(user.id);
      displayName = m.displayName || user.username;
      avatarUrl = m.user.displayAvatarURL?.({ size: 128 }) || '';
    } catch {
      if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
      }
    }

    const count = await getNonBotMemberCount(guild);
    const now = Math.floor(Date.now() / 1000);

    // Полный набор токенов — используется всеми табами.
    const tokens = {
      user: `<@${user.id}>`, mention: `<@${user.id}>`,
      username: user.username, displayName, avatarUrl,
      guild: guild.name, count,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      section: 'levels',
      // levelUp / rank
      level: 10, oldLevel: 9, title: 'Активист',
      xp: 1100, nextLevelXp: 1500, xpToNext: 400,
      progress: '680 / 1100', progressPercent: 62,
      position: 42, rank: 42,
      rewardRole: '',
      // daily
      xpGained: 150, newXp: 1250, newLevel: 10,
      nextDailyAt: `<t:${now + 86_400}:R>`,
      // leaderboard
      topUsers:
        '🥇 <@' + user.id + '> — **1200 XP** · Ур. 12 · Активист\n' +
        '🥈 <@' + user.id + '> — **980 XP** · Ур. 10\n' +
        '🥉 <@' + user.id + '> — **750 XP** · Ур. 9',
      topCount: 42,
    };

    try {
      if (which === 'levelUp') {
        // Реальный анонс в announce-канал использует V2 → тест тоже V2.
        const components = buildComponentsFromConfig(messageConfig, tokens);
        if (!components?.length) return res.status(400).json({ error: 'empty_message' });

        const msg = await channel.send({
          flags: FLAG_COMPONENTS_V2,
          components,
          allowedMentions: { parse: [] },
        });
        audit(req, 'levels.test', channelId, { which });
        return res.json({ ok: true, messageId: msg.id });
      }

      // rank / leaderboard / daily → как реальные команды, embed.
      const embed = v2ConfigToEmbed(messageConfig, tokens);
      if (!embedHasContent(embed)) {
        return res.status(400).json({ error: 'empty_message' });
      }

      const msg = await channel.send({
        embeds: [embed],
        allowedMentions: { parse: [] },
      });
      audit(req, 'levels.test', channelId, { which: which || 'unknown' });
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'levels test failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}