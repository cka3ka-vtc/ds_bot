// server/api/routes/levels.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../shared/titles.js';

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

  router.post('/member/:userId/adjust', requireBotAccess, async (req, res) => {
    const { botId, guildId, delta } = req.body || {};
    const { userId } = req.params;
    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const me = guild.members.me;
    if (!me?.permissions.has('Administrator')) {
      return res.status(403).json({ error: 'not_admin' });
    }

    const numDelta = parseInt(delta, 10);
    if (!Number.isFinite(numDelta) || numDelta === 0) {
      return res.status(400).json({ error: 'invalid_delta' });
    }

    const member = guild.members.cache.get(userId);
    if (!member) return res.status(404).json({ error: 'member_not_found' });

    const cfg = db.getModuleConfig(botId, guildId, 'levels');
    const config = cfg?.config || {};
    const formula = config.formula === 'linear' ? 'linear' : 'classic';
    const maxLevel = config.maxLevel || 100;
    const maxXp = xpForLevel(maxLevel, formula, config);

    const data = db.getMemberData(botId, guildId, userId) || { xp: 0, level: 0, auto_roles: '[]' };
    const newXp = Math.max(0, Math.min(maxXp, (data.xp | 0) + numDelta));
    const newLevel = xpForLevelLevel(newXp, formula, config, maxLevel);

    res.json({ ok: true, xp: newXp, level: newLevel });
  });

  router.post('/inactivity/run', requireBotAccess, async (req, res) => {
    const registry = req.app.locals.registry;
    const levelsMod = registry?.get?.('levels');
    if (!levelsMod?._inactivityTick) return res.status(503).json({ error: 'module_not_loaded' });

    try {
      await levelsMod._inactivityTick();
      res.json({ ok: true });
    } catch (err) {
      req.app.locals.logger.warn({ err }, 'inactivity manual run failed');
      res.status(500).json({ error: 'failed' });
    }
  });

  router.post('/test', requireBotAccess, async (req, res) => {
    const { botId, guildId, channelId, messageConfig } = req.body || {};
    if (!channelId) return res.status(400).json({ error: 'no_channel' });
    if (!messageConfig) return res.status(400).json({ error: 'no_message' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const channel = await inst.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return res.status(400).json({ error: 'invalid_channel' });

    const user = req.user;
    let displayName = user.username, avatarUrl = '';
    try {
      const m = await channel.guild.members.fetch(user.id);
      displayName = m.displayName || user.username;
      avatarUrl = m.user.displayAvatarURL?.({ size: 128 }) || '';
    } catch {
      if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
      }
    }

    const count = await getNonBotMemberCount(channel.guild);
    const tokens = {
      user: `<@${user.id}>`, mention: `<@${user.id}>`,
      username: user.username, displayName, avatarUrl,
      guild: channel.guild.name, count,
      guildIconUrl: channel.guild.iconURL?.({ size: 128 }) || '',
      section: 'levels',
      level: 10, oldLevel: 9, title: 'Активист',
      xp: 1100, nextLevelXp: 1500, xpToNext: 400,
      progress: '680 / 1100', progressPercent: 62,
      position: 42, rank: 42,
      rewardRole: '',
    };

    let components;
    try { components = buildComponentsFromConfig(messageConfig, tokens); }
    catch { return res.status(500).json({ error: 'build_failed' }); }
    if (!components?.length) return res.status(400).json({ error: 'empty_message' });

    try {
      const msg = await channel.send({
        flags: FLAG_COMPONENTS_V2, components,
        allowedMentions: { parse: [] },
      });
      res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}

// хелпер для adjust (внутренний)
function xpForLevelLevel(xp, formula, opts, maxLevel) {
  const { getLevelFromXp } = require('../../core/formulas.js');
  return getLevelFromXp(xp, formula, opts, maxLevel);
}