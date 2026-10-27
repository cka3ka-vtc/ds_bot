// server/modules/levels.js
import { Module } from './_base.js';

/**
 * Уровни — заглушка. Включается в UI, но не обрабатывает события.
 * Заготовка для будущей реализации XP/уровней.
 */
export default class LevelsModule extends Module {
  get key() {
    return 'levels';
  }

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    const { enabled, config } = await this.getConfig(
      message.client.user.id,
      guildId,
    );
    if (!enabled) return;

    // TODO: реализовать начисление XP и проверку уровня.
    // Пока — только лог-запись для отладки.
    this.logger.debug(
      { botId: client.user.id, guildId, userId: message.author.id },
      'levels: message received (stub)',
    );
  }
}