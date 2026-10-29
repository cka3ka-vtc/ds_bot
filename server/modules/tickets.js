// server/modules/tickets.js
// Стаб. Отвечает на /ticket placeholder-сообщением.

import { MessageFlags } from 'discord.js';
import { Module } from './_base.js';

export default class TicketsModule extends Module {
  get key() { return 'tickets'; }

  async register() {
    this.logger.info({ module: 'tickets' }, 'tickets: registered (stub)');
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
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      this.logger.error({ err, guildId }, 'tickets: reply failed');
    }
  }
}