// server/db/repositories/events.js
export function createEventsRepo(db) {
  return {
    addEvent(e) {
      db.prepare(`
        INSERT INTO events (bot_id, guild_id, user_id, type, meta)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        e.botId, e.guildId, e.userId || null, e.type,
        e.meta ? JSON.stringify(e.meta) : null,
      );
    },

    countEvents(botId, guildId, type, since = 0) {
      return db.prepare(`
        SELECT COUNT(*) as c FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = ? AND created_at >= ?
      `).get(botId, guildId, type, since).c;
    },

    countEvents24h(botId, guildId) {
      const since = Math.floor(Date.now() / 1000) - 86400;
      return db.prepare(`
        SELECT COUNT(*) as c FROM events WHERE bot_id = ? AND guild_id = ? AND created_at >= ?
      `).get(botId, guildId, since).c;
    },

    countUniqueUsers(botId, guildId, since = 0) {
      return db.prepare(`
        SELECT COUNT(DISTINCT user_id) as c FROM events
        WHERE bot_id = ? AND guild_id = ? AND created_at >= ? AND user_id IS NOT NULL
      `).get(botId, guildId, since).c;
    },

    /**
     * Группировка событий по дням с учётом часового пояса клиента.
     * @param {number} tzOffsetMin — смещение в минутах (МСК = 180, UTC−5 = -300).
     */
    getEventsByDay(botId, guildId, type, since, tzOffsetMin = 0) {
      const sign = tzOffsetMin >= 0 ? '+' : '';
      const modifier = `${sign}${tzOffsetMin} minutes`;
      return db.prepare(`
        SELECT date(created_at, 'unixepoch', ?) as day, COUNT(*) as count
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = ? AND created_at >= ?
        GROUP BY day ORDER BY day
      `).all(modifier, botId, guildId, type, since);
    },

    getTopCommands(botId, guildId, since, limit = 5) {
      return db.prepare(`
        SELECT json_extract(meta, '$.command') as cmd, COUNT(*) as count
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = 'command' AND created_at >= ?
        GROUP BY cmd ORDER BY count DESC LIMIT ?
      `).all(botId, guildId, since, limit);
    },

    /**
     * Топ каналов по УНИКАЛЬНЫМ пользователям.
     * @param {string} type — 'message' (текстовые) | 'voice_join' (голосовые).
     */
    getTopChannels(botId, guildId, type, since, limit = 5) {
      return db.prepare(`
        SELECT
          json_extract(meta, '$.channelId') as channel_id,
          COUNT(DISTINCT user_id) as count
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = ? AND created_at >= ?
          AND user_id IS NOT NULL
          AND json_extract(meta, '$.channelId') IS NOT NULL
        GROUP BY channel_id
        ORDER BY count DESC
        LIMIT ?
      `).all(botId, guildId, type, since, limit);
    },

    getRecentActivity(botId, guildId, limit = 5) {
      return db.prepare(`
        SELECT 'mod' as source, kind as type, user_id, reason as message, created_at
        FROM mod_actions WHERE bot_id = ? AND guild_id = ?
        UNION ALL
        SELECT 'log' as source, module as type, NULL as user_id, message, created_at
        FROM logs WHERE bot_id = ? AND guild_id = ? AND level IN ('info', 'warn')
        ORDER BY created_at DESC LIMIT ?
      `).all(botId, guildId, botId, guildId, limit);
    },
  };
}