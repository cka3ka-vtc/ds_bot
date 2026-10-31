// server/modules/greetings.js
import { Module } from './_base.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../core/componentsBuilder.js';
import { getNonBotMemberCount } from '../core/guildCounts.js';
import { retryDiscord } from '../core/retry.js';

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
      this.logger.warn(
        { guildId, channelId: config.channelId },
        'greetings: channel invalid or foreign guild',
      );
      return;
    }

    let nonBotCount = 0;
    if (/\{count\}/.test(JSON.stringify(msgConfig))) {
      nonBotCount = await getNonBotMemberCount(member.guild, {
        force: true,
        timeout: 2000,
      }).catch(() => 0);
    }

    const tokens = {
      user: `<@${member.id}>`,
      mention: `<@${member.id}>`,
      username: member.user.username,
      displayName: member.user.globalName || member.user.username,
      avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || '',
      guild: member.guild.name,
      count: nonBotCount,
      guildIconUrl: member.guild.iconURL?.({ size: 128 }) || '',
      section: 'greetings',
    };

    let components;
    try {
      components = buildComponentsFromConfig(msgConfig, tokens);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'greetings: build failed');
      return;
    }
    if (!components?.length) return;

    try {
      await retryDiscord(
        () => channel.send({
          flags: FLAG_COMPONENTS_V2,
          components,
          allowedMentions: { parse: ['users'] },
        }),
        {
          maxAttempts: 3,
          baseDelayMs: 800,
          maxDelayMs: 8000,
          label: 'greetings.send',
          logger: this.logger,
          context: { bot_id: client.user.id, guild_id: guildId, user_id: member.id },
        },
      );
    } catch (err) {
      this.logger.warn({ err, guildId }, 'greetings: failed to send');
      return;
    }

    this.db.addLog(client.user.id, guildId, {
      level: 'info',
      module: 'greetings',
      message: `${isJoin ? 'Приветствие' : 'Прощание'} для ${member.user.username}`,
    });
  }
}