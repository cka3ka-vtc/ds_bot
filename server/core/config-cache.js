// server/core/config-cache.js
// Кэш enabled-модулей и их конфигов. Инвалидируется точечно:
//   - invalidateEnabled(botId, guildId)            — только enabled;
//   - invalidateModule(botId, guildId, key)        — только конфиг одного модуля;
//   - invalidateGuild(botId, guildId)              — всё для гильдии (редко).
// Радикально снижает нагрузку на SQLite при массовых событиях и toggle.

const DEFAULT_TTL = 30_000;

class ConfigCache {
  constructor({ ttl = DEFAULT_TTL } = {}) {
    this.ttl = ttl;
    this._enabled = new Map();   // key: botId:guildId → { value, ts }
    this._configs = new Map();   // key: botId:guildId:moduleKey → { value, ts }
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

  /**
   * Сбрасывает только список enabled-модулей для гильдии.
   * Используется при toggle модуля (enabled изменился, конфиги других
   * модулей не тронуты).
   */
  invalidateEnabled(botId, guildId) {
    this._enabled.delete(this._keyGuild(botId, guildId));
  }

  /**
   * Сбрасывает конфиг конкретного модуля. Используется при сохранении
   * настроек модуля (enabled не менялся).
   */
  invalidateModule(botId, guildId, moduleKey) {
    this._configs.delete(this._keyModule(botId, guildId, moduleKey));
  }

  /**
   * Сбрасывает ВСЁ для гильдии (enabled + все конфиги).
   * Используется в редких случаях: hard reset, смена доступных модулей,
   * миграции. В hot path НЕ вызывать — используйте invalidateEnabled /
   * invalidateModule точечно.
   */
  invalidateGuild(botId, guildId) {
    const prefixGuild = this._keyGuild(botId, guildId);
    this._enabled.delete(prefixGuild);
    for (const key of this._configs.keys()) {
      if (key.startsWith(prefixGuild + ':')) this._configs.delete(key);
    }
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