// server/modules/_base.js
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

  async register() {}

  /** Останавливает фоновые задачи модуля. */
  async unregister() {}

  async onEvent(_event) {}

  async getConfig(botId, guildId) {
    return this.db.getModuleConfig(botId, guildId, this.key);
  }

  async setConfig(botId, guildId, config) {
    return this.db.setModuleConfig(botId, guildId, this.key, config);
  }
}