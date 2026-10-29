// server/core/config-cache.js
// Кэш enabled-модулей и их конфигов. Инвалидируется при изменении.
// Радикально снижает нагрузку на SQLite при массовых событиях (сообщения).

const DEFAULT_TTL = 30_000;

class ConfigCache {
  constructor({ ttl = DEFAULT_TTL } = {}) {
    this.ttl = ttl;
    this._enabled = new Map();   // key: botId:guildId -> { value, ts }
    this._configs = new Map();   // key: botId:guildId:moduleKey -> { value, ts }
  }

  _keyGuild(botId, guildId) {
    return `${botId}:${guildId}`;
  }
  _keyModule(botId, guildId, key) {
    return `${botId}:${guildId}:${key}`;
  }

  async getEnabled(db, botId, guildId) {
    const k = this._keyGuild(botId, guildId);
    const now = Date.now();
    const cached = this._enabled.get(k);
    if (cached && now - cached.ts < this.ttl) return cached.value;

    const value = db.getEnabledModules(botId, guildId);
    this._enabled.set(k, { value, ts: now });
    return value;
  }

  async getModuleConfig(db, botId, guildId, key) {
    const k = this._keyModule(botId, guildId, key);
    const now = Date.now();
    const cached = this._configs.get(k);
    if (cached && now - cached.ts < this.ttl) return cached.value;

    const value = db.getModuleConfig(botId, guildId, key);
    this._configs.set(k, { value, ts: now });
    return value;
  }

  /** Сбросить всё для гильдии (например, при toggle/config save). */
  invalidateGuild(botId, guildId) {
    const prefixGuild = `${botId}:${guildId}`;
    this._enabled.delete(prefixGuild);
    for (const key of this._configs.keys()) {
      if (key.startsWith(prefixGuild + ':')) this._configs.delete(key);
    }
  }

  /** Сбросить только конфиг конкретного модуля. */
  invalidateModule(botId, guildId, moduleKey) {
    this._configs.delete(this._keyModule(botId, guildId, moduleKey));
  }

  /** Периодическая уборка протухших записей. */
  cleanup() {
    const now = Date.now();
    for (const [k, v] of this._enabled) {
      if (now - v.ts > this.ttl * 4) this._enabled.delete(k);
    }
    for (const [k, v] of this._configs) {
      if (now - v.ts > this.ttl * 4) this._configs.delete(k);
    }
  }
}

export const configCache = new ConfigCache();
export { ConfigCache };