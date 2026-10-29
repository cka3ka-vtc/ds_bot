// server/modules/scheduled.js
// Стаб. Отложенные сообщения будут реализованы через очередь в БД.

import { Module } from './_base.js';

export default class ScheduledModule extends Module {
  get key() { return 'scheduled'; }

  async register() {
    this.logger.info(
      { module: 'scheduled' },
      'scheduled: registered (stub — queue not implemented)',
    );
  }

  async onEvent(_event) {
    // Ничего
  }
}