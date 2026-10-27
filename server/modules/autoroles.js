// server/modules/autoroles.js
import { Module } from './_base.js';

/**
 * Автороли — заглушка. Выдача ролей при входе и по реакциям.
 */
export default class AutorolesModule extends Module {
  get key() {
    return 'autoroles';
  }

  async onEvent({ event, client, guildId, member, reaction, user }) {
    if (event === 'guildMemberAdd') {
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
      return;
    }

    if (event === 'messageReactionAdd') {
      // TODO: обработка реакций → роли (требует настройки mapping)
      this.logger.debug(
        { botId: client.user.id, guildId, emoji: reaction?.emoji?.name, userId: user?.id },
        'autoroles: reaction received (stub)',
      );
    }
  }
}