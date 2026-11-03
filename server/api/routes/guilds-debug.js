// server/api/routes/guilds-debug.js
import { Router } from 'express';
import { requireAuth } from '../auth-middleware.js';
import { config } from '../../config.js';
import { checkMemberAdminVerbose } from '../../core/guild-access.js';

export function guildsDebugRouter() {
  const router = Router();

  // В production отключён
  if (config.NODE_ENV !== 'development') {
    router.use((req, res) => res.status(404).json({ error: 'not_found' }));
    return router;
  }

  router.use(requireAuth);

  router.get('/', async (req, res) => {
    try {
      const botId = req.query.botId || null;
      if (!botId) return res.status(400).json({ error: 'botId_required' });

      const db = req.app.locals.db;
      const botManager = req.app.locals.botManager;
      const inst = botManager.get(botId);
      const userId = String(req.user.id);
      const user = db.getUser(userId);

      const botReady = !!inst?.client?.isReady?.();
      const cacheSizeBefore = inst?.client?.guilds?.cache?.size ?? 0;

      let cacheSizeAfter = cacheSizeBefore;
      let fetchOk = false;
      let fetchError = null;
      let cacheList = [];
      if (inst?.client) {
        try {
          await inst.client.guilds.fetch();
          fetchOk = true;
          cacheSizeAfter = inst.client.guilds.cache.size;
        } catch (err) { fetchError = err.message; }

        cacheList = [...inst.client.guilds.cache.values()].map((g) => ({
          id: g.id, name: g.name, ownerId: g.ownerId,
          memberCount: g.memberCount,
          approximatePresenceCount: g.approximatePresenceCount ?? null,
          createdTimestamp: g.createdTimestamp,
        }));
      }

      const forceFetchReport = [];
      if (botReady) {
        await Promise.all([...inst.client.guilds.cache.values()].map(async (g) => {
          try {
            const f = await inst.client.guilds.fetch({
              guild: g.id, withCounts: true, force: true,
            });
            forceFetchReport.push({
              id: g.id, name: f.name,
              memberCount: f.memberCount,
              approximatePresenceCount: f.approximatePresenceCount ?? null,
              ownerId: f.ownerId,
            });
          } catch (err) {
            forceFetchReport.push({ id: g.id, error: err.message });
          }
        }));
      }

      const dbGuilds = db.getGuildsForBot(botId).map((g) => ({
        id: g.id, name: g.name, owner_id: g.owner_id,
        member_count: g.member_count, online_count: g.online_count,
        updated_at: g.updated_at,
      }));

      const userGuildRows = db.raw
        .prepare('SELECT guild_id, permissions FROM user_guilds WHERE user_id = ?')
        .all(userId);
      const userGuildSet = new Set(userGuildRows.map((r) => r.guild_id));

      const allGuildIds = new Set([
        ...cacheList.map((g) => g.id),
        ...dbGuilds.map((g) => g.id),
      ]);

      const accessReport = [];
      await Promise.all([...allGuildIds].map(async (gid) => {
        const inCache = cacheList.find((g) => g.id === gid) || null;
        const inDb = dbGuilds.find((g) => g.id === gid) || null;
        const bySnapshot = userGuildSet.has(gid);
        const ownerId = inCache?.ownerId ?? inDb?.owner_id ?? null;
        const byOwner = ownerId != null && String(ownerId) === userId;

        let byPermissions = false;
        let memberInfo = null;
        if (!bySnapshot && !byOwner && botReady) {
          // ФИКС: переиспользуем core/guild-access.checkMemberAdminVerbose
          // вместо локальной копии.
          const r = await checkMemberAdminVerbose(inst, gid, userId);
          byPermissions = r.value;
          memberInfo = r.member;
        }

        accessReport.push({
          guildId: gid,
          name: inCache?.name ?? inDb?.name ?? '?',
          inCache: !!inCache, inDb: !!inDb,
          ownerId, bySnapshot, byOwner, byPermissions,
          userIsOwner: byOwner,
          dbHasAccess: db.userHasGuildAccess(userId, gid),
          wouldBeShown: bySnapshot || byOwner || byPermissions,
          memberPermissionsCheck: memberInfo,
        });
      }));

      res.json({
        user: { id: userId, username: user?.username || null },
        bot: {
          id: botId, ready: botReady,
          cacheSizeBefore, cacheSizeAfter, fetchOk, fetchError,
          cache: cacheList,
          forceFetchWithCounts: forceFetchReport,
        },
        db: {
          guilds: dbGuilds,
          userGuildsSnapshot: userGuildRows.map((r) => ({
            guildId: r.guild_id, permissions: r.permissions,
          })),
        },
        accessReport,
        summary: {
          totalInCache: cacheList.length,
          totalInDb: dbGuilds.length,
          totalUnique: allGuildIds.size,
          accessibleCount: accessReport.filter((r) => r.wouldBeShown).length,
          droppedCount: accessReport.filter((r) => !r.wouldBeShown).length,
        },
      });
    } catch (err) {
      req.app.locals.logger.error({ err }, 'guilds-debug failed');
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  return router;
}