// server/api/routes/stats.js
// Сводная статистика и графики. Списки участников — в stats-members.js.

import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

function daysUntilBirthday(ddmm) {
  const [d, m] = ddmm.split('.').map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function statsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const tz = parseInt(req.query.tz, 10) || 0;

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const { getNonBotMemberCount } = await import('../../core/guildCounts.js');
    const totalMembers = await getNonBotMemberCount(guild);

    const now = Math.floor(Date.now() / 1000);
    const since7d  = now - 7 * 24 * 60 * 60;
    const since14d = now - 14 * 24 * 60 * 60;

    const newMembers   = db.countEvents(botId, guildId, 'member_join', since7d);
    const leftMembers  = db.countEvents(botId, guildId, 'member_leave', since7d);
    const activeUsers  = db.countUniqueUsers(botId, guildId, since7d);

    const messagesByDay = db.getEventsByDay(botId, guildId, 'message',    since14d, tz);
    const commandsByDay = db.getEventsByDay(botId, guildId, 'command',    since14d, tz);
    const voiceByDay    = db.getEventsByDay(botId, guildId, 'voice_join', since14d, tz);

    const topCommands = db.getTopCommands(botId, guildId, since7d, 5);

    const enrich = (arr) => arr.map((ch) => {
      const channel = guild.channels.cache.get(ch.channel_id);
      return {
        channelId: ch.channel_id,
        name: channel?.name || 'unknown',
        count: ch.count,
      };
    });

    const topChannels = {
      text:  enrich(db.getTopChannels(botId, guildId, 'message',    since7d, 5)),
      voice: enrich(db.getTopChannels(botId, guildId, 'voice_join', since7d, 5)),
    };

    const recentEvents = db.getRecentActivity(botId, guildId, 30);

    const enabled = db.getEnabledModules(botId, guildId);
    const enabledSet = new Set(enabled);
    const modulesEnabled = {
      levels: enabledSet.has('levels'),
      birthdays: enabledSet.has('birthdays'),
    };

    // Дашборд показывает всех с ДР, включая отключивших (для пометки).
    let upcomingBirthdays = [];
    if (modulesEnabled.birthdays) {
      const rows = db.getUpcomingBirthdays(botId, guildId, false);
      upcomingBirthdays = rows
        .map((r) => ({
          userId: r.user_id,
          username: r.username || null,
          displayName: r.display_name || r.username || null,
          avatarUrl: r.avatar_url || null,
          birthday: r.birthday,
          birthdayYear: r.birthday_year || null,
          birthdayPublic: !!r.birthday_public,
          daysLeft: daysUntilBirthday(r.birthday),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 5);
    }

    res.json({
      totalMembers,
      newMembers,
      leftMembers,
      activeUsers,
      chart: { messagesByDay, commandsByDay, voiceByDay },
      topCommands,
      topChannels,
      recentEvents,
      updatedAt: now,
      modulesEnabled,
      upcomingBirthdays,
    });
  });

  return router;
}