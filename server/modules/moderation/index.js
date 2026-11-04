// server/modules/moderation/index.js
import { Module } from '../_base.js';
import { configCache } from '../../core/config-cache.js';
import {
  mergeModerationConfig, FILTER_KEYS, FILTER_META,
} from '../../../shared/moderation-config.js';
import { checkFilter } from './filters.js';
import { sendMessageConfig } from '../../core/message-sender.js';
import { formatMessageForLog } from '../../core/discord-text.js';

const SPAM_MAP_TTL          = 60_000;
const EXPIRE_BANS_INTERVAL  = 60_000;
const PERMISSION_SEND       = 'SendMessages';
const MAX_TIMEOUT_MINUTES   = 40320;

const ACTION_LABEL_RU = {
  delete: 'удаление',
  warn:   'предупреждение',
  mute:   'мут',
  ban:    'бан',
  kick:   'кик',
};

export default class ModerationModule extends Module {
  get key() { return 'moderation'; }

  constructor(ctx) {
    super(ctx);
    this._spamMap = new Map();
    this._dupMap  = new Map();
    this._joinMap = new Map();
    this._raidState = new Map();
    this._cleanupInterval    = null;
    this._expireBansInterval = null;
  }

  async register() {
    this._cleanupInterval = setInterval(() => this._cleanup(), SPAM_MAP_TTL);
    this._cleanupInterval.unref?.();
    this._expireBansInterval = setInterval(() => this._expireBans(), EXPIRE_BANS_INTERVAL);
    this._expireBansInterval.unref?.();
    this.logger.info({ module: 'moderation' }, 'moderation: registered');
  }

  async unregister() {
    if (this._cleanupInterval) clearInterval(this._cleanupInterval);
    if (this._expireBansInterval) clearInterval(this._expireBansInterval);
    for (const [, state] of this._raidState) {
      for (const t of state.timers || []) clearTimeout(t);
    }
    this._spamMap.clear();
    this._dupMap.clear();
    this._joinMap.clear();
    this._raidState.clear();
  }

  async getConfig(botId, guildId) {
    const raw = await configCache.getModuleConfig(this.db, botId, guildId, this.key);
    return { enabled: raw.enabled, config: mergeModerationConfig(raw.config) };
  }

  async onEvent({ event, client, guildId, message, member }) {
    if (event === 'guildMemberAdd') {
      return this._onMemberJoin({ client, guildId, member });
    }
    if (event !== 'messageCreate') return;
    if (!message?.guild || !message.author || message.author.bot) return;
    if (!message.member) return;

    const botId = client.user.id;
    const { enabled, config: cfg } = await this.getConfig(botId, guildId);
    if (!enabled) return;

    for (const key of FILTER_KEYS) {
      if (key === 'raid') continue;
      const fc = cfg.filters[key];
      if (!fc?.enabled) continue;
      if (!this._scopeAllows(fc, message.channel.id)) continue;
      if (fc.excludeRoles.some((r) => message.member.roles.cache.has(r))) continue;

      const hit = await this._runFilter(key, fc, message, { botId, guildId, client });
      if (!hit) continue;

      this.logger.info(
        {
          botId, guildId, userId: message.author.id, filter: key,
          reason: hit.reason, details: hit.details,
          deleteCount: hit.matchedMessageIds?.length || 1,
        },
        'moderation: hit',
      );

      await this._applyPunishment({
        botId, guildId, filterKey: key, filterCfg: fc, message, client, hit,
      });
      return;
    }
  }

  async _runFilter(key, fc, message, ctx) {
    if (key === 'spam')       return this._checkSpam(ctx, fc.params, message);
    if (key === 'duplicates') return this._checkDuplicates(ctx, fc.params, message);
    return checkFilter(key, fc, { content: message.content || '', message });
  }

