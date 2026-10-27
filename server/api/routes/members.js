// server/api/routes/members.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function membersRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client) return res.status(404).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    try { await guild.members.fetch(); } catch {}

    // ⚡ ИСПРАВЛЕНО: читаем исключённые роли
    const settings = db.getGuildSettings(botId, guildId);
    const excludedRoles = new Set(settings.excluded_roles || []);

    const dbExtra = new Map(
      db.getAllMembersData(botId, guildId).map((m) => [m.user_id, m]),
    );

    const members = guild.members.cache
      // исключаем ботов
      .filter((m) => !m.user.bot)
      // исключаем участников с любой из исключённых ролей
      .filter((m) => !m.roles.cache.some((r) => excludedRoles.has(r.id)))
      .map((m) => {
        const extra = dbExtra.get(m.id) || {};
        const roleList = m.roles.cache
          .filter((r) => r.name !== '@everyone')
          .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          id: m.id,
          username: m.user.username,
          displayName: m.displayName,
          avatar: m.user.displayAvatarURL({ size: 128 }),
          isBot: false,
          joinedAt: m.joinedTimestamp,
          roles: roleList,
          level: extra.level || 0,
          xp: extra.xp || 0,
          warnings: extra.warnings || 0,
        };
      });

    res.json(members);
  });

  router.put('/:userId', requireBotAccess, (req, res) => {
    const { botId, guildId, level, warnings } = req.body;
    req.app.locals.db.upsertMemberData(botId, guildId, req.params.userId, { level, warnings });
    res.json({ ok: true });
  });

  return router;
}