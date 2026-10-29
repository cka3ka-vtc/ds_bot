// server/modules/levels.js
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { Module } from './_base.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../core/componentsBuilder.js';
import { getNonBotMemberCount } from '../core/guildCounts.js';
import { xpForLevel, getLevelFromXp, progressOf } from '../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../shared/titles.js';
import {
  startVoice, stopVoice, getActiveSessions, touchAward,
} from '../core/voiceTracker.js';

function normalizeEvents(rawEvents) {
  const fallback = { message: 1, command: 2, voice: 5 };
  const out = {};
  for (const key of ['message', 'command', 'voice']) {
    const ev = rawEvents?.[key] || {};
    let min = ev.cooldownMin;
    if (min == null) {
      min = ev.cooldownSec != null ? Math.max(1, Math.round(ev.cooldownSec / 60)) : fallback[key];
    }
    out[key] = { xp: ev.xp ?? 0, cooldownMin: Math.max(1, min) };
  }
  return out;
}

function normalizeConfig(raw) {
  const cfg = structuredClone(raw || {});
  cfg.enabledEvents = { message: true, command: true, voice: true, ...(cfg.enabledEvents || {}) };
  cfg.events = normalizeEvents(cfg.events);
  cfg.announceChannelId = cfg.announceChannelId || '';
  cfg.formula = cfg.formula === 'linear' ? 'linear' : 'classic';
  cfg.linearBase = cfg.linearBase ?? 100;
  cfg.maxLevel = cfg.maxLevel ?? 100;
  cfg.boostMultiplier = cfg.boostMultiplier ?? 2;
  cfg.excludedChannels = Array.isArray(cfg.excludedChannels) ? cfg.excludedChannels : [];
  cfg.excludedRoles = Array.isArray(cfg.excludedRoles) ? cfg.excludedRoles : [];
  cfg.titles = Array.isArray(cfg.titles) && cfg.titles.length
    ? cfg.titles
    : structuredClone(DEFAULT_TITLES);

  const isOldDailyDefault =
    (cfg.dailyXp === undefined || cfg.dailyXp === 50) &&
    (cfg.dailyEnabled === undefined || cfg.dailyEnabled === false);
  if (isOldDailyDefault) {
    cfg.dailyEnabled = true;
    cfg.dailyXp = 150;
  } else {
    cfg.dailyEnabled = !!cfg.dailyEnabled;
    cfg.dailyXp = cfg.dailyXp ?? 150;
  }

  cfg.rewards = {
    enabled: cfg.rewards?.enabled !== false,
    entries: Array.isArray(cfg.rewards?.entries) ? cfg.rewards.entries : [],
  };
  cfg.inactivity = {
    enabled: false, days: 30, penaltyXp: 50, removeRolesOnDecrease: false,
    ...(cfg.inactivity || {}),
  };
  return cfg;
}

export default class LevelsModule extends Module {
  get key() { return 'levels'; }

  constructor(ctx) {
    super(ctx);
    this._cooldowns = new Map();
    this._tickInterval = null;
    this._inactivityInterval = null;
    this._cleanupInterval = null;
  }

  async register() {
    this._tickInterval = setInterval(() => this._voiceTick().catch(() => {}), 60_000);
    this._inactivityInterval = setInterval(() => this._inactivityTick().catch(() => {}), 60 * 60_000);
    this._cleanupInterval = setInterval(() => this._cleanup(), 10 * 60_000);
    this.logger.info({ module: 'levels' }, 'levels: registered');
  }

  async unregister() {
    clearInterval(this._tickInterval);
    clearInterval(this._inactivityInterval);
    clearInterval(this._cleanupInterval);
    this._cooldowns.clear();
  }

