// server/modules/sticky.js
import { Module } from './_base.js';
import { sendMessageConfig } from '../core/message-sender.js';
import { TtlCache } from '../core/ttl-cache.js';

const STICKY_CACHE_TTL = 60_000;

export default class StickyModule extends Module {
  get key() { return 'sticky'; }

  constructor(ctx) {
    super(ctx);
    this._deletingIds = new Set();
    this._rulesCache = new TtlCache({ ttl: STICKY_CACHE_TTL, maxSize: 5000 });
  }

  async register() {
    this.logger.info({ module: 'sticky' }, 'sticky: registered');
  }

  invalidateChannelCache(botId, guildId, channelId) {
    this._rulesCache.delete(`${botId}:${guildId}:${channelId}`);
  }

  _getChannelRules(client, guildId, channelId) {
    const k = `${client.user.id}:${guildId}:${channelId}`;
    const cached = this._rulesCache.get(k);
    if (cached) return cached;

    let list = [];
    try {
      list = this.db.listStickyByChannel(client.user.id, guildId, channelId);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'sticky: list failed');
    }
    this._rulesCache.set(k, list);
    return list;
  }

  async onEvent({ event, client, guildId, message }) {
    if (event === 'messageCreate') return this._onMessageCreate({ client, guildId, message });
    if (event === 'messageDelete') return this._onMessageDelete({ client, guildId, message });
  }

  async _onMessageCreate({ client, guildId, message }) {
    if (!message?.channel || !message.guild) return;
    if (message.author.bot) return;

    const list = this._getChannelRules(client, guildId, message.channel.id);
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
    if (this._deletingIds.has(message.id)) return;

    try {
      const list = this._getChannelRules(client, guildId, message.channel.id);
      const ours = list.find((s) => s.lastMessageId === message.id);
      if (!ours) return;

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

    try {
      const sent = await sendMessageConfig(channel, sticky.messageConfig, tokens, {
        ping: false,
        label: 'sticky.refresh',
        logger: this.logger,
        context: { bot_id: client.user.id, guild_id: guild.id, sticky_id: sticky.id },
      });
      if (sent?.id) {
        this.db.setStickyLastMessage(client.user.id, guild.id, sticky.id, sent.id);
      }
    } catch (err) {
      this.logger.warn({ err, stickyId: sticky.id }, 'sticky: refresh failed');
    }
  }
}