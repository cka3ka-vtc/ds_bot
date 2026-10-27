// server/modules/scheduled.js
import { Module } from './_base.js';

/**
 * Отложенные сообщения — заглушка. В будущем: планировщик через БД.
 */
export default class ScheduledModule extends Module {
  get key() {
    return 'scheduled';
  }

  async register() {
    this.logger.info({ module: 'scheduled' }, 'scheduled: stub registered (cron not implemented)');
  }

  async onEvent(_event) {}
}