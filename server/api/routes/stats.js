// server/api/routes/stats.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function statsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;

    // TZ клиента в минутах (МСК = 180, UTC−5 = -300).
    const tz = parseInt(req.query.tz, 10) || 0;

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const now = Math.floor(Date.now() / 1000);
    const since7d  = now - 7 * 24 * 60 * 60;
    const since14d = now - 14 * 24 * 60 * 60;

    // KPI
    const totalMembers = guild.memberCount;
    const newMembers = db.countEvents(botId, guildId, 'member_join', since7d);
    const leftMembers = db.countEvents(botId, guildId, 'member_leave', since7d);
    const activeUsers = db.countUniqueUsers(botId, guildId, since7d);

    // Chart
    const messagesByDay = db.getEventsByDay(botId, guildId, 'message',    since14d, tz);
    const commandsByDay = db.getEventsByDay(botId, guildId, 'command',    since14d, tz);
    const voiceByDay    = db.getEventsByDay(botId, guildId, 'voice_join', since14d, tz);

    // Top commands
    const topCommands = db.getTopCommands(botId, guildId, since7d, 5);

    // Top channels (раздельно по типу)
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

    // Recent events
    const recentEvents = db.getRecentActivity(botId, guildId, 5);

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
    });
  });

  return router;
}