// server/modules/messages.js
import { Module } from './_base.js';

/**
 * Сообщения (Components v2) — заглушка.
 * Реагирует на interactionCreate, но ничего не отправляет.
 */
export default class MessagesModule extends Module {
  get key() {
    return 'messages';
  }

  async onEvent({ event, client, guildId, interaction }) {
    if (event !== 'interactionCreate') return;
    if (!interaction.isButton?.() && !interaction.isStringSelectMenu?.()) return;

    this.logger.debug(
      { botId: client.user.id, guildId, customId: interaction.customId },
      'messages: component interaction (stub)',
    );
  }
}