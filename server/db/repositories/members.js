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

    /* ═══════════════════════ Birthdays ═══════════════════════ */

    getBirthday(userId) {
      const row = raw.prepare(
        'SELECT birthday, birthday_year, birthday_public FROM members WHERE user_id = ?',
      ).get(userId);
      return row || { birthday: null, birthday_year: null, birthday_public: 0 };
    },

    setBirthday(userId, ddmm, year = null) {
      raw.prepare(`
        INSERT INTO members (user_id, birthday, birthday_year, birthday_public)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id) DO UPDATE SET
          birthday = excluded.birthday,
          birthday_year = excluded.birthday_year,
          birthday_public = 1
      `).run(userId, ddmm, year == null ? null : Number(year));
    },

    setBirthdayPublic(userId, pub) {
      raw.prepare(`
        INSERT INTO members (user_id, birthday_public) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET birthday_public = excluded.birthday_public
      `).run(userId, pub ? 1 : 0);
    },

    /**
     * Все участники с ДР.
     * publicOnly=true (по умолчанию) — только те, у кого поздравления включены
     *   (используется в /birthdays и для подсчёта).
     * publicOnly=false — включая отключивших (для дашборда, чтобы показать
     *   пометку «поздравления отключены»).
     *
     * JOIN user_profiles нужен, чтобы получить username/display_name/avatar_url —
     * без него дашборд показывал инициалы вместо реального имени и аватара.
     */
    getUpcomingBirthdays(publicOnly = true) {
      const filter = publicOnly ? 'AND m.birthday_public = 1' : '';
      return raw.prepare(`
        SELECT
          m.user_id,
          m.birthday,
          m.birthday_year,
          m.birthday_public,
          up.username,
          up.display_name,
          up.avatar_url
        FROM members m
        LEFT JOIN user_profiles up ON up.user_id = m.user_id
        WHERE m.birthday IS NOT NULL ${filter}
      `).all();
    },

    getTodayBirthdays(todayDdMm) {
      return raw.prepare(`
        SELECT user_id, birthday, birthday_year FROM members
        WHERE birthday = ? AND birthday_public = 1
      `).all(todayDdMm);
    },

    countPublicBirthdays() {
      return raw.prepare(`
        SELECT COUNT(*) AS c FROM members
        WHERE birthday IS NOT NULL AND birthday_public = 1
      `).get().c;
    },

    getBirthdayRoleExpired(nowTs) {
      return raw.prepare(`
        SELECT user_id, birthday_role_until FROM members
        WHERE birthday_role_until IS NOT NULL AND birthday_role_until <= ?
      `).all(nowTs);
    },

    setBirthdayRoleUntil(userId, untilTs) {
      raw.prepare(`
        UPDATE members SET birthday_role_until = ? WHERE user_id = ?
      `).run(untilTs, userId);
    },

    clearBirthdayRoleUntil(userId) {
      raw.prepare(`
        UPDATE members SET birthday_role_until = NULL WHERE user_id = ?
      `).run(userId);
    },

    getLastBirthdayAnnounced(userId) {
      const row = raw.prepare(
        'SELECT last_birthday_announced_at FROM members WHERE user_id = ?',
      ).get(userId);
      return (row?.last_birthday_announced_at | 0) || 0;
    },

    setLastBirthdayAnnounced(userId, ts) {
      raw.prepare(`
        UPDATE members SET last_birthday_announced_at = ? WHERE user_id = ?
      `).run(ts, userId);
    },

    /* ═══ Auto-delete past announcements ═══ */

    setLastAnnounce(userId, channelId, messageId, createdAt) {
      raw.prepare(`
        UPDATE members
        SET last_announce_channel_id = ?,
            last_announce_message_id = ?,
            last_announce_created_at = ?
        WHERE user_id = ?
      `).run(channelId, messageId, createdAt, userId);
    },

    clearLastAnnounce(userId) {
      raw.prepare(`
        UPDATE members
        SET last_announce_channel_id = NULL,
            last_announce_message_id = NULL,
            last_announce_created_at = NULL
        WHERE user_id = ?
      `).run(userId);
    },

    getOldAnnouncements(beforeTs) {
      return raw.prepare(`
        SELECT user_id, last_announce_channel_id, last_announce_message_id
        FROM members
        WHERE last_announce_created_at IS NOT NULL
          AND last_announce_created_at < ?
          AND last_announce_message_id IS NOT NULL
          AND last_announce_channel_id IS NOT NULL
      `).all(beforeTs);
    },
  };
}