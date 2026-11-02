// server/db/repositories/moderation.js
// Репозиторий гильдейской БД (per-guild): модерация, логи, аудит, настройки.

export function createModerationRepo(raw) {
  return {
    /* ═══════════════ mod_actions ═══════════════ */

    /**
     * Список наказаний с фильтрами и пагинацией.
     * @returns {{ rows: object[], total: number }}
     */
    getModActions(opts = {}) {
      const {
        kind, status, moderatorId, userId, since, search,
        limit = 50, offset = 0,
      } = opts;

      const conditions = [];
      const params = [];
      const now = Math.floor(Date.now() / 1000);

      if (kind) { conditions.push('ma.kind = ?'); params.push(kind); }
      if (moderatorId) { conditions.push('ma.moderator_id = ?'); params.push(moderatorId); }
      if (userId) { conditions.push('ma.user_id = ?'); params.push(userId); }
      if (since) { conditions.push('ma.created_at >= ?'); params.push(since); }

      if (status === 'active') {
        conditions.push('ma.removed_at IS NULL');
        conditions.push('(ma.expires_at IS NULL OR ma.expires_at > ?)');
        params.push(now);
      } else if (status === 'expired') {
        conditions.push('ma.removed_at IS NULL');
        conditions.push('ma.expires_at IS NOT NULL');
        conditions.push('ma.expires_at <= ?');
        params.push(now);
      } else if (status === 'removed') {
        conditions.push('ma.removed_at IS NOT NULL');
      }

      if (search) {
        conditions.push(`(
          ma.reason LIKE ? OR
          up.username LIKE ? OR
          up.display_name LIKE ? OR
          mod_up.username LIKE ? OR
          mod_up.display_name LIKE ?
        )`);
        const like = `%${search}%`;
        params.push(like, like, like, like, like);
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const total = raw.prepare(`
        SELECT COUNT(*) AS c
        FROM mod_actions ma
        LEFT JOIN user_profiles up     ON up.user_id     = ma.user_id
        LEFT JOIN user_profiles mod_up ON mod_up.user_id = ma.moderator_id
        ${where}
      `).get(...params).c;

      const rows = raw.prepare(`
        SELECT
          ma.*,
          up.username     AS user_username,
          up.display_name AS user_display_name,
          up.avatar_url   AS user_avatar_url,
          mod_up.username     AS moderator_username,
          mod_up.display_name AS moderator_display_name,
          mod_up.avatar_url   AS moderator_avatar_url
        FROM mod_actions ma
        LEFT JOIN user_profiles up     ON up.user_id     = ma.user_id
        LEFT JOIN user_profiles mod_up ON mod_up.user_id = ma.moderator_id
        ${where}
        ORDER BY ma.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      return { rows, total };
    },

    /** KPI для дашборда модерации. */
    getModActionStats({ since7d = 0 } = {}) {
      const now = Math.floor(Date.now() / 1000);

      const activeMutes = raw.prepare(`
        SELECT COUNT(*) AS c FROM mod_actions
        WHERE kind = 'mute' AND removed_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
      `).get(now).c;

      const activeBans = raw.prepare(`
        SELECT COUNT(*) AS c FROM mod_actions
        WHERE kind = 'ban' AND removed_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
      `).get(now).c;

      const warns7d = raw.prepare(`
        SELECT COUNT(*) AS c FROM mod_actions
        WHERE kind = 'warn' AND created_at >= ?
      `).get(since7d).c;

      const auto7d = raw.prepare(`
        SELECT COUNT(*) AS c FROM mod_actions
        WHERE moderator_id IS NULL AND created_at >= ?
      `).get(since7d).c;

      return { activeMutes, activeBans, warns7d, auto7d };
    },

    /** Баны с истёкшим сроком и не снятые — для cron-задачи. */
    getExpiredBans(nowTs) {
      return raw.prepare(`
        SELECT * FROM mod_actions
        WHERE kind = 'ban'
          AND removed_at IS NULL
          AND expires_at IS NOT NULL
          AND expires_at <= ?
      `).all(nowTs);
    },

    addModAction(a) {
      const id = 'ma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO mod_actions
          (id, user_id, moderator_id, kind, reason, expires_at, filter_key, violation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        a.userId,
        a.moderatorId || null,
        a.kind,
        a.reason || null,
        a.expiresAt || null,
        a.filterKey || null,
        a.violation != null ? Number(a.violation) : null,
      );
      return id;
    },

    getModAction(id) {
      return raw.prepare('SELECT * FROM mod_actions WHERE id = ?').get(id);
    },

    markModActionRemoved(id, removedBy) {
      raw.prepare(`
        UPDATE mod_actions
        SET removed_at = unixepoch(), removed_by = ?
        WHERE id = ? AND removed_at IS NULL
      `).run(String(removedBy || 'system'), id);
    },

    /** Оставлено для обратной совместимости. */
    removeModAction(id) {
      raw.prepare('DELETE FROM mod_actions WHERE id = ?').run(id);
    },

    /* ═══════════════ logs ═══════════════ */

    addLog(entry) {
      const meta = entry.meta || null;
      const userId = entry.userId
        || (meta && typeof meta.userId === 'string' ? meta.userId : null);

      raw.prepare(`
        INSERT INTO logs (level, module, message, meta, user_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        entry.level,
        entry.module || null,
        entry.message,
        meta ? JSON.stringify(meta) : null,
        userId,
      );
    },

    getLogs(limit = 100) {
      return raw.prepare(`
        SELECT
          l.*,
          up.username     AS user_username,
          up.display_name AS user_display_name,
          up.avatar_url   AS user_avatar_url
        FROM logs l
        LEFT JOIN user_profiles up ON up.user_id = l.user_id
        ORDER BY l.created_at DESC
        LIMIT ?
      `).all(limit);
    },

    countLogsByLevel(level, since = 0) {
      return raw.prepare(
        'SELECT COUNT(*) as c FROM logs WHERE level = ? AND created_at >= ?',
      ).get(level, since).c;
    },

    /* ═══════════════ panel_audit ═══════════════ */

    addAudit({ userId, action, target = null, meta = null, ip = null }) {
      try {
        raw.prepare(`
          INSERT INTO panel_audit (user_id, action, target, meta, ip)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          userId, action, target,
          meta ? JSON.stringify(meta) : null,
          ip,
        );
      } catch {
        // аудит не должен ломать основной поток
      }
    },

    getRecentAudit(limit = 100) {
      return raw.prepare(
        'SELECT * FROM panel_audit ORDER BY created_at DESC LIMIT ?',
      ).all(limit);
    },

    /* ═══════════════ guild_settings ═══════════════ */

    getGuildSettings() {
      const row = raw.prepare('SELECT * FROM guild_settings WHERE id = 1').get();
      if (!row) {
        raw.prepare('INSERT INTO guild_settings (id) VALUES (1)').run();
        return {
          language: 'ru',
          welcome_channel: null,
          log_channel: null,
          excluded_roles: [],
        };
      }
      return { ...row, excluded_roles: JSON.parse(row.excluded_roles || '[]') };
    },

    setGuildSettings(s) {
      const existing = this.getGuildSettings();
      const language = s.language !== undefined ? s.language : existing.language;
      const welcomeChannel = s.welcomeChannel !== undefined ? s.welcomeChannel : existing.welcome_channel;
      const logChannel = s.logChannel !== undefined ? s.logChannel : existing.log_channel;
      const excludedRoles = s.excludedRoles !== undefined ? s.excludedRoles : existing.excluded_roles;

      raw.prepare(`
        INSERT INTO guild_settings (id, language, welcome_channel, log_channel, excluded_roles)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          language        = excluded.language,
          welcome_channel = excluded.welcome_channel,
          log_channel     = excluded.log_channel,
          excluded_roles  = excluded.excluded_roles,
          updated_at      = unixepoch()
      `).run(
        language || 'ru',
        welcomeChannel || null,
        logChannel || null,
        JSON.stringify(excludedRoles || []),
      );
    },
  };
}