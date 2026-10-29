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

    countUniqueUsers(botId, guildId, since = 0) {
      return db.prepare(`
        SELECT COUNT(DISTINCT e.user_id) as c
        FROM events e
        LEFT JOIN user_profiles up
          ON up.bot_id = e.bot_id
         AND up.guild_id = e.guild_id
         AND up.user_id = e.user_id
        WHERE e.bot_id = ? AND e.guild_id = ? AND e.created_at >= ?
          AND e.user_id IS NOT NULL
          AND e.user_id NOT IN (SELECT id FROM bots)
          AND up.left_at IS NULL
      `).get(botId, guildId, since).c;
    },

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

    getMemberEvents(botId, guildId, type, since, limit = 500) {
      return db.prepare(`
        SELECT
          e.user_id,
          e.created_at,
          COALESCE(up.username,     json_extract(e.meta, '$.username'))    as username,
          COALESCE(up.display_name, json_extract(e.meta, '$.displayName')) as display_name,
          COALESCE(up.avatar_url,   json_extract(e.meta, '$.avatarUrl'))   as avatar_url
        FROM events e
        LEFT JOIN user_profiles up
          ON up.bot_id = e.bot_id
         AND up.guild_id = e.guild_id
         AND up.user_id = e.user_id
        WHERE e.bot_id = ? AND e.guild_id = ? AND e.type = ? AND e.created_at >= ?
        ORDER BY e.created_at DESC
        LIMIT ?
      `).all(botId, guildId, type, since, limit);
    },

    getActiveUsersWithStats(botId, guildId, since, limit = 200) {
      return db.prepare(`
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
        LEFT JOIN user_profiles up
          ON up.bot_id = e.bot_id
         AND up.guild_id = e.guild_id
         AND up.user_id = e.user_id
        WHERE e.bot_id = ? AND e.guild_id = ?
          AND e.created_at >= ?
          AND e.user_id IS NOT NULL
          AND e.user_id NOT IN (SELECT id FROM bots)
          AND e.type IN ('message', 'command', 'voice_join')
          AND up.left_at IS NULL
        GROUP BY e.user_id
        ORDER BY (messages + commands + voice) DESC
        LIMIT ?
      `).all(botId, guildId, since, limit);
    },

    getUserStatsBatch(botId, guildId, userIds) {
      if (!Array.isArray(userIds) || !userIds.length) return {};
      const placeholders = userIds.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT
          user_id,
          SUM(CASE WHEN type = 'message'    THEN 1 ELSE 0 END) AS messages,
          SUM(CASE WHEN type = 'command'    THEN 1 ELSE 0 END) AS commands,
          SUM(CASE WHEN type = 'voice_join' THEN 1 ELSE 0 END) AS voice
        FROM events
        WHERE bot_id = ? AND guild_id = ?
          AND user_id IN (${placeholders})
        GROUP BY user_id
      `).all(botId, guildId, ...userIds);
      const map = {};
      for (const r of rows) {
        map[r.user_id] = {
          messages: r.messages | 0,
          commands: r.commands | 0,
          voice: r.voice | 0,
        };
      }
      return map;
    },

    getUserStats(botId, guildId, userId) {
      const row = db.prepare(`
        SELECT
          SUM(CASE WHEN type = 'message'    THEN 1 ELSE 0 END) AS messages,
          SUM(CASE WHEN type = 'command'    THEN 1 ELSE 0 END) AS commands,
          SUM(CASE WHEN type = 'voice_join' THEN 1 ELSE 0 END) AS voice,
          MAX(created_at) AS last_active
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND user_id = ?
      `).get(botId, guildId, userId);
      return row || { messages: 0, commands: 0, voice: 0, last_active: null };
    },
  };
}