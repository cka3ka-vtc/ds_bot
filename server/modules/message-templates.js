// server/modules/message-templates.js
import { Module } from './_base.js';

/**
 * Модуль «Сообщения» — заготовленные шаблоны.
 * Не имеет собственной логики событий: создание/отправка идёт через API.
 * Класс-маркер для регистрации в manifest.
 */
export default class MessageTemplatesModule extends Module {
  get key() { return 'message-templates'; }

  async register() {
    this.logger.info({ module: 'message-templates' }, 'message-templates: registered');
  }
}