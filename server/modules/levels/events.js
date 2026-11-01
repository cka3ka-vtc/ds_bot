// server/modules/levels/events.js
import { mergeLevelsConfig } from '../../../shared/levels-config.js';
import {
  startVoice, stopVoice, getActiveSessions, touchAward,
} from '../../core/voiceTracker.js';

export function mountEventMethods(LevelsModule) {
  Object.assign(LevelsModule.prototype, {

    async onEvent({ event, client, guildId, message, oldState, newState }) {
      if (!guildId) return;
      const botId = client.user.id;
      const { enabled, config: rawConfig } = await this.getConfig(botId, guildId);
      if (!enabled) return;
      const config = mergeLevelsConfig(rawConfig);

      switch (event) {
        case 'messageCreate':    return this._onMessage({ botId, guildId, message, config });
        case 'voiceStateUpdate': return this._onVoice({ botId, guildId, oldState, newState, config });
      }
    },

    async _onMessage({ botId, guildId, message, config }) {
      if (!config.enabledEvents.message) return;
      if (!message?.guild || !message.member) return;
      if (message.author.bot) return;
      if (config.excludedChannels.includes(message.channel.id)) return;
      if (config.excludedChannels.includes(message.channel.parentId)) return;
      if (message.member.roles?.cache?.some?.((r) => config.excludedRoles.includes(r.id))) return;

      if (!this._passCooldown(guildId, message.author.id, 'message', config.events.message.cooldownMin)) return;

      // Hot path: кладём в буфер, реальная запись — раз в 3 сек.
      this._awardXpBuffered({
        botId, guildId,
        member: message.member,
        config,
        amount: config.events.message.xp,
      });
    },

    async _onVoice({ botId, guildId, oldState, newState, config }) {
      if (!config.enabledEvents.voice) return;
      const member = newState.member || oldState.member;
      if (!member || member.user.bot) return;
      const wasIn = !!oldState.channelId;
      const isIn = !!newState.channelId;
      const isAfk = newState.channel?.id === newState.guild.afkChannelId;
      const isMuted = newState.selfDeaf || newState.serverDeaf;
      const shouldTrack = isIn && !isAfk && !isMuted;

      if (shouldTrack) {
        startVoice(botId, guildId, member.id, newState.channelId);
        if (wasIn && oldState.channelId !== newState.channelId) {
          touchAward(botId, guildId, member.id);
        }
      } else {
        stopVoice(botId, guildId, member.id);
      }
    },

    async _voiceTick() {
      for (const s of getActiveSessions()) {
        try {
          const { enabled, config: rawConfig } = await this.getConfig(s.botId, s.guildId);
          if (!enabled) { stopVoice(s.botId, s.guildId, s.userId); continue; }
          const config = mergeLevelsConfig(rawConfig);
          if (!config.enabledEvents.voice) { stopVoice(s.botId, s.guildId, s.userId); continue; }

          const inst = this.botManager.get(s.botId);
          const guild = inst?.client?.guilds?.cache?.get(s.guildId);
          if (!guild) { stopVoice(s.botId, s.guildId, s.userId); continue; }

          const voiceState = guild.voiceStates.cache.get(s.userId);
          if (!voiceState?.channelId) { stopVoice(s.botId, s.guildId, s.userId); continue; }
          if (voiceState.channelId === guild.afkChannelId) { stopVoice(s.botId, s.guildId, s.userId); continue; }
          if (voiceState.selfDeaf || voiceState.serverDeaf) { stopVoice(s.botId, s.guildId, s.userId); continue; }

          const member = guild.members.cache.get(s.userId);
          if (!member) { stopVoice(s.botId, s.guildId, s.userId); continue; }

          const minGap = config.events.voice.cooldownMin * 60_000;
          const firstTick = s.lastAwardAt === 0;
          const shouldAward = firstTick
            ? Date.now() - s.startedAt >= minGap
            : Date.now() - s.lastAwardAt >= minGap;

          if (!shouldAward) continue;

          // Голос идёт раз в `cooldownMin` минут — буфер тоже подходит
          // (за 3 сек не будет больше 1 тика на юзера).
          this._awardXpBuffered({
            botId: s.botId, guildId: s.guildId,
            member, config,
            amount: config.events.voice.xp,
          });
          touchAward(s.botId, s.guildId, s.userId);
        } catch (err) {
          this.logger.warn({ err, userId: s.userId }, 'levels: voice tick failed');
        }
      }
    },

  });
}