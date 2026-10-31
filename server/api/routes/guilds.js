// server/api/routes/guilds.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { runWithConcurrency } from '../../core/concurrency.js';

/**
 * Локальный кэш approximate_presence_count.
 * Discord обновляет approximate_presence_count на своём backend'е редко
 * (~раз в 10 минут), поэтому чаще, чем раз в 5 минут, дёргать REST смысла нет —
 * только зря расходуем rate-limit бота.
 *
 * Ключ — guildId, значение — { value: number|null, ts: number }.
 */
const presenceCache = new Map();
const PRESENCE_CACHE_TTL = 5 * 60_000;

/**
 * Возвращает approximate_presence_count для гайлда.
 *  - если в кэше свежо → возвращаем;
 *  - если протухло → REST fetch withCounts:true (force:true),
 *    который заодно патчит guild-объект в discord.js кэше;
 *  - если fetch упал → fallback на существующее значение.
 */
async function ensurePresenceCount(inst, guild, logger) {
  if (!guild) return null;

  const cached = presenceCache.get(guild.id);
  const now = Date.now();
  if (cached && now - cached.ts < PRESENCE_CACHE_TTL) {
    return cached.value;
  }

  if (!inst?.client?.isReady?.()) {
    const fallback = typeof guild.approximatePresenceCount === 'number'
      ? guild.approximatePresenceCount
      : null;
    presenceCache.set(guild.id, { value: fallback, ts: now });
    return fallback;
  }

  try {
    const fetched = await inst.client.guilds.fetch({
      guild: guild.id, withCounts: true, force: true,
    });
    const value = typeof fetched?.approximatePresenceCount === 'number'
      ? fetched.approximatePresenceCount
      : null;
    presenceCache.set(guild.id, { value, ts: now });
    return value;
  } catch (err) {
    logger?.warn({ err, guildId: guild.id }, 'guilds: presence fetch failed');
    const fallback = typeof guild.approximatePresenceCount === 'number'
      ? guild.approximatePresenceCount
      : null;
    presenceCache.set(guild.id, { value: fallback, ts: now });
    return fallback;
  }
}

/**
 * non-bot online = approximate_presence_count − (memberCount − nonBotMemberCount).
 * Точность: Discord считает approximate_presence_count как число ВСЕХ
 * участников с presence (вкл. ботов). Вычитаем всех ботов — это даёт
 * нижнюю границу «онлайн без ботов» (боты обычно онлайн, погрешность мала).
 */
function computeApproxOnline(guild, nonBotMemberCount, presenceCount) {
  if (presenceCount == null) return null;
  const total = guild.memberCount ?? 0;
  const bots = Math.max(0, total - nonBotMemberCount);
  return Math.max(0, presenceCount - bots);
}

/**
 * Кэш проверки «member is admin/manage_guild» на гильдии.
 * TTL 2 мин — компромисс: слишком короткий бьёт по Discord API,
 * слишком длинный — задерживает отзыв прав.
 */
const adminCache = new Map();
const ADMIN_TTL = 2 * 60_000;

async function checkMemberAdmin(inst, guildId, userId) {
  const key = `${inst.id}:${guildId}:${userId}`;
  const now = Date.now();
  const c = adminCache.get(key);
  if (c && now - c.ts < ADMIN_TTL) return c.value;

  if (!inst?.client?.isReady?.()) return false;
  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) { adminCache.set(key, { value: false, ts: now }); return false; }
    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    }
    const value = !!(member?.permissions?.has?.('Administrator')
                  || member?.permissions?.has?.('ManageGuild'));
    adminCache.set(key, { value, ts: now });
    return value;
  } catch {
    adminCache.set(key, { value: false, ts: now });
    return false;
  }
}

/**
 * Concurrency для REST-запросов к Discord. При 50+ гильдиях параллельные
 * fetch'и без лимита дают 429 (Discord rate-limit ~50 req/sec, но с
 * учётом presence-фетчей и members-фетчей внутри одного гильда —
 * реальный burst выше). 5 одновременных — безопасно.
 */
const GUILDS_FETCH_CONCURRENCY = 5;

