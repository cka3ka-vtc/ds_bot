// server/db/repositories/moderation.js
// Репозиторий гильдейской БД (per-guild): модерация, логи, аудит, настройки.

export function createModerationRepo(raw) {
  return {
    /* ═══════════════ mod_actions ═══════════════ */

    getModActions(kind) {
      const sql = `
        SELECT
          ma.*,
          up.username     AS user_username,
          up.display_name AS user_display_name,
          up.avatar_url   AS user_avatar_url
        FROM mod_actions ma
        LEFT JOIN user_profiles up ON up.user_id = ma.user_id
        ${kind ? 'WHERE ma.kind = ?' : ''}
        ORDER BY ma.created_at DESC
        LIMIT 200
      `;
      return kind
        ? raw.prepare(sql).all(kind)
        : raw.prepare(sql).all();
    },

    addModAction(a) {
      const id = 'ma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO mod_actions (id, user_id, moderator_id, kind, reason, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        a.userId,
        a.moderatorId || null,
        a.kind,
        a.reason || null,
        a.expiresAt || null,
      );
      return id;
    },

    removeModAction(id) {
      raw.prepare('DELETE FROM mod_actions WHERE id = ?').run(id);
    },

    getModAction(id) {
      return raw.prepare('SELECT * FROM mod_actions WHERE id = ?').get(id);
    },

    /* ═══════════════ logs ═══════════════ */

    /**
     * @param {object} entry
     * @param {string} entry.level       — info | warn | error | debug
     * @param {string} [entry.module]    — ключ модуля (levels, birthdays, moderation, ...)
     * @param {string} entry.message
     * @param {string} [entry.userId]    — Discord ID пользователя, к которому относится лог
     * @param {object} [entry.meta]      — произвольные поля
     */
    addLog(entry) {
      const meta = entry.meta || null;
      // userId можно передать явно или положить в meta.userId — берём первое доступное
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
          userId,
          action,
          target,
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
      return {
        ...row,
        excluded_roles: JSON.parse(row.excluded_roles || '[]'),
      };
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