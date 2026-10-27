// server/modules/tickets.js
import { Module } from './_base.js';

/**
 * Тикеты — заглушка. Реагирует на /ticket как placeholder.
 * В будущем: создание приватных каналов, ролей поддержки, автозакрытие.
 */
export default class TicketsModule extends Module {
  get key() {
    return 'tickets';
  }

  async onEvent({ event, client, guildId, interaction }) {
    if (event !== 'interactionCreate') return;
    if (!interaction.isChatInputCommand?.()) return;
    if (interaction.commandName !== 'ticket') return;

    const { enabled } = await this.getConfig(client.user.id, guildId);
    if (!enabled) return;

    try {
      await interaction.reply({
        content: '🎫 Система тикетов пока в разработке. Скоро!',
        ephemeral: true,
      });
    } catch (err) {
      this.logger.error({ err, guildId }, 'tickets: reply failed');
    }
  }
}