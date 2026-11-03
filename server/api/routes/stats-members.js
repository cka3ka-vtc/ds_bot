// server/api/routes/stats-members.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { runWithConcurrency } from '../../core/concurrency.js';

/**
 * Догружает профили (username/displayName/avatarUrl) из Discord cache/REST.
 * ФИКС: параллелизм через runWithConcurrency(5) — раньше был последовательный
 * цикл по maxFetches (до 3 сек на 30 пользователей).
 */
async function enrichProfilesFromDiscord({ db, botManager, botId, guildId, rows, maxFetches = 30 }) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return rows;

  // Собираем подмножество для fetch (первые N без username/avatar_url)
  const toFetch = [];
  for (const row of rows) {
    if (row.username && row.avatar_url) continue;
    if (toFetch.length >= maxFetches) break;
    toFetch.push(row);
  }

  await runWithConcurrency(toFetch, 5, async (row) => {
    let user = inst.client.users.cache.get(row.user_id);
    if (!user) {
      try {
        user = await inst.client.users.fetch(row.user_id, { force: false, cache: true });
      } catch {
        return;
      }
    }
    if (!user) return;

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
    } catch {}
  });

  return rows;
}

export function statsMembersRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/joined', requireBotAccess, async (req, res) => {
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

  router.get('/left', requireBotAccess, async (req, res) => {
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

  router.get('/active', requireBotAccess, async (req, res) => {
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