// server/modules/levels/index.js
import { Module } from '../_base.js';
import { startVoice } from '../../core/voiceTracker.js';

import { mountCommandMethods } from './commands.js';
import { mountXpMethods } from './xp.js';
import { mountEventMethods } from './events.js';
import { mountInactivityMethods } from './inactivity.js';

const XP_FLUSH_INTERVAL_MS = 3000;

export default class LevelsModule extends Module {
  get key() { return 'levels'; }

  constructor(ctx) {
    super(ctx);

    /** Cooldown XP-начислений (per-user + type). */
    this._cooldowns = new Map();
    /** Cooldown использования команд (per-user + cmd). */
    this._useCooldowns = new Map();
    /** Кэш member-data для hot path, TTL 30 сек. */
    this._memberCache = new Map();
    this._MEMBER_CACHE_TTL = 30_000;

    /**
     * Буфер XP: накопление активности за 3 сек, затем один UPSERT.
     * Ключ: `${botId}:${guildId}:${userId}`, значение:
     *   { botId, guildId, userId, member, config, amount, createdAt, updatedAt }
     */
    this._xpBuffer = new Map();
    this._xpFlushTimer = null;

    this._tickInterval = null;
    this._inactivityInterval = null;
    this._cleanupInterval = null;
  }

  async register() {
    this._tickInterval = setInterval(() => this._voiceTick().catch(() => {}), 60_000);
    this._inactivityInterval = setInterval(() => this._inactivityTick().catch(() => {}), 60 * 60_000);
    this._cleanupInterval = setInterval(() => this._cleanup(), 10 * 60_000);

    this._xpFlushTimer = setInterval(() => {
      this._flushXpBuffer().catch((err) => {
        this.logger.warn({ err }, 'levels: xp flush failed');
      });
    }, XP_FLUSH_INTERVAL_MS);
    if (typeof this._xpFlushTimer.unref === 'function') this._xpFlushTimer.unref();

    this._restoreVoiceSessions().catch(() => {});
    this.logger.info({ module: 'levels', flushMs: XP_FLUSH_INTERVAL_MS }, 'levels: registered');
  }

  async unregister() {
    clearInterval(this._tickInterval);
    clearInterval(this._inactivityInterval);
    clearInterval(this._cleanupInterval);
    clearInterval(this._xpFlushTimer);
    this._tickInterval = null;
    this._inactivityInterval = null;
    this._cleanupInterval = null;
    this._xpFlushTimer = null;

    // Финальный flush — иначе при рестарте теряется ≤3 сек XP.
    try { await this._flushXpBuffer(); }
    catch (err) { this.logger.warn({ err }, 'levels: final xp flush failed'); }

    this._cooldowns.clear();
    this._useCooldowns.clear();
    this._memberCache.clear();
    this._xpBuffer.clear();
  }

  async _restoreVoiceSessions() {
    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady()) continue;
      for (const guild of inst.client.guilds.cache.values()) {
        const afkId = guild.afkChannelId;
        for (const [, state] of guild.voiceStates.cache) {
          const member = state.member;
          if (!member || member.user.bot) continue;
          if (!state.channelId) continue;
          if (state.channelId === afkId) continue;
          if (state.selfDeaf || state.serverDeaf) continue;
          startVoice(inst.id, guild.id, member.id, state.channelId);
        }
      }
    }
  }

  /**
   * Очищает всё, что модуль держит в памяти для конкретной гильдии.
   * Буфер XP для удалённой гильдии — drop (не flush — БД удалена).
   */
  clearGuildCooldowns(guildId) {
    if (!guildId) return;
    const gid = String(guildId);

    for (const k of this._cooldowns.keys()) {
      if (k.startsWith(`${gid}:`)) this._cooldowns.delete(k);
    }
    for (const k of this._useCooldowns.keys()) {
      if (k.startsWith(`${gid}:`)) this._useCooldowns.delete(k);
    }
    for (const k of this._memberCache.keys()) {
      if (k.includes(`:${gid}:`)) this._memberCache.delete(k);
    }
    // XP-буфер: drop, НЕ flush — БД гильдии уже удалена (иначе UPSERT создаст файл заново).
    for (const k of this._xpBuffer.keys()) {
      if (k.includes(`:${gid}:`)) this._xpBuffer.delete(k);
    }

    this.logger.debug({ guildId: gid }, 'levels: cleared guild cooldowns + xp buffer');
  }
}

mountCommandMethods(LevelsModule);
mountXpMethods(LevelsModule);
mountEventMethods(LevelsModule);
mountInactivityMethods(LevelsModule);