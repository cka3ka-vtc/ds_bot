// server/modules/levels/xp.js
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { xpForLevel, getLevelFromXp, progressOf } from '../../core/formulas.js';
import { getTitleForLevel } from '../../../shared/titles.js';
import { mergeLevelsConfig } from '../../../shared/levels-config.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { retryDiscord } from '../../core/retry.js';
import { mentionUser, buildAllowedMentions } from '../../core/mentions.js';

export function mountXpMethods(LevelsModule) {
  Object.assign(LevelsModule.prototype, {

    /* ═══════════════════ Cache helpers ═══════════════════ */

    _getMemberDataCached(botId, guildId, userId) {
      const k = `${botId}:${guildId}:${userId}`;
      const now = Date.now();
      const cached = this._memberCache.get(k);
      if (cached && now - cached.ts < this._MEMBER_CACHE_TTL) {
        return cached.data;
      }
      const data = this.db.getMemberData(botId, guildId, userId)
        || { xp: 0, level: 0, auto_roles: '[]' };
      this._memberCache.set(k, { data, ts: now });
      return data;
    },

    _setMemberCache(botId, guildId, userId, data) {
      this._memberCache.set(`${botId}:${guildId}:${userId}`, { data, ts: Date.now() });
    },

    _invalidateMemberCache(botId, guildId, userId) {
      this._memberCache.delete(`${botId}:${guildId}:${userId}`);
    },

    /* ═══════════════════ Public API ═══════════════════ */

    async awardCommandXp(interaction, opts = {}) {
      if (!interaction?.isChatInputCommand?.()) return;
      if (interaction.commandName === 'daily') return;

      const guildId = opts.guildId || interaction.guildId;
      const botId = opts.botId || interaction.client.user.id;
      if (!guildId) return;

      try {
        const { enabled, config: rawConfig } = await this.getConfig(botId, guildId);
        if (!enabled) return;

        const config = mergeLevelsConfig(rawConfig);
        if (!config.enabledEvents.command) return;

        if (!this._passCooldown(guildId, interaction.user.id, 'command', config.events.command.cooldownMin)) {
          return;
        }

        let member = interaction.member;
        if (!member) {
          try { member = await interaction.guild.members.fetch(interaction.user.id); } catch { return; }
        }
        if (!member) return;

        this._awardXpBuffered({
          botId, guildId, member, config,
          amount: config.events.command.xp,
        });
      } catch (err) {
        this.logger.warn({ err, botId, guildId, cmd: interaction.commandName }, 'levels.awardCommandXp failed');
      }
    },

    /* ═══════════════════ Cooldown ═══════════════════ */

    _passCooldown(guildId, userId, type, minutes) {
      if (!minutes || minutes <= 0) return true;
      const k = `${guildId}:${userId}:${type}`;
      const now = Date.now();
      const last = this._cooldowns.get(k) || 0;
      if (now - last < minutes * 60_000) return false;
      this._cooldowns.set(k, now);
      return true;
    },

    /* ═══════════════════ XP buffer ═══════════════════ */

    _awardXpBuffered({ botId, guildId, member, config, amount }) {
      if (!amount || amount <= 0) return;
      const k = `${botId}:${guildId}:${member.id}`;
      const now = Date.now();
      const existing = this._xpBuffer.get(k);

      if (existing) {
        existing.amount += amount;
        existing.member = member;
        existing.updatedAt = now;
      } else {
        this._xpBuffer.set(k, {
          botId, guildId, userId: member.id,
          member,
          config,
          amount,
          createdAt: now,
          updatedAt: now,
        });
      }
    },

    async _flushXpBuffer() {
      if (!this._xpBuffer.size) return;
      const entries = [...this._xpBuffer.values()];
      this._xpBuffer.clear();
      await this._applyEntries(entries);
    },

    async _flushXpUserSync(botId, guildId, userId) {
      const k = `${botId}:${guildId}:${userId}`;
      const entry = this._xpBuffer.get(k);
      if (!entry) return;
      this._xpBuffer.delete(k);
      await this._applyEntries([entry]);
    },

    async _flushXpGuildSync(botId, guildId) {
      const prefix = `${botId}:${guildId}:`;
      const entries = [];
      for (const [k, v] of this._xpBuffer) {
        if (k.startsWith(prefix)) {
          entries.push(v);
          this._xpBuffer.delete(k);
        }
      }
      if (!entries.length) return;
      await this._applyEntries(entries);
    },

    async _applyEntries(entries) {
      if (!entries.length) return;
      await Promise.allSettled(entries.map((entry) =>
        this._applyXpBatch(entry).catch((err) => {
          this.logger.error({
            err,
            event: 'xp_batch_apply_failed',
            bot_id: entry.botId,
            guild_id: entry.guildId,
            user_id: entry.userId,
            amount: entry.amount,
          }, 'levels: xp batch apply failed — xp lost');
        }),
      ));
    },

    /* ═══════════════════ Sync award (для /daily) ═══════════════════ */

    async _awardXp({ botId, guildId, member, config, amount }) {
      if (!amount || amount <= 0) return;
      await this._applyXpBatch({
        botId, guildId, userId: member.id,
        member, config, amount,
      });
    },

    /* ═══════════════════ Core apply ═══════════════════ */

    async _applyXpBatch({ botId, guildId, userId, member, config, amount }) {
      if (!amount || amount <= 0) return;

      const data = this._getMemberDataCached(botId, guildId, userId);
      const oldXp = data.xp | 0;
      const oldLevel = data.level | 0;

      const boost = member?.premiumSince ? config.boostMultiplier : 1;
      const gained = Math.round(amount * boost);

      const maxXp = xpForLevel(config.maxLevel, config.formula, config);
      const newXp = Math.min(oldXp + gained, maxXp);
      const newLevel = getLevelFromXp(newXp, config.formula, config, config.maxLevel);

      const currentAuto = new Set(this._parseAutoRoles(data.auto_roles));
      const granted = [];

      if (config.rewards.enabled && member) {
        const desired = new Set();
        for (const r of config.rewards.entries) {
          if (Number(r.level) <= newLevel && r.roleId) desired.add(r.roleId);
        }
        for (const roleId of desired) {
          const memberHasIt = member.roles.cache.has(roleId);
          const alreadyMarked = currentAuto.has(roleId);
          if (memberHasIt && alreadyMarked) continue;
          if (memberHasIt && !alreadyMarked) { currentAuto.add(roleId); continue; }
          try {
            await member.roles.add(roleId);
            granted.push(roleId);
            currentAuto.add(roleId);
          } catch (err) {
            this.logger.warn({ err, roleId, userId }, 'levels: role grant failed');
          }
        }
      }

      this.db.updateXp(botId, guildId, userId, {
        xp: newXp, level: newLevel, autoRoles: [...currentAuto],
      });

      this._setMemberCache(botId, guildId, userId, {
        ...data,
        xp: newXp,
        level: newLevel,
        auto_roles: JSON.stringify([...currentAuto]),
      });

      if (newLevel > oldLevel) {
        try {
          this.db.addLog(botId, guildId, {
            level: 'info',
            module: 'levels',
            userId: member.id,
            message: `достиг ${newLevel} уровня`,
            meta: {
              userId: member.id,
              username: member.user.username,
              displayName: member.displayName || member.user.globalName || member.user.username,
              avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || null,
              level: newLevel,
              oldLevel,
              xp: newXp,
            },
          });
        } catch (err) {
          this.logger.warn({ err, userId }, 'levels: level-up log failed');
        }

        if (member && config.announceChannelId && config.messages?.levelUp) {
          await this._sendLevelUp({
            botId, guildId, member, config,
            oldLevel, newLevel, newXp, grantedRoles: granted,
          });
        }
      }
    },

    async _sendLevelUp({ botId, guildId, member, config, oldLevel, newLevel, newXp, grantedRoles }) {
      if (!member) return;

      const inst = this.botManager.get(botId);
      if (!inst?.client?.isReady()) return;
      const channel = await inst.client.channels.fetch(config.announceChannelId).catch(() => null);
      if (!channel?.isTextBased?.() || channel.guild.id !== guildId) return;

      let count = 0;
      if (/\{count\}/.test(JSON.stringify(config.messages.levelUp))) {
        count = await getNonBotMemberCount(member.guild).catch(() => 0);
      }

      const progress = progressOf(newXp, newLevel, config.formula, config);
      const nextLevelTotalXp = xpForLevel(newLevel + 1, config.formula, config);
      const title = getTitleForLevel(newLevel, config.titles);
      const position = this.db.getUserRank(botId, guildId, member.id);

      const granted = (grantedRoles || [])
        .filter((id) => config.rewards.entries.some((r) => r.roleId === id && Number(r.level) === newLevel))
        .map((id) => `<@&${id}>`);

      const tokens = {
        user: mentionUser(member.id),
        mention: mentionUser(member.id),
        username: member.user.username,
        displayName: member.displayName || member.user.globalName || member.user.username,
        avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || '',
        guild: member.guild.name,
        count,
        guildIconUrl: member.guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
        level: newLevel,
        oldLevel,
        title,
        xp: newXp,
        nextLevelXp: nextLevelTotalXp,
        xpToNext: progress.toNext,
        progress: `${progress.current} / ${progress.total}`,
        progressPercent: progress.percent,
        position,
        rank: position,
        rewardRole: granted.join(', '),
      };

      let components;
      try {
        components = buildComponentsFromConfig(config.messages.levelUp, tokens);
      } catch (err) {
        this.logger.warn({ err, botId, guildId }, 'levels: announce build failed');
        return;
      }
      if (!components?.length) return;

      try {
        await retryDiscord(
          () => channel.send({
            flags: FLAG_COMPONENTS_V2,
            components,
            allowedMentions: buildAllowedMentions(components, { ping: true }),
          }),
          {
            maxAttempts: 3,
            baseDelayMs: 800,
            maxDelayMs: 8000,
            label: 'levels.sendLevelUp',
            logger: this.logger,
            context: { bot_id: botId, guild_id: guildId, user_id: member.id },
          },
        );
      } catch (err) {
        this.logger.warn({ err, guildId }, 'levels: announce failed');
      }
    },

  });
}