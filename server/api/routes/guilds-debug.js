// server/api/routes/guilds-debug.js
import { Router } from 'express';
import { requireAuth } from '../auth-middleware.js';
import { config } from '../../config.js';

async function checkMemberAdmin(inst, guildId, userId) {
  if (!inst?.client?.isReady?.()) return { value: false, member: null };
  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return { value: false, member: null };

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    }
    if (!member) return { value: false, member: null };

    return {
      value: !!(member.permissions?.has?.('Administrator')
             || member.permissions?.has?.('ManageGuild')),
      member: {
        hasAdministrator: member.permissions?.has?.('Administrator') || false,
        hasManageGuild: member.permissions?.has?.('ManageGuild') || false,
        hasManageRoles: member.permissions?.has?.('ManageRoles') || false,
        hasManageChannels: member.permissions?.has?.('ManageChannels') || false,
        permissionsBitfield: member.permissions?.bitfield?.toString?.() || null,
        roles: member.roles?.cache ? [...member.roles.cache.values()]
          .filter((r) => r.name !== '@everyone')
          .map((r) => ({ id: r.id, name: r.name, permissions: r.permissions?.bitfield?.toString?.() || '0' }))
          : [],
      },
    };
  } catch (err) {
    return { value: false, member: { error: err.message } };
  }
}

export function guildsDebugRouter() {
  const router = Router();

  // В production эндпоинт недоступен
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

      const botRunning = !!inst;
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
          presencesCacheSize: g.presences?.cache?.size ?? null,
          createdTimestamp: g.createdTimestamp,
        }));
      }

      const forceFetchReport = [];
      if (inst?.client?.isReady?.()) {
        await Promise.all([...inst.client.guilds.cache.values()].map(async (g) => {
          try {
            const f = await inst.client.guilds.fetch({
              guild: g.id, withCounts: true, force: true,
            });
            forceFetchReport.push({
              id: g.id, name: f.name,
              memberCount: f.memberCount,
              approximatePresenceCount: f.approximatePresenceCount ?? null,
              presencesCacheSize: f.presences?.cache?.size ?? null,
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
        if (!bySnapshot && !byOwner && inst?.client?.isReady?.()) {
          const r = await checkMemberAdmin(inst, gid, userId);
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
          id: botId, running: botRunning, ready: botReady,
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