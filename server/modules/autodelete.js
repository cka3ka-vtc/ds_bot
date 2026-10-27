// server/modules/autodelete.js
import { Module } from './_base.js';

/**
 * Автоудаление — заглушка. Удаление сообщений по таймеру.
 */
export default class AutodeleteModule extends Module {
  get key() {
    return 'autodelete';
  }

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (message.author.bot) return;

    const { enabled, config } = await this.getConfig(client.user.id, guildId);
    if (!enabled) return;
    if (!config.channelId || message.channel.id !== config.channelId) return;

    // Исключение для модераторов
    if (config.skipModerators && message.member?.permissions?.has('ManageMessages')) {
      return;
    }

    const minutes = Number(config.deleteAfterMin) || 30;
    setTimeout(() => {
      message.delete().catch(() => {});
    }, minutes * 60 * 1000);

    this.logger.debug(
      { botId: client.user.id, guildId, messageId: message.id, minutes },
      'autodelete: scheduled',
    );
  }
}