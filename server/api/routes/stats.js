// server/api/routes/stats.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

/* ───────── Кэш «живых» участников (без ботов) ─────────
 * memberCount возвращает ВСЕХ, включая ботов. Чтобы KPI «Всего участников»
 * не завышался, кэшируем значение на 5 минут: один fetch на guild, дальше — из кэша.
 */
const memberCountCache = new Map();
const MEMBER_COUNT_TTL = 5 * 60 * 1000;

async function getNonBotMemberCount(guild) {
  const now = Date.now();
  const cached = memberCountCache.get(guild.id);
  if (cached && now - cached.ts < MEMBER_COUNT_TTL) return cached.value;

  // Если кэш участников уже загружен полностью — считаем по кэшу
  if (guild.members.cache.size >= guild.memberCount) {
    const value = guild.members.cache.filter((m) => !m.user.bot).size;
    memberCountCache.set(guild.id, { value, ts: now });
    return value;
  }

  // Иначе — fetch с ограничением по времени, потом считаем
  try {
    await guild.members.fetch({ withPresences: false, time: 10_000 });
    const value = guild.members.cache.filter((m) => !m.user.bot).size;
    memberCountCache.set(guild.id, { value, ts: now });
    return value;
  } catch {
    // Fallback: аппроксимация по уже загруженным ботам (обычно их немного и они в кэше)
    const botsInCache = guild.members.cache.filter((m) => m.user.bot).size;
    return Math.max(0, guild.memberCount - botsInCache);
  }
}

/**
 * Обогащает строки реальным профилем из Discord, если username/avatar_url пусты.
 * Сохраняет snapshot в user_profiles, чтобы в следующий раз не fetch'ить заново.
 */
async function enrichProfilesFromDiscord({ db, botManager, botId, guildId, rows, maxFetches = 30 }) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return rows;

  let fetched = 0;
  for (const row of rows) {
    if (row.username && row.avatar_url) continue;
    if (fetched >= maxFetches) break;

    let user = inst.client.users.cache.get(row.user_id);
    if (!user) {
      try {
        user = await inst.client.users.fetch(row.user_id, { force: false, cache: true });
        fetched++;
      } catch {
        continue;
      }
    }
    if (!user) continue;

    const snap = {
      username: user.username || row.username || null,
      displayName: user.globalName || user.username || row.display_name || null,
      avatarUrl: user.displayAvatarURL?.({ size: 128 }) || row.avatar_url || null,
    };

    row.username     = row.username     || snap.username;
    row.display_name = row.display_name || snap.displayName;
    row.avatar_url   = row.avatar_url   || snap.avatarUrl;

    try {
      db.upsertUserProfile({ botId, guildId, userId: row.user_id, ...snap });
    } catch {
      // не блокируем ответ из-за ошибки записи справочника
    }
  }
  return rows;
}

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

    // KPI — только реальные пользователи, без ботов
    const totalMembers = await getNonBotMemberCount(guild);
    const newMembers   = db.countEvents(botId, guildId, 'member_join', since7d);
    const leftMembers  = db.countEvents(botId, guildId, 'member_leave', since7d);
    const activeUsers  = db.countUniqueUsers(botId, guildId, since7d);

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

  /** GET /api/stats/members/joined — пользователи, присоединившиеся за 7 дней */
  router.get('/members/joined', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const rows = req.app.locals.db.getMemberEvents(botId, guildId, 'member_join', since);

    await enrichProfilesFromDiscord({
      db: req.app.locals.db,
      botManager: req.app.locals.botManager,
      botId, guildId, rows, maxFetches: 50,
    });

    res.json(rows);
  });

  /** GET /api/stats/members/left — пользователи, покинувшие сервер за 7 дней */
  router.get('/members/left', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const rows = req.app.locals.db.getMemberEvents(botId, guildId, 'member_leave', since);

    await enrichProfilesFromDiscord({
      db: req.app.locals.db,
      botManager: req.app.locals.botManager,
      botId, guildId, rows, maxFetches: 5,
    });

    res.json(rows);
  });

  /** GET /api/stats/members/active — активные пользователи с разбивкой по событиям */
  router.get('/members/active', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const since = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    const rows = req.app.locals.db.getActiveUsersWithStats(botId, guildId, since);

    await enrichProfilesFromDiscord({
      db: req.app.locals.db,
      botManager: req.app.locals.botManager,
      botId, guildId, rows, maxFetches: 30,
    });

    res.json(rows);
  });

  return router;
}