  _checkSpam({ botId, guildId }, p, message) {
    const key = `${botId}:${guildId}:${message.author.id}`;
    const now = Date.now();
    const windowMs = p.windowSec * 1000;

    const arr = (this._spamMap.get(key) || []).filter((x) => now - x.ts < windowMs);
    arr.push({ ts: now, messageId: message.id, channelId: message.channel.id });
    this._spamMap.set(key, arr);

    if (arr.length < p.count) return null;

    const matchedMessageIds = arr.map((x) => ({
      messageId: x.messageId, channelId: x.channelId,
    }));
    this._spamMap.delete(key);

    return {
      reason: 'спам',
      details: `${arr.length} сообщений за ${p.windowSec} с`,
      filter: 'spam',
      matchedMessageIds,
    };
  }

  _checkDuplicates({ botId, guildId }, p, message) {
    const text = String(message.content || '').trim();
    if (!text) return null;

    const key = `${botId}:${guildId}:${message.author.id}`;
    const now = Date.now();
    const windowMs = p.windowSec * 1000;

    const arr = (this._dupMap.get(key) || []).filter((x) => now - x.ts < windowMs);
    arr.push({ text, ts: now, messageId: message.id, channelId: message.channel.id });
    this._dupMap.set(key, arr);

    const sameText = arr.filter((x) => x.text === text);
    if (sameText.length < p.count) return null;

    const matchedMessageIds = sameText.map((x) => ({
      messageId: x.messageId, channelId: x.channelId,
    }));

    const remaining = arr.filter((x) => x.text !== text);
    if (remaining.length) this._dupMap.set(key, remaining);
    else this._dupMap.delete(key);

    return {
      reason: 'дубликат',
      details: `${sameText.length} повторова за ${p.windowSec} с`,
      filter: 'duplicates',
      matchedMessageIds,
    };
  }

  async _onMemberJoin({ client, guildId, member }) {
    if (!member?.user || member.user.bot) return;
    const botId = client.user.id;
    const { enabled, config: cfg } = await this.getConfig(botId, guildId);
    if (!enabled) return;

    const fc = cfg.filters.raid;
    if (!fc?.enabled) return;

    const p = fc.params;
    const key = `${botId}:${guildId}`;
    const now = Date.now();
    const state = this._ensureRaidState(key);

    if (state.cooldownUntil && now < state.cooldownUntil) return;
    if (state.raidModeUntil && now < state.raidModeUntil) {
      await this._applyRaidModeEntry({
        botId, guildId, fc, member, client, reason: 'raid mode активен',
      });
      return;
    }

    if (p.checkAccountAge) {
      const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
      if (ageDays < p.minAccountAgeDays) {
        await this._applyAgeAction({ botId, guildId, fc, member, client, ageDays });
        return;
      }
    }

    const arr = (this._joinMap.get(key) || []).filter((j) => now - j.ts < p.windowSec * 1000);
    arr.push({ ts: now, userId: member.id, member });
    this._joinMap.set(key, arr);

    if (arr.length >= p.joins) {
      this.logger.info(
        { botId, guildId, joins: arr.length, windowSec: p.windowSec },
        'moderation: raid wave detected',
      );
      this._joinMap.delete(key);

      await this._handleRaidWave({
        botId, guildId, fc, client,
        recentMembers: arr.map((x) => x.member),
        triggerMember: member,
      });
    }
  }

