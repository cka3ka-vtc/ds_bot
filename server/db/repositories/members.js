// server/db/repositories/members.js
export function createMembersRepo(raw) {
  return {
    getAllMembersData() {
      return raw.prepare('SELECT * FROM members').all();
    },

    getMemberData(userId) {
      return raw.prepare('SELECT * FROM members WHERE user_id = ?').get(userId);
    },

    upsertMemberData(userId, data) {
      const autoRoles = data.autoRoles !== undefined ? JSON.stringify(data.autoRoles) : null;
      raw.prepare(`
        INSERT INTO members
          (user_id, xp, level, warnings, birthday, birthday_public, last_active_at, daily_at, auto_roles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          xp              = COALESCE(?, xp),
          level           = COALESCE(?, level),
          warnings        = COALESCE(?, warnings),
          birthday        = COALESCE(?, birthday),
          birthday_public = COALESCE(?, birthday_public),
          last_active_at  = COALESCE(?, last_active_at),
          daily_at        = COALESCE(?, daily_at),
          auto_roles      = COALESCE(?, auto_roles)
      `).run(
        userId,
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

    updateXp(userId, { xp, level, autoRoles }) {
      const now = Math.floor(Date.now() / 1000);
      raw.prepare(`
        INSERT INTO members (user_id, xp, level, last_active_at, auto_roles)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          xp = excluded.xp,
          level = excluded.level,
          last_active_at = excluded.last_active_at,
          auto_roles = excluded.auto_roles
      `).run(userId, xp, level, now, JSON.stringify(autoRoles || []));
    },

    applyPenalty(userId, { xp, level, autoRoles }) {
      const now = Math.floor(Date.now() / 1000);
      raw.prepare(`
        INSERT INTO members (user_id, xp, level, last_penalty_at, auto_roles)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          xp = excluded.xp,
          level = excluded.level,
          last_penalty_at = excluded.last_penalty_at,
          auto_roles = excluded.auto_roles
      `).run(userId, xp, level, now, JSON.stringify(autoRoles || []));
    },

    touchActive(userId) {
      const now = Math.floor(Date.now() / 1000);
      raw.prepare('UPDATE members SET last_active_at = ? WHERE user_id = ?').run(now, userId);
    },

    getLeaderboard(limit = 10, offset = 0) {
      return raw.prepare(`
        SELECT * FROM members WHERE xp > 0
        ORDER BY xp DESC, level DESC LIMIT ? OFFSET ?
      `).all(limit, offset);
    },

    getUserRank(userId) {
      const row = raw.prepare(`
        SELECT COUNT(*) + 1 AS rank FROM members WHERE xp > (
          SELECT COALESCE((SELECT xp FROM members WHERE user_id = ?), -1)
        )
      `).get(userId);
      return row?.rank ?? 0;
    },

    countLeaderboard() {
      return raw.prepare('SELECT COUNT(*) AS c FROM members WHERE xp > 0').get().c;
    },

    getInactive(thresholdTs) {
      return raw.prepare(`
        SELECT * FROM members
        WHERE xp > 0 AND (last_active_at IS NULL OR last_active_at < ?)
      `).all(thresholdTs);
    },

    getDailyCooldown(userId) {
      const row = raw.prepare('SELECT daily_at FROM members WHERE user_id = ?').get(userId);
      return row?.daily_at ?? 0;
    },

    setDailyAt(userId, ts) {
      raw.prepare(`
        INSERT INTO members (user_id, daily_at) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET daily_at = excluded.daily_at
      `).run(userId, ts);
    },
  };
}