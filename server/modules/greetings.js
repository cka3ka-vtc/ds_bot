// server/modules/greetings.js
import { Module } from './_base.js';
import { getNonBotMemberCount } from '../core/guildCounts.js';
import { sendMessageConfig } from '../core/message-sender.js';

export default class GreetingsModule extends Module {
  get key() { return 'greetings'; }

  async onEvent({ event, client, guildId, member }) {
    if (event !== 'guildMemberAdd' && event !== 'guildMemberRemove') return;
    if (!member || !member.user || member.user.bot) return;
    if (!guildId) return;

    const { enabled, config } = await this.getConfig(client.user.id, guildId);
    if (!enabled) return;

    const isJoin = event === 'guildMemberAdd';
    if (isJoin && !config?.events?.join) return;
    if (!isJoin && !config?.events?.leave) return;

    const msgConfig = config?.messages?.[isJoin ? 'join' : 'leave'];
    if (!config?.channelId || !msgConfig) return;

    const channel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!channel?.isTextBased?.() || channel.guild.id !== guildId) {
      this.logger.warn({ guildId, channelId: config.channelId }, 'greetings: channel invalid');
      return;
    }

    let nonBotCount = 0;
    if (/\{count\}/.test(JSON.stringify(msgConfig))) {
      nonBotCount = await getNonBotMemberCount(member.guild, { force: true, timeout: 2000 }).catch(() => 0);
    }

    const tokens = {
      user: `<@${member.id}>`,
      mention: `<@${member.id}>`,
      username: member.user.username,
      displayName: member.displayName || member.user.globalName || member.user.username,
      avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || '',
      guild: member.guild.name,
      count: nonBotCount,
      guildIconUrl: member.guild.iconURL?.({ size: 128 }) || '',
      section: 'greetings',
    };

    try {
      await sendMessageConfig(channel, msgConfig, tokens, {
        ping: true,
        label: 'greetings.send',
        logger: this.logger,
        context: { bot_id: client.user.id, guild_id: guildId, user_id: member.id },
      });
    } catch (err) {
      this.logger.warn({ err, guildId }, 'greetings: failed to send');
    }
  }
}