  async _handleRaidWave({ botId, guildId, fc, client, recentMembers }) {
    const p = fc.params;
    const state = this._ensureRaidState(`${botId}:${guildId}`);

    this._log(botId, guildId, 'warn', 'moderation',
      `Рейд: ${recentMembers.length} входов за ${p.windowSec} с`, {
        details: `${recentMembers.length} входов`, action: 'raid_wave',
      });

    try {
      switch (p.waveAction) {
        case 'alert': break;
        case 'slowmode':
          await this._applySlowmode({ client, guildId, seconds: p.slowmodeSec, durationMin: p.lockdownDurationMin });
          break;
        case 'lockdown':
          await this._applyLockdown({ client, guildId, durationMin: p.lockdownDurationMin });
          break;
        case 'kick_all':
          await this._kickAll(recentMembers, client, 'Автомодерация: рейд');
          break;
        case 'ban_all':
          await this._banAll(recentMembers, client, guildId, 'Автомодерация: рейд', p.waveBanDurationMin, botId);
          break;
      }
    } catch (err) {
      this.logger.warn({ err, guildId, waveAction: p.waveAction }, 'moderation: wave action failed');
    }

    let raidModeNote = '';
    if (p.enableRaidMode) {
      const until = Date.now() + p.raidModeDurationMin * 60_000;
      state.raidModeUntil = until;

      const t = setTimeout(() => {
        state.raidModeUntil = null;
        this.logger.info({ botId, guildId }, 'moderation: raid mode auto-cleared');
      }, p.raidModeDurationMin * 60_000);
      t.unref?.();
      state.timers.add(t);

      const rmLabel = p.raidModeAction === 'ban' ? 'бан' : 'кик';
      raidModeNote = ` · Raid mode **активен ${p.raidModeDurationMin} мин** (новые входы — **${rmLabel}**)`;
    }

    if (p.cooldownMin > 0) {
      state.cooldownUntil = Date.now() + p.cooldownMin * 60_000;
      const t = setTimeout(() => { state.cooldownUntil = null; }, p.cooldownMin * 60_000);
      t.unref?.();
      state.timers.add(t);
    }

    const actionText = {
      alert: 'только уведомление модераторов',
      slowmode: `slowmode ${p.slowmodeSec} сек на ${p.lockdownDurationMin} мин`,
      lockdown: `lockdown на ${p.lockdownDurationMin} мин`,
      kick_all: 'кик всех вовшед',
      ban_all:  'бан всех вовшед',
    }[p.waveAction] || p.waveAction;

    await this._sendRaidAlert({
      client, fc, guildId, botId,
      reason: `Обнаружена "**Волна входов**", для них применено действие: **${actionText}**.`,
      message: `Всего действий: **${recentMembers.length}** за **${p.windowSec} с**${raidModeNote}.`,
    });
  }

  async _applyAgeAction({ botId, guildId, fc, member, client, ageDays }) {
    const p = fc.params;
    const ageText = `${Math.floor(ageDays * 24)} ч`;

    this._log(botId, guildId, 'warn', 'moderation',
      `новый аккаунт (${ageText}) · ${p.ageAction}`, {
        userId: member.id, action: 'raid_age', details: ageText,
      });

    try {
      if (p.ageAction === 'kick') {
        await member.kick(`Автомодерация: аккаунт моложе ${p.minAccountAgeDays} дн.`);
      } else if (p.ageAction === 'ban') {
        await member.ban({
          reason: `Автомодерация: аккаунт моложе ${p.minAccountAgeDays} дн.`,
          deleteMessageSeconds: 0,
        });
        if (p.ageBanDurationMin > 0) {
          try {
            this.db.addModAction(botId, guildId, {
              userId: member.id, moderatorId: null, kind: 'ban',
              reason: 'новый аккаунт',
              expiresAt: Math.floor(Date.now() / 1000) + p.ageBanDurationMin * 60,
            });
          } catch (err) { this.logger.warn({ err, guildId }, 'moderation: age ban record failed'); }
        }
      }
    } catch (err) { this.logger.warn({ err, guildId, ageAction: p.ageAction }, 'moderation: age action failed'); }

    const actionText = { alert: 'только уведомление модераторов', kick: 'кик', ban: 'бан' }[p.ageAction] || p.ageAction;
    await this._sendRaidAlert({
      client, fc, guildId, botId,
      reason: `Обнаружен "**Молодой аккаунт**", его возраст меньше **${p.minAccountAgeDays}** дней.`,
      message: `<@${member.id}> · Возраст: **${ageText}** · Действие: **${actionText}**.`,
    });
  }

