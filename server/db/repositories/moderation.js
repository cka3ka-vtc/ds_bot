// server/db/repositories/moderation.js
export function createModerationRepo(db) {
  return {
    /* mod_actions */
    getModActions(botId, guildId, kind) {
      if (kind) {
        return db.prepare(
          'SELECT * FROM mod_actions WHERE bot_id = ? AND guild_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 200',
        ).all(botId, guildId, kind);
      }
      return db.prepare(
        'SELECT * FROM mod_actions WHERE bot_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 200',
      ).all(botId, guildId);
    },
    addModAction(a) {
      const id = 'ma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      db.prepare(`
        INSERT INTO mod_actions (id, bot_id, guild_id, user_id, moderator_id, kind, reason, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, a.botId, a.guildId, a.userId,
        a.moderatorId || null, a.kind, a.reason || null, a.expiresAt || null,
      );
      return id;
    },
    removeModAction(id) {
      db.prepare('DELETE FROM mod_actions WHERE id = ?').run(id);
    },
    getModAction(id) {
      return db.prepare('SELECT * FROM mod_actions WHERE id = ?').get(id);
    },

    /* logs */
    addLog(entry) {
      db.prepare(`
        INSERT INTO logs (bot_id, guild_id, level, module, message, meta)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entry.botId || null,
        entry.guildId || null,
        entry.level,
        entry.module || null,
        entry.message,
        entry.meta ? JSON.stringify(entry.meta) : null,
      );
    },
    getLogs(botId, guildId, limit = 100) {
      return db.prepare(`
        SELECT * FROM logs WHERE bot_id = ? AND guild_id = ?
        ORDER BY created_at DESC LIMIT ?
      `).all(botId, guildId, limit);
    },
    countLogsByLevel(botId, guildId, level, since = 0) {
      return db.prepare(`
        SELECT COUNT(*) as c FROM logs
        WHERE bot_id = ? AND guild_id = ? AND level = ? AND created_at >= ?
      `).get(botId, guildId, level, since).c;
    },
  };
}