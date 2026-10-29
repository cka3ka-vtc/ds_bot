// server/modules/birthdays.js
// Стаб. Планировщик поздравлений пока не реализован.

import { Module } from './_base.js';

export default class BirthdaysModule extends Module {
  get key() { return 'birthdays'; }

  async register() {
    this.logger.info(
      { module: 'birthdays' },
      'birthdays: registered (stub — scheduler not implemented)',
    );
  }

  async onEvent(_event) {
    // Ничего — событий не обрабатывает
  }
}