  async _applyRaidModeEntry({ botId, guildId, fc, member, client, reason }) {
    const p = fc.params;
    this._log(botId, guildId, 'warn', 'moderation',
      `raid mode · ${p.raidModeAction}`, {
        userId: member.id, action: 'raid_mode', details: reason,
      });

    try {
      if (p.raidModeAction === 'kick') {
        await member.kick(`Автомодерация: ${reason}`);
      } else if (p.raidModeAction === 'ban') {
        await member.ban({
          reason: `Автомодерация: ${reason}`, deleteMessageSeconds: 0,
        });
        if (p.raidModeBanDurationMin > 0) {
          try {
            this.db.addModAction(botId, guildId, {
              userId: member.id, moderatorId: null, kind: 'ban',
              reason: 'raid mode',
              expiresAt: Math.floor(Date.now() / 1000) + p.raidModeBanDurationMin * 60,
            });
          } catch (err) { this.logger.warn({ err, guildId }, 'moderation: raid mode ban record failed'); }
        }
      }
    } catch (err) { this.logger.warn({ err, guildId, raidModeAction: p.raidModeAction }, 'moderation: raid mode entry failed'); }
  }

  async _kickAll(members, client, reason) {
    for (const member of members) {
      try {
        const m = member?.guild?.members?.cache.get(member.id) || member;
        if (m?.kick) await m.kick(reason);
      } catch (err) { this.logger.debug({ err, userId: member?.id }, 'moderation: kickAll item failed'); }
    }
  }

  async _banAll(members, client, guildId, reason, durationMin, botId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    for (const member of members) {
      try {
        const userId = member?.id;
        if (!userId) continue;
        await guild.members.ban(userId, { reason: `Автомодерация: ${reason}`, deleteMessageSeconds: 0 });
        if (durationMin > 0) {
          try {
            this.db.addModAction(botId, guildId, {
              userId, moderatorId: null, kind: 'ban', reason: 'рейд',
              expiresAt: Math.floor(Date.now() / 1000) + durationMin * 60,
            });
          } catch (err) { this.logger.warn({ err, guildId }, 'moderation: banAll record failed'); }
        }
      } catch (err) { this.logger.debug({ err, userId: member?.id }, 'moderation: banAll item failed'); }
    }
  }

  async _applySlowmode({ client, guildId, seconds, durationMin }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const me = guild.members.me;
    const textChannels = guild.channels.cache.filter((c) =>
      c.isTextBased?.() && c.permissionsFor(me)?.has('ManageChannels'));
    const state = this._ensureRaidState(`${client.user.id}:${guildId}`);
    const snapshot = [];
    for (const [, ch] of textChannels) {
      try {
        snapshot.push({ channelId: ch.id, prev: ch.rateLimitPerUser || 0 });
        await ch.setRateLimitPerUser(seconds, 'Автомодерация: антирейд');
      } catch (err) { this.logger.debug({ err, channelId: ch.id }, 'moderation: slowmode set failed'); }
    }
    state.restore.push({ type: 'slowmode', snapshot });
    const t = setTimeout(async () => {
      try {
        for (const { channelId, prev } of snapshot) {
          const ch = guild.channels.cache.get(channelId);
          if (ch) await ch.setRateLimitPerUser(prev, 'Автомодерация: снятие').catch(() => {});
        }
      } catch (err) { this.logger.warn({ err, guildId }, 'moderation: slowmode auto-clear failed'); }
    }, durationMin * 60_000);
    t.unref?.();
    state.timers.add(t);
  }

