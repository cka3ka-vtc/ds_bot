// server/modules/autodelete.js
// Стаб. Удаляет сообщения по таймеру в заданном канале.

import { Module } from './_base.js';

export default class AutodeleteModule extends Module {
  get key() { return 'autodelete'; }

  constructor(ctx) {
    super(ctx);
    this._timers = new Set();
  }

  async register() {
    this.logger.info({ module: 'autodelete' }, 'autodelete: registered (stub)');
  }

  async unregister() {
    for (const t of this._timers) clearTimeout(t);
    this._timers.clear();
  }

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (!message?.author || message.author.bot) return;

    const { enabled, config } = await this.getConfig(client.user.id, guildId);
    if (!enabled) return;
    if (!config.channelId || message.channel.id !== config.channelId) return;
    if (config.skipModerators && message.member?.permissions?.has('ManageMessages')) return;

    const minutes = Math.max(1, Number(config.deleteAfterMin) || 30);
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      message.delete().catch(() => {});
    }, minutes * 60 * 1000);
    this._timers.add(timer);

    this.logger.debug(
      { botId: client.user.id, guildId, messageId: message.id, minutes },
      'autodelete: scheduled',
    );
  }
}