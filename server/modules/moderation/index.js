// server/modules/moderation/index.js
// Антирейд расширен: одиночные подозрительные аккаунты, волна, raid mode, cooldown.
// Каждый фильтр имеет свой канал логов, шаблон ЛС/лога, карту нарушений.
// mod_actions пишется для action !== 'delete'; logs — только для action === 'delete'.
// Так в дашборде нет дублей и тексты читаемые.

import { Module } from '../_base.js';
import { configCache } from '../../core/config-cache.js';
import {
  mergeModerationConfig, FILTER_KEYS, FILTER_META, ACTION_OPTIONS,
} from '../../../shared/moderation-config.js';
import { checkFilter } from './filters.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { v2ConfigToEmbed, embedHasContent } from '../../core/v2-to-embed.js';

const SPAM_MAP_TTL          = 60_000;
const EXPIRE_BANS_INTERVAL  = 60_000;
const PERMISSION_SEND       = 'SendMessages';

const ACTION_LABEL_RU = {
  delete: 'удаление',
  warn:   'предупреждение',
  mute:   'мут',
  ban:    'бан',
  kick:   'кик',
  role:   'выдача роли',
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

  /* ═════════════════════════════════════════════════════════════
     Dispatch
     ═════════════════════════════════════════════════════════════ */

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
        botId, guildId, filterKey: key, filterCfg: fc,
        message, client, hit,
      });
      return;
    }
  }

  /* ═════════════════════════════════════════════════════════════
     Stateful-фильтры
     ═════════════════════════════════════════════════════════════ */

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
      details: `${sameText.length} повторов за ${p.windowSec} с`,
      filter: 'duplicates',
      matchedMessageIds,
    };
  }

  /* ═════════════════════════════════════════════════════════════
     Антирейд
     ═════════════════════════════════════════════════════════════ */

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
        await this._applyAgeAction({
          botId, guildId, fc, member, client, ageDays,
        });
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
      `рейд: ${recentMembers.length} входов за ${p.windowSec} с`, {
        details: `${recentMembers.length} входов`,
        action: 'raid_wave',
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

    if (p.enableRaidMode) {
      const until = Date.now() + p.raidModeDurationMin * 60_000;
      state.raidModeUntil = until;

      const t = setTimeout(() => {
        state.raidModeUntil = null;
        this.logger.info({ botId, guildId }, 'moderation: raid mode auto-cleared');
      }, p.raidModeDurationMin * 60_000);
      t.unref?.();
      state.timers.add(t);

      await this._sendRaidAlert({
        client, fc, guildId, botId,
        title: 'Raid mode активирован',
        text: `Все новые входы будут автоматически ${p.raidModeAction === 'ban' ? 'забанены' : 'кикнуты'} в течение ${p.raidModeDurationMin} мин.`,
      });
    }

    if (p.cooldownMin > 0) {
      state.cooldownUntil = Date.now() + p.cooldownMin * 60_000;
      const t = setTimeout(() => {
        state.cooldownUntil = null;
      }, p.cooldownMin * 60_000);
      t.unref?.();
      state.timers.add(t);
    }
  }

  async _applyAgeAction({ botId, guildId, fc, member, client, ageDays }) {
    const p = fc.params;
    const ageText = `${Math.floor(ageDays * 24)} ч`;

    this._log(botId, guildId, 'warn', 'moderation',
      `новый аккаунт (${ageText}) · ${p.ageAction}`, {
        userId: member.id,
        action: 'raid_age',
        details: ageText,
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
              userId: member.id,
              moderatorId: null,
              kind: 'ban',
              reason: 'новый аккаунт',
              expiresAt: Math.floor(Date.now() / 1000) + p.ageBanDurationMin * 60,
            });
          } catch (err) {
            this.logger.warn({ err, guildId }, 'moderation: age ban record failed');
          }
        }
      }
    } catch (err) {
      this.logger.warn({ err, guildId, ageAction: p.ageAction }, 'moderation: age action failed');
    }

    await this._sendRaidAlert({
      client, fc, guildId, botId,
      title: 'Новый аккаунт',
      text: `Пользователь <@${member.id}> (возраст ${ageText}) — действие: **${p.ageAction}**`,
    });
  }

  async _applyRaidModeEntry({ botId, guildId, fc, member, client, reason }) {
    const p = fc.params;
    this._log(botId, guildId, 'warn', 'moderation',
      `raid mode · ${p.raidModeAction}`, {
        userId: member.id,
        action: 'raid_mode',
        details: reason,
      });

    try {
      if (p.raidModeAction === 'kick') {
        await member.kick(`Автомодерация: ${reason}`);
      } else if (p.raidModeAction === 'ban') {
        await member.ban({
          reason: `Автомодерация: ${reason}`,
          deleteMessageSeconds: 0,
        });

        if (p.raidModeBanDurationMin > 0) {
          try {
            this.db.addModAction(botId, guildId, {
              userId: member.id,
              moderatorId: null,
              kind: 'ban',
              reason: 'raid mode',
              expiresAt: Math.floor(Date.now() / 1000) + p.raidModeBanDurationMin * 60,
            });
          } catch (err) {
            this.logger.warn({ err, guildId }, 'moderation: raid mode ban record failed');
          }
        }
      }
    } catch (err) {
      this.logger.warn({ err, guildId, raidModeAction: p.raidModeAction }, 'moderation: raid mode entry failed');
    }
  }

  async _kickAll(members, client, reason) {
    for (const member of members) {
      try {
        const m = member?.guild?.members?.cache.get(member.id) || member;
        if (m?.kick) await m.kick(reason);
      } catch (err) {
        this.logger.debug({ err, userId: member?.id }, 'moderation: kickAll item failed');
      }
    }
  }

  async _banAll(members, client, guildId, reason, durationMin, botId) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    for (const member of members) {
      try {
        const userId = member?.id;
        if (!userId) continue;

        await guild.members.ban(userId, {
          reason: `Автомодерация: ${reason}`,
          deleteMessageSeconds: 0,
        });

        if (durationMin > 0) {
          try {
            this.db.addModAction(botId, guildId, {
              userId,
              moderatorId: null,
              kind: 'ban',
              reason: 'рейд',
              expiresAt: Math.floor(Date.now() / 1000) + durationMin * 60,
            });
          } catch (err) {
            this.logger.warn({ err, guildId }, 'moderation: banAll record failed');
          }
        }
      } catch (err) {
        this.logger.debug({ err, userId: member?.id }, 'moderation: banAll item failed');
      }
    }
  }

  async _applySlowmode({ client, guildId, seconds, durationMin }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const me = guild.members.me;
    const textChannels = guild.channels.cache.filter((c) =>
      c.isTextBased?.() && c.permissionsFor(me)?.has('ManageChannels'),
    );

    const state = this._ensureRaidState(`${client.user.id}:${guildId}`);
    const snapshot = [];

    for (const [, ch] of textChannels) {
      try {
        snapshot.push({ channelId: ch.id, prev: ch.rateLimitPerUser || 0 });
        await ch.setRateLimitPerUser(seconds, 'Автомодерация: антирейд');
      } catch (err) {
        this.logger.debug({ err, channelId: ch.id }, 'moderation: slowmode set failed');
      }
    }

    state.restore.push({ type: 'slowmode', snapshot });

    const t = setTimeout(async () => {
      try {
        for (const { channelId, prev } of snapshot) {
          const ch = guild.channels.cache.get(channelId);
          if (ch) await ch.setRateLimitPerUser(prev, 'Автомодерация: снятие').catch(() => {});
        }
      } catch (err) {
        this.logger.warn({ err, guildId }, 'moderation: slowmode auto-clear failed');
      }
    }, durationMin * 60_000);
    t.unref?.();
    state.timers.add(t);
  }

  async _applyLockdown({ client, guildId, durationMin }) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const me = guild.members.me;
    const textChannels = guild.channels.cache.filter((c) =>
      c.isTextBased?.() && c.permissionsFor(me)?.has('ManageChannels'),
    );

    const state = this._ensureRaidState(`${client.user.id}:${guildId}`);
    const snapshot = [];

    for (const [, ch] of textChannels) {
      try {
        const everyone = guild.roles.everyone;
        const current = ch.permissionOverwrites.cache.get(everyone.id);
        snapshot.push({
          channelId: ch.id,
          hadOverwrite: !!current,
        });

        await ch.permissionOverwrites.edit(everyone, {
          [PERMISSION_SEND]: false,
        }, { reason: 'Автомодерация: антирейд' });
      } catch (err) {
        this.logger.debug({ err, channelId: ch.id }, 'moderation: lockdown set failed');
      }
    }

    state.restore.push({ type: 'lockdown', snapshot });

    const t = setTimeout(async () => {
      try {
        for (const snap of snapshot) {
          const ch = guild.channels.cache.get(snap.channelId);
          if (!ch) continue;
          const everyone = guild.roles.everyone;

          if (snap.hadOverwrite) {
            await ch.permissionOverwrites.edit(everyone, {
              [PERMISSION_SEND]: null,
            }, { reason: 'Автомодерация: снятие lockdown' }).catch(() => {});
          } else {
            await ch.permissionOverwrites.delete(everyone, 'Автомодерация: снятие lockdown').catch(() => {});
          }
        }
      } catch (err) {
        this.logger.warn({ err, guildId }, 'moderation: lockdown auto-clear failed');
      }
    }, durationMin * 60_000);
    t.unref?.();
    state.timers.add(t);
  }

  _ensureRaidState(key) {
    let s = this._raidState.get(key);
    if (!s) {
      s = {
        cooldownUntil: null,
        raidModeUntil: null,
        restore: [],
        timers: new Set(),
      };
      this._raidState.set(key, s);
    }
    return s;
  }

  /* ═════════════════════════════════════════════════════════════
     Наказания
     ═════════════════════════════════════════════════════════════ */

  async _applyPunishment({ botId, guildId, filterKey, filterCfg, message, client, hit }) {
    await this._deleteMessages({ client, guildId, message, hit });

    const esc = filterCfg.escalation;
    const since = esc.resetEnabled
      ? Math.floor(Date.now() / 1000) - esc.resetDays * 86_400
      : 0;
    const prev = this.db.countEvents(botId, guildId, `automod_${filterKey}`, since);
    const violation = prev + 1;

    const { action, durationMin, roleId } = this._resolveFilterAction(filterCfg, violation);

    // mod_actions — для action ≠ delete (это наши «наказания»)
    // logs — только для delete (иначе дублирование в дашборде)
    if (action !== 'delete') {
      try {
        this.db.addModAction(botId, guildId, {
          userId: message.author.id,
          moderatorId: null,
          kind: this._actionToKind(action),
          reason: hit.reason,
          expiresAt: durationMin > 0
            ? Math.floor(Date.now() / 1000) + durationMin * 60
            : null,
        });
      } catch (err) {
        this.logger.warn({ err, guildId }, 'moderation: addModAction failed');
      }
    } else {
      // Только удаление — пишем в logs с кратким описанием
      this._log(
        botId, guildId, 'warn', 'moderation',
        'Сообщение удалено', {
          userId: message.author.id,
          action: 'delete',
          filterKey,
          filterName: FILTER_META[filterKey]?.name || filterKey,
          reason: hit.reason,
          details: hit.details,
        },
      );
    }

    // Discord action
    try {
      if (action === 'mute') {
        await message.member.timeout(durationMin * 60_000, `Автомодерация: ${hit.reason}`);
      } else if (action === 'kick') {
        await message.member.kick(`Автомодерация: ${hit.reason}`);
      } else if (action === 'ban') {
        await message.member.ban({
          reason: `Автомодерация: ${hit.reason}`,
          deleteMessageSeconds: 0,
        });
      } else if (action === 'role' && roleId) {
        await message.member.roles.add(roleId, `Автомодерация: ${hit.reason}`);
        if (durationMin > 0) {
          const t = setTimeout(() => {
            message.member.roles.remove(roleId, 'Автомодерация: снятие роли').catch(() => {});
          }, durationMin * 60_000);
          t.unref?.();
        }
      }
    } catch (err) {
      this.logger.warn({ err, guildId, action }, 'moderation: discord action failed');
    }

    // Событие для счётчика нарушений
    try {
      this.db.addEvent({
        botId, guildId, userId: message.author.id,
        type: `automod_${filterKey}`,
        meta: { reason: hit.reason, details: hit.details, violation, action },
      });
    } catch (err) {
      this.logger.warn({ err, guildId }, 'moderation: addEvent failed');
    }

    // Discord-лог и ЛС — как раньше
    await this._sendLog({ message, client, filterCfg, filterKey, hit, action, violation });
    await this._sendDm({ message, filterCfg, filterKey, hit, action, violation });
  }

  async _deleteMessages({ client, guildId, message, hit }) {
    try { await message.delete(); }
    catch (err) {
      this.logger.warn(
        { err, guildId, msgId: message.id },
        'moderation: delete failed (check Manage Messages)',
      );
    }

    const list = hit.matchedMessageIds;
    if (!Array.isArray(list) || list.length <= 1) return;

    let deleted = 0;
    let failed = 0;
    for (const { messageId, channelId } of list) {
      if (messageId === message.id) continue;
      try {
        const channel = client.channels.cache.get(channelId)
          || await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isSendable?.()) { failed++; continue; }

        const msg = channel.messages.cache.get(messageId)
          || await channel.messages.fetch(messageId).catch(() => null);
        if (!msg) { failed++; continue; }

        await msg.delete();
        deleted++;
      } catch (err) {
        failed++;
        this.logger.debug({ err, channelId, messageId }, 'moderation: batch delete failed');
      }
    }
  }

  /* ═════════════════════════════════════════════════════════════
     Планировщик: снятие временных банов
     ═════════════════════════════════════════════════════════════ */

  async _expireBans() {
    const now = Math.floor(Date.now() / 1000);

    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady?.()) continue;

      for (const guild of inst.client.guilds.cache.values()) {
        let bans = [];
        try {
          bans = this.db.getModActions(inst.id, guild.id, 'ban');
        } catch (err) {
          this.logger.debug({ err, guildId: guild.id }, 'moderation: getModActions failed');
          continue;
        }

        for (const b of bans) {
          if (!b.expires_at || b.expires_at > now) continue;

          try {
            await guild.bans.remove(b.user_id, 'Автомодерация: срок бана истёк');
          } catch (err) {
            if (err?.code !== 10026) {
              this.logger.warn(
                { err, guildId: guild.id, userId: b.user_id },
                'moderation: unban failed',
              );
            }
          }

          try {
            this.db.removeModAction(inst.id, guild.id, b.id);
          } catch (err) {
            this.logger.debug({ err, banId: b.id }, 'moderation: removeModAction failed');
          }
        }
      }
    }
  }

  /* ═════════════════════════════════════════════════════════════
     Утилиты
     ═════════════════════════════════════════════════════════════ */

  _resolveFilterAction(filterCfg, violation) {
    if (filterCfg.escalation.enabled && filterCfg.escalation.rows.length) {
      const row = filterCfg.escalation.rows[
        Math.min(violation, filterCfg.escalation.rows.length) - 1
      ];
      if (row) {
        return {
          action: row.action,
          durationMin: row.durationMin,
          roleId: row.roleId,
        };
      }
    }
    return {
      action: filterCfg.action,
      durationMin: filterCfg.durationMin,
      roleId: filterCfg.roleId,
    };
  }

  _actionToKind(action) {
    return {
      warn: 'warn',
      mute: 'mute',
      role: 'mute',
      kick: 'auto',
      ban:  'ban',
    }[action] || 'auto';
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
      username: message.author.username,
      displayName: message.member?.displayName || message.author.username,
      userId: message.author.id,
      reason: hit.reason,
      action: this._actionLabel(action),
      filter: FILTER_META[filterKey]?.name || filterKey,
      violation: String(violation),
      channel: `<#${message.channel.id}>`,
      channelName: message.channel.name || '',
      message: (message.content || '').slice(0, 200),
      guild: message.guild.name,
    };

    let components;
    try {
      components = buildComponentsFromConfig(filterCfg.templateLog, tokens);
    } catch (err) {
      this.logger.warn({ err }, 'moderation: log buildComponents failed');
      return;
    }
    if (!components?.length) return;

    try {
      await channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: { parse: [] },
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
      username: message.author.username,
      displayName: message.member?.displayName || message.author.username,
      reason: hit.reason,
      action: this._actionLabel(action),
      filter: FILTER_META[filterKey]?.name || filterKey,
      violation: String(violation),
      matched: hit.matched || '',
      guild: message.guild.name,
    };

    let embed;
    try {
      embed = v2ConfigToEmbed(filterCfg.templateDm, tokens);
    } catch (err) {
      this.logger.warn({ err }, 'moderation: dm buildEmbed failed');
      return;
    }
    if (!embedHasContent(embed)) return;

    message.author.send({ embeds: [embed] }).catch(() => {});
  }

  async _sendRaidAlert({ client, fc, guildId, botId, title, text }) {
    if (!fc.logChannelId) return;

    const channel = await client.channels.fetch(fc.logChannelId).catch(() => null);
    if (!channel?.isSendable?.() || channel.guild.id !== guildId) return;

    const tokens = {
      reason: title,
      action: 'антирейд',
      filter: 'Антирейд',
      guild: channel.guild.name,
      message: text,
      user: '—',
      channel: '—',
      channelName: '—',
      violation: '1',
    };

    let components;
    try {
      components = buildComponentsFromConfig(fc.templateLog, tokens);
    } catch (err) {
      this.logger.warn({ err }, 'moderation: raid alert build failed');
      return;
    }
    if (!components?.length) return;

    try {
      await channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: { parse: [] },
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
        level,
        module,
        message,
        userId: meta?.userId || null,
        meta,
      });
    } catch (err) {
      this.logger.warn({ err, guildId }, 'moderation: addLog failed');
    }
  }

  _cleanup() {
    const cutoff = Date.now() - SPAM_MAP_TTL;

    for (const [k, arr] of this._spamMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._spamMap.delete(k);
      else this._spamMap.set(k, fresh);
    }
    for (const [k, arr] of this._dupMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._dupMap.delete(k);
      else this._dupMap.set(k, fresh);
    }
    for (const [k, arr] of this._joinMap) {
      const fresh = arr.filter((x) => x.ts > cutoff);
      if (!fresh.length) this._joinMap.delete(k);
      else this._joinMap.set(k, fresh);
    }
  }
}