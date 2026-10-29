// server/db/repositories/events.js
const SQLITE_VARIABLE_CHUNK = 500;

export function createEventsRepo(raw) {
  return {
    addEvent(e) {
      raw.prepare('INSERT INTO events (user_id, type, meta) VALUES (?, ?, ?)')
        .run(e.userId || null, e.type, e.meta ? JSON.stringify(e.meta) : null);
    },

    countEvents(type, since = 0) {
      return raw.prepare('SELECT COUNT(*) as c FROM events WHERE type = ? AND created_at >= ?')
        .get(type, since).c;
    },

    countUniqueUsers(since = 0) {
      return raw.prepare(`
        SELECT COUNT(DISTINCT e.user_id) as c
        FROM events e
        LEFT JOIN user_profiles up ON up.user_id = e.user_id
        WHERE e.created_at >= ?
          AND e.user_id IS NOT NULL
          AND up.left_at IS NULL
      `).get(since).c;
    },

    getEventsByDay(type, since, tzOffsetMin = 0) {
      const sign = tzOffsetMin >= 0 ? '+' : '';
      const modifier = `${sign}${tzOffsetMin} minutes`;
      return raw.prepare(`
        SELECT date(created_at, 'unixepoch', ?) as day, COUNT(*) as count
        FROM events WHERE type = ? AND created_at >= ?
        GROUP BY day ORDER BY day
      `).all(modifier, type, since);
    },

    getTopCommands(since, limit = 5) {
      return raw.prepare(`
        SELECT json_extract(meta, '$.command') as cmd, COUNT(*) as count
        FROM events WHERE type = 'command' AND created_at >= ?
        GROUP BY cmd ORDER BY count DESC LIMIT ?
      `).all(since, limit);
    },

    getTopChannels(type, since, limit = 5) {
      return raw.prepare(`
        SELECT json_extract(meta, '$.channelId') as channel_id,
               COUNT(DISTINCT user_id) as count
        FROM events
        WHERE type = ? AND created_at >= ?
          AND user_id IS NOT NULL
          AND json_extract(meta, '$.channelId') IS NOT NULL
        GROUP BY channel_id ORDER BY count DESC LIMIT ?
      `).all(type, since, limit);
    },

    getRecentActivity(limit = 5) {
      return raw.prepare(`
        SELECT 'mod' as source, kind as type, user_id, reason as message, created_at FROM mod_actions
        UNION ALL
        SELECT 'log' as source, module as type, NULL as user_id, message, created_at
        FROM logs WHERE level IN ('info', 'warn')
        ORDER BY created_at DESC LIMIT ?
      `).all(limit);
    },

    getMemberEvents(type, since, limit = 500) {
      return raw.prepare(`
        SELECT
          e.user_id, e.created_at,
          COALESCE(up.username,     json_extract(e.meta, '$.username'))    as username,
          COALESCE(up.display_name, json_extract(e.meta, '$.displayName')) as display_name,
          COALESCE(up.avatar_url,   json_extract(e.meta, '$.avatarUrl'))   as avatar_url
        FROM events e
        LEFT JOIN user_profiles up ON up.user_id = e.user_id
        WHERE e.type = ? AND e.created_at >= ?
        ORDER BY e.created_at DESC LIMIT ?
      `).all(type, since, limit);
    },

    getActiveUsersWithStats(since, limit = 200) {
      return raw.prepare(`
        SELECT
          e.user_id,
          SUM(CASE WHEN e.type = 'message'    THEN 1 ELSE 0 END) as messages,
          SUM(CASE WHEN e.type = 'command'    THEN 1 ELSE 0 END) as commands,
          SUM(CASE WHEN e.type = 'voice_join' THEN 1 ELSE 0 END) as voice,
          MAX(e.created_at) as last_active,
          COALESCE(MAX(up.username),     MAX(json_extract(e.meta, '$.username')))    as username,
          COALESCE(MAX(up.display_name), MAX(json_extract(e.meta, '$.displayName'))) as display_name,
          COALESCE(MAX(up.avatar_url),   MAX(json_extract(e.meta, '$.avatarUrl')))   as avatar_url
        FROM events e
        LEFT JOIN user_profiles up ON up.user_id = e.user_id
        WHERE e.created_at >= ?
          AND e.user_id IS NOT NULL
          AND e.type IN ('message', 'command', 'voice_join')
          AND up.left_at IS NULL
        GROUP BY e.user_id
        ORDER BY (messages + commands + voice) DESC
        LIMIT ?
      `).all(since, limit);
    },

    getUserStatsBatch(userIds) {
      if (!Array.isArray(userIds) || !userIds.length) return {};
      const map = {};
      for (let i = 0; i < userIds.length; i += SQLITE_VARIABLE_CHUNK) {
        const chunk = userIds.slice(i, i + SQLITE_VARIABLE_CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        const rows = raw.prepare(`
          SELECT user_id,
            SUM(CASE WHEN type = 'message'    THEN 1 ELSE 0 END) AS messages,
            SUM(CASE WHEN type = 'command'    THEN 1 ELSE 0 END) AS commands,
            SUM(CASE WHEN type = 'voice_join' THEN 1 ELSE 0 END) AS voice
          FROM events WHERE user_id IN (${placeholders})
          GROUP BY user_id
        `).all(...chunk);
        for (const r of rows) {
          map[r.user_id] = {
            messages: r.messages | 0,
            commands: r.commands | 0,
            voice: r.voice | 0,
          };
        }
      }
      return map;
    },

    getUserStats(userId) {
      const row = raw.prepare(`
        SELECT
          SUM(CASE WHEN type = 'message'    THEN 1 ELSE 0 END) AS messages,
          SUM(CASE WHEN type = 'command'    THEN 1 ELSE 0 END) AS commands,
          SUM(CASE WHEN type = 'voice_join' THEN 1 ELSE 0 END) AS voice,
          MAX(created_at) AS last_active
        FROM events WHERE user_id = ?
      `).get(userId);
      return row || { messages: 0, commands: 0, voice: 0, last_active: null };
    },
  };
}