// server/modules/events.js
// Стаб. Планировщик ивентов пока не реализован.

import { Module } from './_base.js';

export default class EventsModule extends Module {
  get key() { return 'events'; }

  async register() {
    this.logger.info(
      { module: 'events' },
      'events: registered (stub — scheduler not implemented)',
    );
  }

  async onEvent(_event) {
    // Ничего
  }
}