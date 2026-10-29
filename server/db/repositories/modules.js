// server/db/repositories/modules.js
export function createModulesRepo(raw) {
  return {
    ensureModuleDefaults(modules) {
      if (!Array.isArray(modules) || !modules.length) return 0;
      const existing = new Set(
        raw.prepare('SELECT module_key FROM module_configs').all().map((r) => r.module_key),
      );
      const missing = modules.filter((m) => !existing.has(m.key));
      if (!missing.length) return 0;
      const insert = raw.prepare('INSERT OR IGNORE INTO module_configs (module_key, enabled) VALUES (?, 0)');
      const tx = raw.transaction(() => {
        for (const m of missing) insert.run(m.key);
      });
      tx();
      return missing.length;
    },

    getModuleConfig(key) {
      const row = raw.prepare('SELECT enabled, config FROM module_configs WHERE module_key = ?').get(key);
      return row
        ? { enabled: !!row.enabled, config: JSON.parse(row.config || '{}') }
        : { enabled: false, config: {} };
    },

    setModuleEnabled(key, enabled) {
      raw.prepare(`
        INSERT INTO module_configs (module_key, enabled)
        VALUES (?, ?)
        ON CONFLICT(module_key) DO UPDATE SET enabled = excluded.enabled, updated_at = unixepoch()
      `).run(key, enabled ? 1 : 0);
    },

    setModuleConfig(key, config) {
      raw.prepare(`
        INSERT INTO module_configs (module_key, config)
        VALUES (?, ?)
        ON CONFLICT(module_key) DO UPDATE SET config = excluded.config, updated_at = unixepoch()
      `).run(key, JSON.stringify(config));
    },

    getEnabledModules() {
      return raw.prepare('SELECT module_key FROM module_configs WHERE enabled = 1')
        .all().map((r) => r.module_key);
    },

    getModuleStates() {
      return raw.prepare('SELECT module_key, enabled FROM module_configs').all();
    },

    countEnabledModules() {
      return raw.prepare('SELECT COUNT(*) as c FROM module_configs WHERE enabled = 1').get().c;
    },
  };
}