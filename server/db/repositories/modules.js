// server/db/repositories/modules.js
export function createModulesRepo(db) {
  return {
    getModuleConfig(botId, guildId, key) {
      const row = db.prepare(
        'SELECT enabled, config FROM module_configs WHERE bot_id = ? AND guild_id = ? AND module_key = ?',
      ).get(botId, guildId, key);
      return row ? { enabled: !!row.enabled, config: JSON.parse(row.config) } : { enabled: false, config: {} };
    },
    setModuleEnabled(botId, guildId, key, enabled) {
      db.prepare(`
        INSERT INTO module_configs (bot_id, guild_id, module_key, enabled)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, module_key) DO UPDATE SET
          enabled = excluded.enabled, updated_at = unixepoch()
      `).run(botId, guildId, key, enabled ? 1 : 0);
    },
    setModuleConfig(botId, guildId, key, config) {
      db.prepare(`
        INSERT INTO module_configs (bot_id, guild_id, module_key, config)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, module_key) DO UPDATE SET
          config = excluded.config, updated_at = unixepoch()
      `).run(botId, guildId, key, JSON.stringify(config));
    },
    getEnabledModules(botId, guildId) {
      return db.prepare(
        'SELECT module_key FROM module_configs WHERE bot_id = ? AND guild_id = ? AND enabled = 1',
      ).all(botId, guildId).map((r) => r.module_key);
    },
    getModuleStates(botId, guildId) {
      return db.prepare(
        'SELECT module_key, enabled FROM module_configs WHERE bot_id = ? AND guild_id = ?',
      ).all(botId, guildId);
    },
    countEnabledModules(botId, guildId) {
      return db.prepare(
        'SELECT COUNT(*) as c FROM module_configs WHERE bot_id = ? AND guild_id = ? AND enabled = 1',
      ).get(botId, guildId).c;
    },
  };
}