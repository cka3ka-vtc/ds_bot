// server/db/repositories/moderation.js
// Репозиторий гильдийской БД (per-guild): модерирование, логи, аудит и настройки гильдии.
// botId/guildId не передаются — БД уже привязана к конкретной гильдии.

export function createModerationRepo(raw) {
  return {
    /* ═══════════ mod_actions ═══════════ */

    getModActions(kind) {
      if (kind) {
        return raw.prepare(
          'SELECT * FROM mod_actions WHERE kind = ? ORDER BY created_at DESC LIMIT 200',
        ).all(kind);
      }
      return raw.prepare(
        'SELECT * FROM mod_actions ORDER BY created_at DESC LIMIT 200',
      ).all();
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

    /* ═══════════ logs ═══════════ */

    addLog(entry) {
      raw.prepare(`
        INSERT INTO logs (level, module, message, meta)
        VALUES (?, ?, ?, ?)
      `).run(
        entry.level,
        entry.module || null,
        entry.message,
        entry.meta ? JSON.stringify(entry.meta) : null,
      );
    },

    getLogs(limit = 100) {
      return raw.prepare(
        'SELECT * FROM logs ORDER BY created_at DESC LIMIT ?',
      ).all(limit);
    },

    countLogsByLevel(level, since = 0) {
      return raw.prepare(
        'SELECT COUNT(*) as c FROM logs WHERE level = ? AND created_at >= ?',
      ).get(level, since).c;
    },

    /* ═══════════ panel_audit (per-guild) ═══════════ */

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
        // Аудит не должен ломать основной поток
      }
    },

    getRecentAudit(limit = 100) {
      return raw.prepare(
        'SELECT * FROM panel_audit ORDER BY created_at DESC LIMIT ?',
      ).all(limit);
    },

    /* ═══════════ guild_settings (singleton per guild) ═══════════ */

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