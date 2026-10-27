// server/modules/birthdays.js
import { Module } from './_base.js';

/**
 * Дни рождения — заглушка. Поздравления и роль именинника.
 */
export default class BirthdaysModule extends Module {
  get key() {
    return 'birthdays';
  }

  async register() {
    this.logger.info({ module: 'birthdays' }, 'birthdays: stub registered (cron not implemented)');
  }

  async onEvent(_event) {}
}