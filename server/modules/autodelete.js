// server/modules/autodelete.js
import { Module } from './_base.js';
import { delayToSeconds } from '../../shared/autodelete-config.js';

const TICK_INTERVAL_MS = 30_000;

export default class AutodeleteModule extends Module {
  get key() { return 'autodelete'; }

  constructor(ctx) {
    super(ctx);
    this._tickInterval = null;
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

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (!message?.channel || !message.guild) return;
    if (message.author.bot && message.author.id === client.user.id) return;

    let rules = [];
    try {
      rules = this.db.listAutodeleteRulesByChannel(client.user.id, guildId, message.channel.id);
    } catch (err) {
      this.logger.warn({ err, guildId }, 'autodelete: list rules failed');
      return;
    }
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

    // mode === 'after'
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
              // Фиксируем время последнего удаления для правила канала
              try {
                const rules = this.db.listAutodeleteRulesByChannel(inst.id, guild.id, d.channelId);
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