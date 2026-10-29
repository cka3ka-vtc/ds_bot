// server/db/repositories/members.js
export function createMembersRepo(db) {
  return {
    getAllMembersData(botId, guildId) {
      return db.prepare('SELECT * FROM members WHERE bot_id = ? AND guild_id = ?').all(botId, guildId);
    },
    getMemberData(botId, guildId, userId) {
      return db.prepare('SELECT * FROM members WHERE bot_id = ? AND guild_id = ? AND user_id = ?')
        .get(botId, guildId, userId);
    },
    upsertMemberData(botId, guildId, userId, data) {
      const autoRoles = data.autoRoles !== undefined ? JSON.stringify(data.autoRoles) : null;
      db.prepare(`
        INSERT INTO members
          (bot_id, guild_id, user_id, xp, level, warnings, birthday, birthday_public, last_active_at, daily_at, auto_roles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET
          xp              = COALESCE(?, xp),
          level           = COALESCE(?, level),
          warnings        = COALESCE(?, warnings),
          birthday        = COALESCE(?, birthday),
          birthday_public = COALESCE(?, birthday_public),
          last_active_at  = COALESCE(?, last_active_at),
          daily_at        = COALESCE(?, daily_at),
          auto_roles      = COALESCE(?, auto_roles)
      `).run(
        botId, guildId, userId,
        data.xp ?? 0, data.level ?? 0, data.warnings ?? 0,
        data.birthday ?? null,
        data.birthdayPublic != null ? (data.birthdayPublic ? 1 : 0) : 0,
        data.lastActiveAt ?? Math.floor(Date.now() / 1000),
        data.dailyAt ?? null,
        autoRoles ?? '[]',
        data.xp ?? null, data.level ?? null, data.warnings ?? null,
        data.birthday ?? null,
        data.birthdayPublic != null ? (data.birthdayPublic ? 1 : 0) : null,
        data.lastActiveAt ?? null, data.dailyAt ?? null,
        autoRoles,
      );
    },

    updateXp(botId, guildId, userId, { xp, level, autoRoles }) {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO members (bot_id, guild_id, user_id, xp, level, last_active_at, auto_roles)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET
          xp = excluded.xp,
          level = excluded.level,
          last_active_at = excluded.last_active_at,
          auto_roles = excluded.auto_roles
      `).run(botId, guildId, userId, xp, level, now, JSON.stringify(autoRoles || []));
    },

    /** Штраф за неактивность: обновляет xp/level/auto_roles + last_penalty_at.
     *  last_active_at НЕ ТРОГАЕТ. */
    applyPenalty(botId, guildId, userId, { xp, level, autoRoles }) {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO members (bot_id, guild_id, user_id, xp, level, last_penalty_at, auto_roles)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET
          xp = excluded.xp,
          level = excluded.level,
          last_penalty_at = excluded.last_penalty_at,
          auto_roles = excluded.auto_roles
      `).run(botId, guildId, userId, xp, level, now, JSON.stringify(autoRoles || []));
    },

    touchActive(botId, guildId, userId) {
      const now = Math.floor(Date.now() / 1000);
      db.prepare(`
        UPDATE members SET last_active_at = ?
        WHERE bot_id = ? AND guild_id = ? AND user_id = ?
      `).run(now, botId, guildId, userId);
    },

    getLeaderboard(botId, guildId, limit = 10, offset = 0) {
      return db.prepare(`
        SELECT * FROM members
        WHERE bot_id = ? AND guild_id = ? AND xp > 0
        ORDER BY xp DESC, level DESC
        LIMIT ? OFFSET ?
      `).all(botId, guildId, limit, offset);
    },

    getUserRank(botId, guildId, userId) {
      const row = db.prepare(`
        SELECT COUNT(*) + 1 AS rank
        FROM members
        WHERE bot_id = ? AND guild_id = ? AND xp > (
          SELECT COALESCE((SELECT xp FROM members WHERE bot_id = ? AND guild_id = ? AND user_id = ?), -1)
        )
      `).get(botId, guildId, botId, guildId, userId);
      return row?.rank ?? 0;
    },

    countLeaderboard(botId, guildId) {
      return db.prepare(
        'SELECT COUNT(*) AS c FROM members WHERE bot_id = ? AND guild_id = ? AND xp > 0',
      ).get(botId, guildId).c;
    },

    getInactive(botId, guildId, thresholdTs) {
      return db.prepare(`
        SELECT * FROM members
        WHERE bot_id = ? AND guild_id = ? AND xp > 0
          AND (last_active_at IS NULL OR last_active_at < ?)
      `).all(botId, guildId, thresholdTs);
    },

    getDailyCooldown(botId, guildId, userId) {
      const row = db.prepare(
        'SELECT daily_at FROM members WHERE bot_id = ? AND guild_id = ? AND user_id = ?',
      ).get(botId, guildId, userId);
      return row?.daily_at ?? 0;
    },

    setDailyAt(botId, guildId, userId, ts) {
      db.prepare(`
        INSERT INTO members (bot_id, guild_id, user_id, daily_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET daily_at = excluded.daily_at
      `).run(botId, guildId, userId, ts);
    },
  };
}