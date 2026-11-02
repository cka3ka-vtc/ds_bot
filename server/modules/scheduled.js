// server/modules/scheduled.js
import { Module } from './_base.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../core/componentsBuilder.js';
import { buildAllowedMentions } from '../core/mentions.js';
import { retryDiscord } from '../core/retry.js';

const TICK_INTERVAL_MS = 30_000;

export default class ScheduledModule extends Module {
  get key() { return 'scheduled'; }

  constructor(ctx) {
    super(ctx);
    this._tickInterval = null;
  }

  async register() {
    this._tickInterval = setInterval(() => {
      this._tick().catch((err) => {
        this.logger.warn({ err }, 'scheduled: tick failed');
      });
    }, TICK_INTERVAL_MS);
    this._tickInterval.unref?.();

    this.logger.info({ module: 'scheduled', tickMs: TICK_INTERVAL_MS }, 'scheduled: registered');
  }

  async unregister() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  async _tick() {
    const now = Math.floor(Date.now() / 1000);

    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady?.()) continue;

      for (const guild of inst.client.guilds.cache.values()) {
        let due = [];
        try {
          due = this.db.getDueScheduled(inst.id, guild.id, now);
        } catch (err) {
          this.logger.debug({ err, guildId: guild.id }, 'scheduled: fetch due failed');
          continue;
        }
        if (!due.length) continue;

        for (const item of due) {
          await this._sendItem(inst, guild, item);
        }
      }
    }
  }

  async _sendItem(inst, guild, item) {
    const { id, channelId, messageConfig } = item;
    const botId = inst.id;

    const channel = guild.channels.cache.get(channelId)
      || await inst.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) {
      this.db.markScheduledError(botId, guild.id, id, 'channel_invalid');
      return;
    }

    const tokens = {
      guild: guild.name,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      count: guild.memberCount || 0,
    };
    const components = buildComponentsFromConfig(messageConfig, tokens);
    if (!components?.length) {
      this.db.markScheduledError(botId, guild.id, id, 'empty_message');
      return;
    }

    try {
      const msg = await retryDiscord(
        () => channel.send({
          flags: FLAG_COMPONENTS_V2,
          components,
          allowedMentions: buildAllowedMentions(components, { ping: false }),
        }),
        {
          maxAttempts: 3,
          baseDelayMs: 800,
          maxDelayMs: 8000,
          label: 'scheduled.auto.send',
          logger: this.logger,
          context: { bot_id: botId, guild_id: guild.id, scheduled_id: id },
        },
      );

      this.db.markScheduledSent(botId, guild.id, id, Math.floor(Date.now() / 1000));
      this.logger.info(
        { botId, guildId: guild.id, scheduledId: id, messageId: msg.id },
        'scheduled: sent',
      );
    } catch (err) {
      this.db.markScheduledError(botId, guild.id, id, err.message);
      this.logger.warn({ err, scheduledId: id }, 'scheduled: auto send failed');
    }
  }
}