  /* ─── Slash-команды ─── */
  async handleCommand(interaction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      return interaction.reply({
        content: '⚠ Команда доступна только на сервере',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }

    const botId = interaction.client.user.id;
    const { enabled, config: rawConfig } = await this.getConfig(botId, guildId);
    if (!enabled) {
      return interaction.reply({
        content: '⚠ Модуль «Уровни» отключён на этом сервере',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }

    const config = normalizeConfig(rawConfig);
    const ctx = { botId, guildId, config };

    switch (interaction.commandName) {
      case 'rank':        return this._cmdRank(interaction, ctx);
      case 'leaderboard': return this._cmdLeaderboard(interaction, ctx);
      case 'daily':       return this._cmdDaily(interaction, ctx);
      default:
        return interaction.reply({
          content: 'Неизвестная команда',
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
    }
  }

  async _cmdRank(interaction, { botId, guildId, config }) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const member = interaction.guild.members.cache.get(targetUser.id)
        || await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        return interaction.reply({ content: '❌ Пользователь не найден на сервере', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const data = this.db.getMemberData(botId, guildId, targetUser.id) || { xp: 0, level: 0 };
      const rank = this.db.getUserRank(botId, guildId, targetUser.id);
      const progress = progressOf(data.xp, data.level, config.formula, config);
      const title = getTitleForLevel(data.level, config.titles);
      const nextLevelTotal = xpForLevel(data.level + 1, config.formula, config);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: member.displayName || member.user.username,
          iconURL: member.user.displayAvatarURL({ size: 128 }),
        })
        .setTitle(title ? `${title} · Уровень ${data.level}` : `Уровень ${data.level}`)
        .addFields(
          { name: 'Опыт', value: `**${data.xp.toLocaleString('ru-RU')}** / ${nextLevelTotal.toLocaleString('ru-RU')} XP`, inline: true },
          { name: 'До след. уровня', value: `**${progress.toNext.toLocaleString('ru-RU')}** XP`, inline: true },
          { name: 'Место в топе', value: rank ? `**#${rank}**` : '—', inline: true },
        )
        .setFooter({ text: `Прогресс: ${progress.percent}%` });

      return interaction.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      this.logger.warn({ err, userId: interaction.user.id }, 'levels /rank failed');
      return interaction.reply({ content: '❌ Ошибка', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }

  async _cmdLeaderboard(interaction, { botId, guildId, config }) {
    try {
      const rows = this.db.getLeaderboard(botId, guildId, 10, 0);
      if (!rows.length) {
        return interaction.reply({ content: '📊 Пока нет активных участников', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const medals = ['🥇', '🥈', '🥉'];
      const lines = rows.map((r, i) => {
        const pos = i + 1;
        const prefix = medals[i] || `**${pos}.**`;
        const title = getTitleForLevel(r.level, config.titles);
        return `${prefix} <@${r.user_id}> — **${r.xp.toLocaleString('ru-RU')} XP** · Ур. ${r.level}${title ? ` · ${title}` : ''}`;
      });
      const total = this.db.countLeaderboard(botId, guildId);
      const embed = new EmbedBuilder()
        .setColor(0xF59E0B)
        .setTitle('🏆 Топ по уровням')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Всего в топе: ${total}` });
      return interaction.reply({ embeds: [embed] }).catch(() => {});
    } catch (err) {
      this.logger.warn({ err, userId: interaction.user.id }, 'levels /leaderboard failed');
      return interaction.reply({ content: '❌ Ошибка', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }

  async _cmdDaily(interaction, { botId, guildId, config }) {
    try {
      if (!config.dailyEnabled) {
        return interaction.reply({ content: '⚠ Ежедневная награда отключена', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const userId = interaction.user.id;
      const now = Math.floor(Date.now() / 1000);
      const lastDaily = this.db.getDailyCooldown(botId, guildId, userId);
      const nextAt = lastDaily + 86_400;
      if (lastDaily && now < nextAt) {
        const rem = nextAt - now;
        const h = Math.floor(rem / 3600);
        const m = Math.floor((rem % 3600) / 60);
        return interaction.reply({ content: `⏳ Следующая награда через **${h} ч ${m} мин**`, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      const member = interaction.member;
      if (!member) {
        return interaction.reply({ content: '❌ Не удалось получить профиль участника', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
      this.db.setDailyAt(botId, guildId, userId, now);
      await this._awardXp({ botId, guildId, member, config, amount: config.dailyXp });
      const after = this.db.getMemberData(botId, guildId, userId) || { xp: 0, level: 0 };
      return interaction.reply({
        content: `🎁 Ты получил **${config.dailyXp} XP**! Теперь у тебя **${after.xp.toLocaleString('ru-RU')} XP** (Уровень ${after.level})`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    } catch (err) {
      this.logger.warn({ err, userId: interaction.user.id }, 'levels /daily failed');
      return interaction.reply({ content: '❌ Ошибка', flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }

  /* ─── События ─── */
  async onEvent({ event, client, guildId, message, interaction, oldState, newState }) {
    if (!guildId) return;
    const botId = client.user.id;
    const { enabled, config: rawConfig } = await this.getConfig(botId, guildId);
    if (!enabled) return;
    const config = normalizeConfig(rawConfig);

    switch (event) {
      case 'messageCreate':     return this._onMessage({ botId, guildId, message, config });
      case 'interactionCreate': return this._onInteraction({ botId, guildId, interaction, config });
      case 'voiceStateUpdate':  return this._onVoice({ botId, guildId, oldState, newState, config });
    }
  }

  async _onMessage({ botId, guildId, message, config }) {
    if (!config.enabledEvents.message) return;
    if (!message?.guild || !message.member) return;
    if (message.author.bot) return;
    if (config.excludedChannels.includes(message.channel.id)) return;
    if (config.excludedChannels.includes(message.channel.parentId)) return;
    if (message.member.roles?.cache?.some?.((r) => config.excludedRoles.includes(r.id))) return;
    if (!this._passCooldown(message.author.id, 'message', config.events.message.cooldownMin)) return;
    await this._awardXp({ botId, guildId, member: message.member, config, amount: config.events.message.xp });
  }

  async _onInteraction({ botId, guildId, interaction, config }) {
    if (!config.enabledEvents.command) return;
    if (!interaction?.isChatInputCommand?.()) return;
    if (interaction.user.bot) return;
    if (!this._passCooldown(interaction.user.id, 'command', config.events.command.cooldownMin)) return;
    let member = interaction.member;
    if (!member) {
      try { member = await interaction.guild.members.fetch(interaction.user.id); } catch { return; }
    }
    await this._awardXp({ botId, guildId, member, config, amount: config.events.command.xp });
  }

  async _onVoice({ botId, guildId, oldState, newState, config }) {
    if (!config.enabledEvents.voice) return;
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const wasIn = !!oldState.channelId;
    const isIn = !!newState.channelId;
    const isAfk = newState.channel?.id === newState.guild.afkChannelId;
    const isMuted = newState.selfDeaf || newState.serverDeaf;
    const shouldTrack = isIn && !isAfk && !isMuted;
    if (!wasIn && shouldTrack) startVoice(botId, guildId, member.id, newState.channelId);
    else if (wasIn && (!isIn || isAfk || isMuted)) stopVoice(botId, guildId, member.id);
  }

  async _voiceTick() {
    for (const s of getActiveSessions()) {
      try {
        const { enabled, config: rawConfig } = await this.getConfig(s.botId, s.guildId);
        if (!enabled) { stopVoice(s.botId, s.guildId, s.userId); continue; }
        const config = normalizeConfig(rawConfig);
        if (!config.enabledEvents.voice) continue;
        const minGap = config.events.voice.cooldownMin * 60_000;
        if (Date.now() - s.lastAwardAt < minGap) continue;
        const inst = this.botManager.get(s.botId);
        const guild = inst?.client?.guilds?.cache?.get(s.guildId);
        if (!guild) { stopVoice(s.botId, s.guildId, s.userId); continue; }
        const member = guild.members.cache.get(s.userId);
        if (!member) { stopVoice(s.botId, s.guildId, s.userId); continue; }
        await this._awardXp({ botId: s.botId, guildId: s.guildId, member, config, amount: config.events.voice.xp });
        touchAward(s.botId, s.guildId, s.userId);
      } catch (err) {
        this.logger.warn({ err, userId: s.userId }, 'levels: voice tick failed');
      }
    }
  }

  _passCooldown(userId, type, minutes) {
    if (!minutes || minutes <= 0) return true;
    const k = `${userId}:${type}`;
    const last = this._cooldowns.get(k) || 0;
    if (Date.now() - last < minutes * 60_000) return false;
    this._cooldowns.set(k, Date.now());
    return true;
  }

  async _awardXp({ botId, guildId, member, config, amount }) {
    if (!amount || amount <= 0) return;

    const data = this.db.getMemberData(botId, guildId, member.id) || { xp: 0, level: 0, auto_roles: '[]' };
    const oldXp = data.xp | 0;
    const oldLevel = data.level | 0;

    const boost = member.premiumSince ? config.boostMultiplier : 1;
    const gained = Math.round(amount * boost);

    const maxXp = xpForLevel(config.maxLevel, config.formula, config);
    const newXp = Math.min(oldXp + gained, maxXp);
    const newLevel = getLevelFromXp(newXp, config.formula, config, config.maxLevel);

    const desired = new Set();
    if (config.rewards.enabled) {
      for (const r of config.rewards.entries) {
        if (Number(r.level) <= newLevel && r.roleId) desired.add(r.roleId);
      }
    }
    const currentAuto = new Set(this._parseAutoRoles(data.auto_roles));
    for (const roleId of desired) {
      if (!currentAuto.has(roleId) && !member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(() => {});
      }
      currentAuto.add(roleId);
    }

    this.db.updateXp(botId, guildId, member.id, {
      xp: newXp, level: newLevel, autoRoles: [...currentAuto],
    });

    if (newLevel > oldLevel && config.announceChannelId && config.messages?.levelUp) {
      await this._sendLevelUp({ botId, guildId, member, config, oldLevel, newLevel, newXp, grantedRoles: [...desired] });
    }
  }

  async _sendLevelUp({ botId, guildId, member, config, oldLevel, newLevel, newXp, grantedRoles }) {
    const inst = this.botManager.get(botId);
    if (!inst?.client?.isReady()) return;
    const channel = await inst.client.channels.fetch(config.announceChannelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    const count = await getNonBotMemberCount(member.guild);
    const progress = progressOf(newXp, newLevel, config.formula, config);
    const nextLevelTotalXp = xpForLevel(newLevel + 1, config.formula, config);
    const title = getTitleForLevel(newLevel, config.titles);
    const position = this.db.getUserRank(botId, guildId, member.id);

    const granted = grantedRoles
      .filter((id) => config.rewards.entries.some((r) => r.roleId === id && Number(r.level) === newLevel))
      .map((id) => `<@&${id}>`);

    const tokens = {
      user: `<@${member.id}>`,
      mention: `<@${member.id}>`,
      username: member.user.username,
      displayName: member.user.globalName || member.user.username,
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

    const components = buildComponentsFromConfig(config.messages.levelUp, tokens);
    if (!components?.length) return;

    try {
      await channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: { parse: ['users'] },
      });
    } catch (err) {
      this.logger.warn({ err, guildId }, 'levels: announce failed');
    }
  }

  async _inactivityTick() {
    const now = Math.floor(Date.now() / 1000);
    const dayAgo = now - 86_400;

    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady()) continue;
      for (const guild of inst.client.guilds.cache.values()) {
        try {
          const { enabled, config: rawConfig } = await this.getConfig(inst.id, guild.id);
          if (!enabled) continue;
          const config = normalizeConfig(rawConfig);
          if (!config.inactivity.enabled) continue;

          const threshold = now - config.inactivity.days * 86400;
          const inactive = this.db.getInactive(inst.id, guild.id, threshold);

          for (const row of inactive) {
            // Уже штрафовали в последние 24 часа?
            const lastPenalty = row.last_penalty_at | 0;
            if (lastPenalty > dayAgo) continue;

            const oldXp = row.xp | 0;
            const newXp = Math.max(0, oldXp - config.inactivity.penaltyXp);
            if (newXp === oldXp) continue;

            const newLevel = getLevelFromXp(newXp, config.formula, config, config.maxLevel);
            const oldLevel = row.level | 0;
            const currentAuto = this._parseAutoRoles(row.auto_roles);
            let newAuto = currentAuto;

            if (newLevel < oldLevel && config.inactivity.removeRolesOnDecrease && config.rewards.enabled) {
              const allowed = new Set(
                config.rewards.entries.filter((r) => Number(r.level) <= newLevel).map((r) => r.roleId),
              );
              const toRemove = currentAuto.filter((id) => !allowed.has(id));
              const member = guild.members.cache.get(row.user_id);
              if (member) for (const roleId of toRemove) await member.roles.remove(roleId).catch(() => {});
              newAuto = currentAuto.filter((id) => allowed.has(id));
            }

            this.db.applyPenalty(inst.id, guild.id, row.user_id, {
              xp: newXp, level: newLevel, autoRoles: newAuto,
            });
            this.db.addLog({
              botId: inst.id, guildId: guild.id, level: 'warn', module: 'levels',
              message: `XP −${config.inactivity.penaltyXp} (${config.inactivity.days} дн. неактивности)`,
              meta: { userId: row.user_id, fromXp: oldXp, toXp: newXp },
            });
          }
        } catch (err) {
          this.logger.warn({ err, guildId: guild.id }, 'levels: inactivity tick failed');
        }
      }
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [k, ts] of this._cooldowns) {
      if (now - ts > 24 * 3600_000) this._cooldowns.delete(k);
    }
  }

  _parseAutoRoles(raw) {
    try { return Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { return []; }
  }
}