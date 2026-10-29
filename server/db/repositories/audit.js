// server/db/repositories/audit.js
export function createAuditRepo(mainDb) {
  return {
    addGlobalAudit({ userId, botId = null, guildId = null, action, target = null, meta = null, ip = null }) {
      try {
        mainDb.prepare(`
          INSERT INTO panel_audit_global (user_id, bot_id, guild_id, action, target, meta, ip)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, botId, guildId, action, target, meta ? JSON.stringify(meta) : null, ip);
      } catch {}
    },
  };
}