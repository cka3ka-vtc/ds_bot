// server/modules/sticky.js
import { Module } from './_base.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../core/componentsBuilder.js';
import { buildAllowedMentions } from '../core/mentions.js';
import { retryDiscord } from '../core/retry.js';

export default class StickyModule extends Module {
  get key() { return 'sticky'; }

  constructor(ctx) {
    super(ctx);
    // IDs сообщений, которые мы удаляем сами — чтобы не триггерить repost
    this._deletingIds = new Set();
  }

  async register() {
    this.logger.info({ module: 'sticky' }, 'sticky: registered');
  }

  async onEvent({ event, client, guildId, message }) {
    if (event === 'messageCreate') {
      return this._onMessageCreate({ client, guildId, message });
    }
    if (event === 'messageDelete') {
      return this._onMessageDelete({ client, guildId, message });
    }
  }

  async _onMessageCreate({ client, guildId, message }) {
    if (!message?.channel || !message.guild) return;
    if (message.author.bot) return;

    let list = [];
    try {
      list = this.db.listStickyByChannel(client.user.id, guildId, message.channel.id);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'sticky: list failed');
      return;
    }
    if (!list.length) return;

    for (const sticky of list) {
      try {
        await this._refreshSticky(client, message.guild, sticky);
      } catch (err) {
        this.logger.warn({ err, stickyId: sticky.id }, 'sticky: refresh failed');
      }
    }
  }

  async _onMessageDelete({ client, guildId, message }) {
    if (!message?.channel || !message.guild) return;
    // Игнорируем наши собственные удаления
    if (this._deletingIds.has(message.id)) return;

    try {
      const list = this.db.listStickyByChannel(client.user.id, guildId, message.channel.id);
      const ours = list.find((s) => s.lastMessageId === message.id);
      if (!ours) return;

      // Sticky удалён вручную — переопубликовываем
      this.logger.info(
        { guildId, stickyId: ours.id, messageId: message.id },
        'sticky: message was deleted — reposting',
      );
      await this._refreshSticky(client, message.guild, ours);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'sticky: repost on delete failed');
    }
  }

  async _refreshSticky(client, guild, sticky) {
    const channel = guild.channels.cache.get(sticky.channelId)
      || await client.channels.fetch(sticky.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    if (sticky.lastMessageId) {
      // Помечаем ID, чтобы messageDelete от нашего же удаления не триггерил repost
      this._deletingIds.add(sticky.lastMessageId);
      try {
        const old = await channel.messages.fetch(sticky.lastMessageId).catch(() => null);
        if (old) await old.delete().catch(() => {});
      } finally {
        setTimeout(() => this._deletingIds.delete(sticky.lastMessageId), 5000);
      }
    }

    const tokens = {
      guild: guild.name,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      count: guild.memberCount || 0,
    };

    const components = buildComponentsFromConfig(sticky.messageConfig, tokens);
    if (!components?.length) return;

    const sent = await retryDiscord(
      () => channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: buildAllowedMentions(components, { ping: false }),
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 800,
        maxDelayMs: 8000,
        label: 'sticky.refresh',
        logger: this.logger,
        context: { bot_id: client.user.id, guild_id: guild.id, sticky_id: sticky.id },
      },
    );

    if (sent?.id) {
      this.db.setStickyLastMessage(client.user.id, guild.id, sticky.id, sent.id);
    }
  }
}