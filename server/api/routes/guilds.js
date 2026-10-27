// server/api/routes/guilds.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function guildsRouter() {
  const router = Router();
  router.use(requireAuth);

  /** GET /api/guilds — серверы бота, где пользователь админ (с presence) */
  router.get('/', requireBotAccess, async (req, res) => {
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;
    const inst = req.app.locals.botManager.get(req.bot.id);

    if (!inst?.client) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const userGuilds = new Set(db.getUserAdminGuilds(req.user.id));
    const botGuilds = db.getGuildsForBot(req.bot.id);
    const accessible = botGuilds.filter((g) => userGuilds.has(g.id));

    // ⚡ Параллельно обогащаем данными о presence через Discord API
    const enriched = await Promise.all(
      accessible.map(async (g) => {
        let online = g.online_count ?? null;
        let memberCount = g.member_count ?? 0;
        let createdAt = g.discord_created_at ?? null;

        try {
          const fetched = await inst.client.guilds.fetch({
            guild: g.id,
            withCounts: true,
            force: true,
          });
          if (fetched) {
            online = fetched.approximatePresenceCount ?? online;
            memberCount = fetched.memberCount ?? memberCount;
            if (!createdAt && fetched.createdTimestamp) {
              createdAt = Math.floor(fetched.createdTimestamp / 1000);
            }
            // Обновляем кеш в БД (только presence и memberCount)
            if (online !== g.online_count || memberCount !== g.member_count) {
              db.upsertGuild({
                id: g.id,
                bot_id: g.bot_id,
                name: g.name,
                icon: g.icon,
                owner_id: g.owner_id,
                member_count: memberCount,
                discord_created_at: createdAt,
                online_count: online,
              });
            }
          }
        } catch (err) {
          logger.warn(
            { err, guildId: g.id, botId: req.bot.id },
            'failed to fetch guild presence',
          );
        }

        return {
          id: g.id,
          name: g.name,
          icon: g.icon,
          memberCount,
          online,
          createdAt,
        };
      }),
    );

    logger.info(
      {
        userId: req.user.id,
        botId: req.bot.id,
        accessibleCount: enriched.length,
      },
      'GET /api/guilds',
    );

    res.json(enriched);
  });

  /** GET /api/guilds/roles — роли сервера */
  router.get('/roles', requireBotAccess, async (req, res) => {
    const inst = req.app.locals.botManager.get(req.bot.id);
    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });

    try {
      const guild = inst.client.guilds.cache.get(req.query.guildId)
        || await inst.client.guilds.fetch(req.query.guildId);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      await guild.roles.fetch();
      const roles = [...guild.roles.cache.values()]
        .filter((r) => r.name !== '@everyone' && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.hexColor === '#000000' ? null : r.hexColor,
          position: r.position,
          memberCount: r.members.size,
        }));

      res.json(roles);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'failed to fetch roles');
      res.status(500).json({ error: 'roles_fetch_failed' });
    }
  });

  return router;
}