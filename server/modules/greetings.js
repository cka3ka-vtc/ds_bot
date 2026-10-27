// server/modules/greetings.js
import { EmbedBuilder } from 'discord.js';
import { Module } from './_base.js';

/**
 * Приветствия — полноценно работает:
 *  - отправляет приветствие в канал
 *  - выдаёт роль при входе
 *  - поддерживает embed и обычный текст
 *  - понимает переменные {user}, {count}, {guild}
 */
export default class GreetingsModule extends Module {
  get key() {
    return 'greetings';
  }

  async onEvent({ event, client, guildId, member }) {
    if (event !== 'guildMemberAdd') return;

    const { enabled, config } = await this.getConfig(client.user.id, guildId);
    if (!enabled || !config.channelId) return;

    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      this.logger.warn({ guildId, channelId: config.channelId }, 'greetings: invalid channel');
      return;
    }

    const text = String(config.message || 'Привет, {user}! 👋')
      .replaceAll('{user}', `<@${member.id}>`)
      .replaceAll('{count}', String(member.guild.memberCount))
      .replaceAll('{guild}', member.guild.name);

    try {
      if (config.sendEmbed) {
        const embed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('👋 Добро пожаловать!')
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send({ content: text });
      }
    } catch (err) {
      this.logger.warn({ err, guildId }, 'greetings: failed to send message');
    }

    if (config.autoRoleId) {
      try {
        await member.roles.add(config.autoRoleId);
      } catch (err) {
        this.logger.warn(
          { err, guildId, roleId: config.autoRoleId },
          'greetings: failed to add auto-role',
        );
      }
    }

    this.db.addLog({
      botId: client.user.id,
      guildId,
      level: 'info',
      module: 'greetings',
      message: `Приветствие для ${member.user.username}`,
    });
  }
}