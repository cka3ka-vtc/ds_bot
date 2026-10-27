// server/api/routes/stats.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function statsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const now = Math.floor(Date.now() / 1000);
    const since24h = now - 24 * 60 * 60;
    const since7d = now - 7 * 24 * 60 * 60;
    const since14d = now - 14 * 24 * 60 * 60;

    // ── KPI ───────────────────────────────────────
    const totalMembers = guild.memberCount;
    const newMembers = db.countEvents(botId, guildId, 'member_join', since7d);
    const leftMembers = db.countEvents(botId, guildId, 'member_leave', since7d);
    const activeUsers = db.countUniqueUsers(botId, guildId, since7d);

    // ── Chart ─────────────────────────────────────
    const messagesByDay = db.getEventsByDay(botId, guildId, 'message', since14d);
    const commandsByDay = db.getEventsByDay(botId, guildId, 'command', since14d);
    const voiceByDay    = db.getEventsByDay(botId, guildId, 'voice_join', since14d);

    // ── Топ команд ────────────────────────────────
    const topCommands = db.getTopCommands(botId, guildId, since7d, 5);

    // ── События ───────────────────────────────────
    const recentEvents = db.getRecentActivity(botId, guildId, 5);

    // ── Health ────────────────────────────────────
    const mem = process.memoryUsage();
    const uptimeSec = Math.round(process.uptime());
    const errors24h = db.countLogsByLevel(botId, guildId, 'error', since24h);
    const rateLimitHits = inst.rateLimitHits || 0;

    const health = {
      latency: Math.round(inst.client.ws.ping) || 0,
      uptimeSeconds: uptimeSec,
      uptimePct: 99.9,
      errors24h,
      memoryUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      memoryPct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      discordApiPct: rateLimitHits === 0 ? 100 : Math.max(0, 100 - rateLimitHits * 2),
      rateLimitHits,
    };

    res.json({
      totalMembers, newMembers, leftMembers, activeUsers,
      chart: { messagesByDay, commandsByDay, voiceByDay },
      topCommands, recentEvents, health,
      updatedAt: now,
    });
  });

  return router;
}