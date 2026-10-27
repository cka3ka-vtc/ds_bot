// server/modules/_base.js

/**
 * Базовый класс модуля. Каждый модуль наследуется и реализует:
 *   - геттер `key`
 *   - метод `onEvent({ event, client, guildId, ...data })`
 *
 * Контекст ctx = { db, logger, eventBus, botManager }
 */
export class Module {
  constructor(ctx) {
    this.ctx = ctx;
    this.logger = ctx.logger;
    this.db = ctx.db;
    this.eventBus = ctx.eventBus;
    this.botManager = ctx.botManager;
  }

  get key() {
    throw new Error('Module.key not implemented');
  }

  /** Вызывается один раз при старте приложения */
  async register() {}

  /** Основной обработчик. Диспатчится только если модуль включён */
  async onEvent(_event) {}

  /** Утилита: получить конфиг модуля для (botId, guildId) */
  async getConfig(botId, guildId) {
    return this.db.getModuleConfig(botId, guildId, this.key);
  }

  /** Утилита: обновить конфиг */
  async setConfig(botId, guildId, config) {
    return this.db.setModuleConfig(botId, guildId, this.key, config);
  }
}