  async _applyLockdown({ client, guildId, durationMin }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const me = guild.members.me;
    const textChannels = guild.channels.cache.filter((c) =>
      c.isTextBased?.() && c.permissionsFor(me)?.has('ManageChannels'));
    const state = this._ensureRaidState(`${client.user.id}:${guildId}`);
    const snapshot = [];
    for (const [, ch] of textChannels) {
      try {
        const everyone = guild.roles.everyone;
        const current = ch.permissionOverwrites.cache.get(everyone.id);
        snapshot.push({
          channelId: ch.id, hadOverwrite: !!current,
          allow: current?.allow?.bitfield?.toString() ?? '0',
          deny:  current?.deny?.bitfield?.toString()  ?? '0',
        });
        await ch.permissionOverwrites.edit(everyone, {
          [PERMISSION_SEND]: false,
        }, { reason: 'Автомодерация: антирейд' });
      } catch (err) { this.logger.debug({ err, channelId: ch.id }, 'moderation: lockdown set failed'); }
    }
    state.restore.push({ type: 'lockdown', snapshot });
    const t = setTimeout(async () => {
      try {
        for (const snap of snapshot) {
          const ch = guild.channels.cache.get(snap.channelId);
          if (!ch) continue;
          const everyone = guild.roles.everyone;
          if (!snap.hadOverwrite) {
            await ch.permissionOverwrites.delete(everyone, 'Автомодерация: снятие lockdown').catch(() => {});
          } else {
            try {
              await ch.permissionOverwrites.edit(everyone, {
                allow: BigInt(snap.allow), deny: BigInt(snap.deny),
              }, { reason: 'Автомодерация: снятие lockdown' });
            } catch (e) { this.logger.warn({ err: e, channelId: ch.id }, 'moderation: lockdown restore failed'); }
          }
        }
      } catch (err) { this.logger.warn({ err, guildId }, 'moderation: lockdown auto-clear failed'); }
    }, durationMin * 60_000);
    t.unref?.();
    state.timers.add(t);
  }

  _ensureRaidState(key) {
    let s = this._raidState.get(key);
    if (!s) {
      s = { cooldownUntil: null, raidModeUntil: null, restore: [], timers: new Set() };
      this._raidState.set(key, s);
    }
    return s;
  }

  async _applyPunishment({ botId, guildId, filterKey, filterCfg, message, client, hit }) {
    await this._deleteMessages({ client, guildId, message, hit });
    const esc = filterCfg.escalation;
    const since = esc.resetEnabled
      ? Math.floor(Date.now() / 1000) - esc.resetDays * 86_400 : 0;
    const prev = this.db.countEvents(botId, guildId, `automod_${filterKey}`, since);
    const violation = prev + 1;
    const { action, durationMin } = this._resolveFilterAction(filterCfg, violation);

    if (action !== 'delete') {
      try {
        this.db.addModAction(botId, guildId, {
          userId: message.author.id, moderatorId: null,
          kind: this._actionToKind(action),
          reason: FILTER_META[filterKey]?.name || filterKey,
          filterKey, violation,
          expiresAt: durationMin > 0 ? Math.floor(Date.now() / 1000) + durationMin * 60 : null,
        });
      } catch (err) { this.logger.warn({ err, guildId }, 'moderation: addModAction failed'); }
    } else {
      this._log(botId, guildId, 'warn', 'moderation', 'сообщение удалено', {
        userId: message.author.id, action: 'delete', filterKey,
        filterName: FILTER_META[filterKey]?.name || filterKey,
        reason: hit.reason, details: hit.details,
        message: formatMessageForLog(message.content, message.attachments, 500),
      });
    }

    try {
      if (action === 'mute') {
        const safeMin = Math.min(durationMin, MAX_TIMEOUT_MINUTES);
        await message.member.timeout(safeMin * 60_000, `Автомодерация: ${hit.reason}`);
      } else if (action === 'kick') {
        await message.member.kick(`Автомодерация: ${hit.reason}`);
      } else if (action === 'ban') {
        await message.member.ban({ reason: `Автомодерация: ${hit.reason}`, deleteMessageSeconds: 0 });
      }
    } catch (err) { this.logger.warn({ err, guildId, action }, 'moderation: discord action failed'); }

    try {
      this.db.addEvent({
        botId, guildId, userId: message.author.id,
        type: `automod_${filterKey}`,
        meta: { reason: hit.reason, details: hit.details, violation, action },
      });
    } catch (err) { this.logger.warn({ err, guildId }, 'moderation: addEvent failed'); }

    await this._sendLog({ message, client, filterCfg, filterKey, hit, action, violation });
    await this._sendDm({ message, filterCfg, filterKey, hit, action, violation });
  }