export function guildsRouter() {
  const router = Router();
  router.use(requireAuth);

  /* ═══════════════════ GET /api/guilds ═══════════════════ */
  router.get('/', requireBotAccess, async (req, res) => {
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;
    const inst = req.app.locals.botManager.get(req.bot.id);

    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });

    const isReady = !!inst.client.isReady?.();
    if (isReady && inst.client.guilds.cache.size === 0) {
      try { await inst.client.guilds.fetch(); }
      catch (err) { logger.warn({ err }, 'guilds: initial fetch failed'); }
    }

    /* ── Собираем кандидатов: live-кэш или БД ── */
    let candidateGuilds;
    if (isReady) {
      candidateGuilds = [...inst.client.guilds.cache.values()].map((g) => ({
        id: g.id, name: g.name, icon: g.icon,
        owner_id: g.ownerId, member_count: g.memberCount,
        bot_id: req.bot.id,
        discord_created_at: g.createdTimestamp ? Math.floor(g.createdTimestamp / 1000) : null,
        online_count: g.approximatePresenceCount ?? null,
        _live: g,
      }));
    } else {
      candidateGuilds = db.getGuildsForBot(req.bot.id);
    }

    /* ── Fetch с concurrency-limit ── */
    const fetchedMap = new Map();
    await runWithConcurrency(candidateGuilds, GUILDS_FETCH_CONCURRENCY, async (g) => {
      let fetched = null;
      try {
        if (isReady) {
          fetched = await inst.client.guilds.fetch({ guild: g.id, withCounts: true, force: false });
        }
      } catch (err) {
        logger.warn({ err, guildId: g.id }, 'guilds: fetch failed');
      }
      if (!fetched) fetched = g._live || null;
      fetchedMap.set(g.id, fetched);

      if (fetched) {
        try {
          db.upsertGuild({
            id: g.id, bot_id: req.bot.id,
            name: fetched.name ?? g.name, icon: fetched.icon ?? g.icon,
            owner_id: fetched.ownerId ?? g.owner_id ?? null,
            member_count: fetched.memberCount ?? g.member_count ?? null,
            discord_created_at: fetched.createdTimestamp
              ? Math.floor(fetched.createdTimestamp / 1000)
              : (g.discord_created_at ?? null),
            online_count: fetched.approximatePresenceCount ?? g.online_count ?? null,
          });
        } catch (err) {
          logger.debug({ err, guildId: g.id }, 'guilds: upsertGuild failed');
        }
      }
    });

    const userGuilds = new Set(db.getUserAdminGuilds(req.user.id));
    const userId = String(req.user.id);

    /* ── Проверка доступа с concurrency-limit ── */
    const accessible = [];
    const dropped = [];
    await runWithConcurrency(candidateGuilds, GUILDS_FETCH_CONCURRENCY, async (g) => {
      const fetched = fetchedMap.get(g.id);
      const ownerId = fetched?.ownerId ?? g.owner_id ?? null;
      const bySnapshot = userGuilds.has(g.id);
      const byOwner = ownerId != null && String(ownerId) === userId;

      let byPermissions = false;
      if (!bySnapshot && !byOwner) {
        byPermissions = await checkMemberAdmin(inst, g.id, userId);
      }

      if (bySnapshot || byOwner || byPermissions) {
        accessible.push({
          ...g,
          _live: fetched,
          _accessVia: bySnapshot ? 'snapshot' : byOwner ? 'owner' : 'permissions',
        });
      } else {
        dropped.push({ id: g.id, name: g.name, owner_id: ownerId });
      }
    });

    logger.info({
      userId, botId: req.bot.id, isReady,
      candidates: candidateGuilds.length,
      accessible: accessible.length,
      accessVia: accessible.map((g) => ({ id: g.id, via: g._accessVia })),
      dropped,
    }, 'guilds: list');

    /* ── Обогащение с concurrency-limit ── */
    const enrichedRaw = await runWithConcurrency(
      accessible,
      GUILDS_FETCH_CONCURRENCY,
      async (g) => {
        let memberCount = 0;
        let createdAt = null;
        let nonBotMemberCount = 0;
        let presenceCount = null;
        let nonBotOnline = null;

        try {
          const liveGuild = g._live;
          if (liveGuild) {
            memberCount = liveGuild.memberCount ?? 0;
            if (liveGuild.createdTimestamp) {
              createdAt = Math.floor(liveGuild.createdTimestamp / 1000);
            }
            nonBotMemberCount = await getNonBotMemberCount(liveGuild, { timeout: 3000 });
            presenceCount = await ensurePresenceCount(inst, liveGuild, logger);
            nonBotOnline = computeApproxOnline(liveGuild, nonBotMemberCount, presenceCount);
          }
        } catch (err) {
          logger.warn({ err, guildId: g.id }, 'failed to enrich guild');
        }

        return {
          id: g.id, name: g.name, icon: g.icon,
          memberCount, nonBotMemberCount,
          online: presenceCount, nonBotOnline,
          createdAt,
          accessVia: g._accessVia,
        };
      },
    );

    const enriched = enrichedRaw
      .filter((x) => x && !x.__error)
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

    res.json(enriched);
  });

  /* ═══════════════════ DELETE /api/guilds/:guildId/data ═══════════════════ */
  router.delete('/:guildId/data', async (req, res) => {
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;
    const botId = req.query.botId;
    const guildId = req.params.guildId;

    if (!botId) return res.status(400).json({ error: 'botId_required' });

    const bot = db.getBot(botId);
    if (!bot) return res.status(404).json({ error: 'bot_not_found' });
    if (!bot.is_main && bot.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'access_denied' });
    }

    const guild = db.getGuild(botId, guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const userId = String(req.user.id);
    let hasAccess = db.userHasGuildAccess(userId, guildId);

    if (!hasAccess && guild.owner_id != null && String(guild.owner_id) === userId) {
      hasAccess = true;
    }
    if (!hasAccess) {
      const inst = req.app.locals.botManager.get(botId);
      if (inst?.client?.isReady?.()) {
        hasAccess = await checkMemberAdmin(inst, guildId, userId);
      }
    }

    if (!hasAccess) return res.status(403).json({ error: 'access_denied' });

    const deleted = db.guildManager.delete(botId, guildId);
    if (!deleted) return res.status(500).json({ error: 'delete_failed' });

    logger.info({ botId, guildId, userId: req.user.id }, 'guild data purged');
    res.json({ ok: true, message: 'Данные гильдии удалены' });
  });

  /* ═══════════════════ GET /api/guilds/roles ═══════════════════ */
  router.get('/roles', requireBotAccess, async (req, res) => {
    const inst = req.app.locals.botManager.get(req.bot.id);
    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });
    try {
      const guild = inst.client.guilds.cache.get(req.query.guildId)
        || await inst.client.guilds.fetch(req.query.guildId);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      await guild.roles.fetch();

      const me = guild.members.me;
      const botHighest = me?.roles?.highest?.position ?? 0;

      const roles = [...guild.roles.cache.values()]
        .filter((r) => r.name !== '@everyone' && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.hexColor === '#000000' ? null : r.hexColor,
          position: r.position,
          memberCount: r.members.size,
          assignable: me ? r.position < botHighest : false,
        }));

      res.json(roles);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'failed to fetch roles');
      res.status(500).json({ error: 'roles_fetch_failed' });
    }
  });

  /* ═══════════════════ GET /api/guilds/channels ═══════════════════ */
  /**
   * Список каналов.
   * По умолчанию — только текстовые (type 0).
   * `?includeVoice=1` — также голосовые (type 2) и stage (type 13).
   * Используется в picker исключённых каналов модуля «Уровни».
   */
  router.get('/channels', requireBotAccess, async (req, res) => {
    const inst = req.app.locals.botManager.get(req.bot.id);
    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });
    try {
      const guild = inst.client.guilds.cache.get(req.query.guildId)
        || await inst.client.guilds.fetch(req.query.guildId);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      const includeVoice = req.query.includeVoice === '1' || req.query.includeVoice === 'true';
      const allowedTypes = includeVoice ? new Set([0, 2, 13]) : new Set([0]);

      const rulesId = guild.rulesChannelId || null;

      const channels = guild.channels.cache
        .filter((c) => allowedTypes.has(c.type))
        .filter((c) => c.id !== rulesId)
        .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId || null,
          parentName: c.parent?.name || null,
        }));

      res.json(channels);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'failed to fetch channels');
      res.status(500).json({ error: 'channels_fetch_failed' });
    }
  });

  /* ═══════════════════ GET /api/guilds/channels/:channelId/permissions ═══════════════════ */
  router.get('/channels/:channelId/permissions', requireBotAccess, async (req, res) => {
    const inst = req.app.locals.botManager.get(req.bot.id);
    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });
    try {
      const guild = inst.client.guilds.cache.get(req.query.guildId);
      if (!guild) return res.status(404).json({ error: 'guild_not_found' });

      const channel = guild.channels.cache.get(req.params.channelId);
      if (!channel) return res.json({ channelExists: false });

      const me = guild.members.me;
      if (!me) return res.json({ channelExists: true, canSend: false });

      const p = channel.permissionsFor(me);

      res.json({
        channelExists: true,
        canViewChannel: p.has('ViewChannel'),
        canSend: p.has('SendMessage') || p.has('SendMessages'),
        canEmbed: p.has('EmbedLinks'),
        canAttachFiles: p.has('AttachFiles'),
        canMentionEveryone: p.has('MentionEveryone'),
      });
    } catch (err) {
      req.app.locals.logger.error({ err }, 'failed to check permissions');
      res.status(500).json({ error: 'permissions_check_failed' });
    }
  });

  return router;
}