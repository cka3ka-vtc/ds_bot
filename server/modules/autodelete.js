// server/modules/autodelete.js
import { Module } from './_base.js';
import { delayToSeconds } from '../../shared/autodelete-config.js';
import { TtlCache } from '../core/ttl-cache.js';

const TICK_INTERVAL_MS = 30_000;
const RULES_CACHE_TTL  = 60_000;

export default class AutodeleteModule extends Module {
  get key() { return 'autodelete'; }

  constructor(ctx) {
    super(ctx);
    this._tickInterval = null;
    // ФИКС: кэш правил канала. Раньше db.listAutodeleteRulesByChannel() на
    // каждое сообщение. TTL 60s + инвалидация из routes/autodelete.js.
    this._rulesCache = new TtlCache({ ttl: RULES_CACHE_TTL, maxSize: 5000 });
  }

  async register() {
    this._tickInterval = setInterval(() => {
      this._tick().catch((err) => {
        this.logger.warn({ err }, 'autodelete: tick failed');
      });
    }, TICK_INTERVAL_MS);
    this._tickInterval.unref?.();

    this.logger.info({ module: 'autodelete', tickMs: TICK_INTERVAL_MS }, 'autodelete: registered');
  }

  async unregister() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
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
      list = this.db.listAutodeleteRulesByChannel(client.user.id, guildId, channelId);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'autodelete: list rules failed');
    }
    this._rulesCache.set(k, list);
    return list;
  }

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (!message?.channel || !message.guild) return;
    if (message.author.bot && message.author.id === client.user.id) return;

    const rules = this._getChannelRules(client, guildId, message.channel.id);
    if (!rules.length) return;

    const rule = rules[0];

    if (rule.mode === 'instant') {
      try {
        await message.delete();
        try { this.db.touchAutodeleteLastDeleted(client.user.id, guildId, rule.id); } catch {}
      } catch (err) {
        this.logger.warn(
          { err, guildId, channelId: message.channel.id },
          'autodelete: instant delete failed',
        );
      }
      return;
    }

    const delaySec = delayToSeconds(rule.delayValue, rule.delayUnit);
    const deleteAt = Math.floor(Date.now() / 1000) + delaySec;

    try {
      this.db.scheduleAutodelete(
        client.user.id, guildId, message.id, message.channel.id, deleteAt,
      );
    } catch (err) {
      this.logger.warn(
        { err, guildId, messageId: message.id },
        'autodelete: schedule failed',
      );
    }
  }

  async _tick() {
    const now = Math.floor(Date.now() / 1000);

    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady?.()) continue;

      for (const guild of inst.client.guilds.cache.values()) {
        let due = [];
        try {
          due = this.db.popDueAutodeletions(inst.id, guild.id, now);
        } catch (err) {
          this.logger.debug({ err, guildId: guild.id }, 'autodelete: pop failed');
          continue;
        }
        if (!due.length) continue;

        for (const d of due) {
          try {
            const channel = guild.channels.cache.get(d.channelId)
              || await inst.client.channels.fetch(d.channelId).catch(() => null);
            if (!channel?.isTextBased?.()) continue;

            const msg = await channel.messages.fetch(d.messageId).catch(() => null);
            if (msg) {
              await msg.delete();
              try {
                const rules = this._getChannelRules(inst.client, guild.id, d.channelId);
                if (rules[0]) {
                  this.db.touchAutodeleteLastDeleted(inst.id, guild.id, rules[0].id);
                }
              } catch {}
            }
          } catch (err) {
            this.logger.debug(
              { err, messageId: d.messageId, channelId: d.channelId },
              'autodelete: delete failed',
            );
          }
        }
      }
    }
  }
}