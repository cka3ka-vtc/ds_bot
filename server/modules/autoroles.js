// server/modules/autoroles.js
// Стаб. Реализация реакций появится позже вместе с событиями эмодзи.
// Сейчас модуль явно сообщает о своём состоянии в логах.

import { Module } from './_base.js';

export default class AutorolesModule extends Module {
  get key() { return 'autoroles'; }

  async register() {
    this.logger.info(
      { module: 'autoroles' },
      'autoroles: registered (stub — reaction-roles not implemented)',
    );
  }

  async onEvent({ event, client, guildId, member }) {
    if (event !== 'guildMemberAdd') return;

    const { enabled, config } = await this.getConfig(client.user.id, guildId);
    if (!enabled || !config.joinRoleId) return;

    try {
      await member.roles.add(config.joinRoleId);
      this.logger.info(
        { botId: client.user.id, guildId, userId: member.id, roleId: config.joinRoleId },
        'autoroles: role added on join',
      );
    } catch (err) {
      this.logger.warn(
        { err, guildId, roleId: config.joinRoleId },
        'autoroles: failed to add join role',
      );
    }
  }
}