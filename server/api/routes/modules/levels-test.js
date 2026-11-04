// server/api/routes/modules/levels-test.js
//
// POST /api/modules/levels/test — отправка тестового сообщения уровней.
// (URL через alias: /api/levels/test тоже работает)

import { Router } from 'express';
import { validateBody } from '../../validate.js';
import { levelsTestBody } from '../../../validators/schemas.js';
import { testMessageLimiter } from '../../middleware/rate-limit.js';
import { audit } from '../../_audit.js';
import { getNonBotMemberCount } from '../../../core/guildCounts.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../../core/v2-to-embed.js';

export function createLevelsTestRouter() {
  const router = Router();

  router.post('/test', testMessageLimiter, validateBody(levelsTestBody), async (req, res) => {
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

    const tokens = {
      user: `<@${user.id}>`, mention: `<@${user.id}>`,
      username: user.username, displayName, avatarUrl,
      guild: guild.name, count,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      section: 'levels',
      level: 10, oldLevel: 9, title: 'Легенда',
      xp: 1100, nextLevelXp: 1500, xpToNext: 400,
      progress: '680 / 1100', progressPercent: 62,
      position: 42, rank: 42,
      rewardRole: '',
      xpGained: 150, newXp: 1250, newLevel: 10,
      nextDailyAt: `<t:${now + 86_400}:R>`,
      topUsers:
        '🥇 <@' + user.id + '> — **1200 XP** · Ур. 12 · Легенда\n' +
        '🥈 <@' + user.id + '> — **980 XP** · Ур. 10\n' +
        '🥉 <@' + user.id + '> — **750 XP** · Ур. 9',
      topCount: 42,
    };

    try {
      if (which === 'levelUp') {
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

      const embed = v2ConfigToEmbed(messageConfig, tokens);
      if (!embedHasContent(embed)) return res.status(400).json({ error: 'empty_message' });

      const msg = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      audit(req, 'levels.test', channelId, { which: which || 'unknown' });
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'levels test failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}