  async _deleteMessages({ client, guildId, message, hit }) {
    try { await message.delete(); }
    catch (err) { this.logger.warn({ err, guildId, msgId: message.id }, 'moderation: delete failed'); }

    const list = hit.matchedMessageIds;
    if (!Array.isArray(list) || list.length <= 1) return;
    const byChannel = new Map();
    for (const { messageId, channelId } of list) {
      if (messageId === message.id) continue;
      if (!byChannel.has(channelId)) byChannel.set(channelId, []);
      byChannel.get(channelId).push(messageId);
    }
    for (const [channelId, ids] of byChannel) {
      try {
        const channel = client.channels.cache.get(channelId)
          || await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isSendable?.()) continue;
        if (ids.length >= 2) {
          try { await channel.bulkDelete(ids, true); continue; }
          catch (err) { this.logger.debug({ err, channelId }, 'moderation: bulkDelete failed, falling back'); }
        }
        for (const messageId of ids) {
          try {
            const msg = channel.messages.cache.get(messageId)
              || await channel.messages.fetch(messageId).catch(() => null);
            if (msg) await msg.delete();
          } catch (err) { this.logger.debug({ err, channelId, messageId }, 'moderation: batch delete item failed'); }
        }
      } catch (err) { this.logger.debug({ err, channelId }, 'moderation: delete group failed'); }
    }
  }

  async _expireBans() {
    const now = Math.floor(Date.now() / 1000);
    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady?.()) continue;
      for (const guild of inst.client.guilds.cache.values()) {
        let bans = [];
        try { bans = this.db.getExpiredBans(inst.id, guild.id, now); }
        catch (err) { this.logger.debug({ err, guildId: guild.id }, 'moderation: getExpiredBans failed'); continue; }
        for (const b of bans) {
          try { await guild.bans.remove(b.user_id, 'Автомодерация: срок бана истёк'); }
          catch (err) {
            if (err?.code !== 10026) {
              this.logger.warn({ err, guildId: guild.id, userId: b.user_id }, 'moderation: unban failed');
            }
          }
          try {
            this.db.markModActionRemoved(inst.id, guild.id, b.id, 'system');
            this.db.addLog(inst.id, guild.id, {
              level: 'info', module: 'moderation',
              userId: b.user_id, message: 'Срок бана истёк',
              meta: { banId: b.id, userId: b.user_id, expiresAt: b.expires_at },
            });
          } catch (err) { this.logger.debug({ err, banId: b.id }, 'moderation: expire record failed'); }
        }
      }
    }
  }

  _resolveFilterAction(filterCfg, violation) {
    if (filterCfg.escalation.enabled && filterCfg.escalation.rows.length) {
      const row = filterCfg.escalation.rows[
        Math.min(violation, filterCfg.escalation.rows.length) - 1
      ];
      if (row) return { action: row.action, durationMin: row.durationMin };
    }
    return { action: filterCfg.action, durationMin: filterCfg.durationMin };
  }

  _actionToKind(action) {
    return { warn: 'warn', mute: 'mute', kick: 'kick', ban: 'ban' }[action] || 'auto';
  }

  _actionLabel(action) {
    return ACTION_LABEL_RU[action] || action;
  }

  async _sendLog({ message, client, filterCfg, filterKey, hit, action, violation }) {
    if (!filterCfg.logChannelId) return;
    const channel = await client.channels.fetch(filterCfg.logChannelId).catch(() => null);
    if (!channel?.isSendable?.() || channel.guild.id !== message.guild.id) return;

    const tokens = {
      user: `<@${message.author.id}>`,
      mention: `<@${message.author.id}>`,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.globalName || message.author.username,
      userId: message.author.id,
      reason: hit.reason,
      action: this._actionLabel(action),
      filter: FILTER_META[filterKey]?.name || filterKey,
      violation: String(violation),
      channel: `<#${message.channel.id}>`,
      channelText: message.channel.name ? `#${message.channel.name}` : '—',
      channelName: message.channel.name || '',
      message: formatMessageForLog(message.content, message.attachments),
      guild: message.guild.name,
    };

    try {
      await sendMessageConfig(channel, filterCfg.templateLog, tokens, {
        ping: false,
        label: 'moderation.log',
        logger: this.logger,
        context: { bot_id: client.user.id, guild_id: message.guild.id },
      });
    } catch (err) {
      this.logger.warn({ err, guildId: message.guild.id }, 'moderation: log send failed');
    }
  }

  async _sendDm({ message, filterCfg, filterKey, hit, action, violation }) {
    if (!filterCfg.notifyDm) return;
    if (!filterCfg.templateDm) return;

    const tokens = {
      user: `<@${message.author.id}>`,
      mention: `<@${message.author.id}>`,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.globalName || message.author.username,
      reason: hit.reason,
      action: this._actionLabel(action),
      filter: FILTER_META[filterKey]?.name || filterKey,
      violation: String(violation),
      matched: hit.matched || '',
      guild: message.guild.name,
      channel: `<#${message.channel.id}>`,
      channelText: message.channel.name ? `#${message.channel.name}` : '—',
      channelName: message.channel.name || '',
      message: formatMessageForLog(message.content, message.attachments),
    };

    const dmChannel = await message.author.createDM().catch(() => null);
    if (!dmChannel) return;

    try {
      await sendMessageConfig(dmChannel, filterCfg.templateDm, tokens, {
        ping: false,
        label: 'moderation.dm',
        logger: this.logger,
        context: { bot_id: message.client.user.id, guild_id: message.guild?.id },
      });
    } catch (err) {
      this.logger.debug({ err, userId: message.author.id }, 'moderation: dm send failed');
    }
  }

  async _sendRaidAlert({ client, fc, guildId, botId, reason, message }) {
    if (!fc.logChannelId) return;
    const channel = await client.channels.fetch(fc.logChannelId).catch(() => null);
    if (!channel?.isSendable?.() || channel.guild.id !== guildId) return;

    const tokens = {
      reason: reason || '',
      message: message || '',
      filter: FILTER_META.raid.name,
      guild: channel.guild.name,
    };

    try {
      await sendMessageConfig(channel, fc.templateLog, tokens, {
        ping: false,
        label: 'moderation.raid',
        logger: this.logger,
        context: { bot_id: botId, guild_id: guildId },
      });
    } catch (err) {
      this.logger.warn({ err, guildId }, 'moderation: raid alert send failed');
    }
  }

  _scopeAllows(fc, channelId) {
    if (fc.channelsMode === 'whitelist') return fc.channels.includes(channelId);
    if (fc.channelsMode === 'blacklist') return !fc.channels.includes(channelId);
    return true;
  }

  _log(botId, guildId, level, module, message, meta) {
    try {
      this.db.addLog(botId, guildId, {
        level, module, message,
        userId: meta?.userId || null, meta,
      });
    } catch (err) { this.logger.warn({ err, guildId }, 'moderation: addLog failed'); }
  }

  _cleanup() {
    const cutoff = Date.now() - SPAM_MAP_TTL;
    for (const [k, arr] of this._spamMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._spamMap.delete(k); else this._spamMap.set(k, fresh);
    }
    for (const [k, arr] of this._dupMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._dupMap.delete(k); else this._dupMap.set(k, fresh);
    }
    for (const [k, arr] of this._joinMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._joinMap.delete(k); else this._joinMap.set(k, fresh);
    }
  }
}