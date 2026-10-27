// server/modules/events.js
import { Module } from './_base.js';

/**
 * События — заглушка. Планировщик ивентов и напоминаний.
 */
export default class EventsModule extends Module {
  get key() {
    return 'events';
  }

  // Модуль работает по расписанию (setInterval), но пока ничего не делает.
  async register() {
    this.logger.info({ module: 'events' }, 'events: stub registered (scheduler not implemented)');
  }

  async onEvent(_event) {
    // Ничего — событий нет, пока не реализован планировщик.
  }
}