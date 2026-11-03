// server/modules/birthdays/scheduler.js
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { mergeBirthdaysConfig } from '../../../shared/birthdays-config.js';
import { hasMessageContent } from '../../../shared/message-presets.js';
import { retryDiscord } from '../../core/retry.js';
import { mentionUser, buildAllowedMentions } from '../../core/mentions.js';
import {
  todayDdMm,
  isLeapYear,
  pad2,
  ageOnNextBirthday,
  fullDate,
} from './helpers.js';

export function mountSchedulerMethods(BirthdaysModule) {
  Object.assign(BirthdaysModule.prototype, {

    async _tick() {
      const nowDate = new Date();
      const nowTs = Math.floor(nowDate.getTime() / 1000);
      const hhmm = `${pad2(nowDate.getHours())}:${pad2(nowDate.getMinutes())}`;
      const today = todayDdMm(nowDate);
      const isLeap = isLeapYear(nowDate.getFullYear());

      for (const inst of this.botManager.all()) {
        if (!inst?.client?.isReady?.()) continue;
        for (const guild of inst.client.guilds.cache.values()) {
          try {
            const cfgRaw = this.db.getModuleConfig(inst.id, guild.id, 'birthdays');
            if (!cfgRaw?.enabled) continue;
            const config = mergeBirthdaysConfig(cfgRaw.config);

            await this._expireRoles(inst, guild, config, nowTs);

            if (config.deleteOldAnnouncements) {
              await this._cleanupOldAnnouncements(inst, guild, nowTs);
            }

            if (config.announceChannelId && hhmm >= config.sendTime) {
              await this._announceBirthdays(inst, guild, config, today, isLeap);
            }
          } catch (err) {
            this.logger.warn({ err, guildId: guild.id }, 'birthdays: tick failed');
          }
        }
      }
    },

    async _expireRoles(inst, guild, config, nowTs) {
      if (!config.birthdayRoleId) return;
      const expired = this.db.getBirthdayRoleExpired(inst.id, guild.id, nowTs);
      for (const row of expired) {
        try {
          const member = guild.members.cache.get(row.user_id)
            || await guild.members.fetch(row.user_id).catch(() => null);
          if (member && member.roles.cache.has(config.birthdayRoleId)) {
            await member.roles.remove(config.birthdayRoleId, 'Срок роли именинника истёк');
          }
        } catch (err) {
          this.logger.warn({ err, userId: row.user_id }, 'birthdays: role remove failed');
        }
        this.db.clearBirthdayRoleUntil(inst.id, guild.id, row.user_id);
      }
    },

    async _cleanupOldAnnouncements(inst, guild, nowTs) {
      const now = new Date();
      const dayStart = Math.floor(
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000,
      );

      const old = this.db.getOldBirthdayAnnouncements(inst.id, guild.id, dayStart);
      for (const row of old) {
        try {
          const ch = guild.channels.cache.get(row.last_announce_channel_id)
            || await inst.client.channels.fetch(row.last_announce_channel_id).catch(() => null);

          if (ch?.isTextBased?.() && ch.guild.id === guild.id) {
            const msg = await ch.messages.fetch(row.last_announce_message_id).catch(() => null);
            if (msg) {
              await retryDiscord(() => msg.delete(), {
                maxAttempts: 2,
                baseDelayMs: 500,
                maxDelayMs: 3000,
                label: 'birthdays.cleanup.delete',
                logger: this.logger,
                context: { bot_id: inst.id, guild_id: guild.id, message_id: row.last_announce_message_id },
              }).catch(() => {});
            }
          }
        } catch (err) {
          this.logger.debug(
            { err, userId: row.user_id, messageId: row.last_announce_message_id },
            'birthdays: cleanup old announce failed (non-critical)',
          );
        }
        this.db.clearBirthdayAnnounceMessage(inst.id, guild.id, row.user_id);
      }
    },

    async _announceBirthdays(inst, guild, config, today, isLeap) {
      const channel = await inst.client.channels.fetch(config.announceChannelId).catch(() => null);
      if (!channel?.isTextBased?.() || channel.guild.id !== guild.id) {
        this.logger.warn(
          { guildId: guild.id, channelId: config.announceChannelId },
          'birthdays: invalid announce channel',
        );
        return;
      }

      let rows = this.db.getTodayBirthdays(inst.id, guild.id, today);
      if (!isLeap && today === '28.02') {
        const extra = this.db.getTodayBirthdays(inst.id, guild.id, '29.02');
        if (extra.length) rows = rows.concat(extra);
      }
      if (!rows.length) return;

      const birthdaysCount = this.db.countPublicBirthdays(inst.id, guild.id);
      const excludedRoles = new Set(config.excludedRoles || []);
      const requiredRoles = new Set(config.requiredRoles || []);

      const dayStart = Math.floor(new Date(
        new Date().getFullYear(), new Date().getMonth(), new Date().getDate(),
      ).getTime() / 1000);

      for (const row of rows) {
        const last = this.db.getLastBirthdayAnnounced(inst.id, guild.id, row.user_id);
        if (last >= dayStart) continue;

        const member = guild.members.cache.get(row.user_id)
          || await guild.members.fetch(row.user_id).catch(() => null);
        if (!member) continue;

        if (excludedRoles.size > 0 && member.roles.cache.some((r) => excludedRoles.has(r.id))) {
          this.logger.debug(
            { userId: row.user_id, guildId: guild.id },
            'birthdays: skip due to excluded role',
          );
          continue;
        }

        if (requiredRoles.size > 0 && !member.roles.cache.some((r) => requiredRoles.has(r.id))) {
          this.logger.debug(
            { userId: row.user_id, guildId: guild.id },
            'birthdays: skip due to missing required role',
          );
          continue;
        }

        if (config.birthdayRoleId) {
          try {
            const role = guild.roles.cache.get(config.birthdayRoleId);
            if (role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role.id, 'День рождения');
            }
            this.db.setBirthdayRoleUntil(
              inst.id, guild.id, row.user_id,
              Math.floor(Date.now() / 1000) + 86_400,
            );
          } catch (err) {
            this.logger.warn({ err, userId: row.user_id }, 'birthdays: role add failed');
          }
        }

        const cfgMsg = config.messages?.announce;
        if (hasMessageContent(cfgMsg)) {
          const age = ageOnNextBirthday(row.birthday_year);
          const tokens = {
            user: mentionUser(member.id),
            mention: mentionUser(member.id),
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || member.user.username,
            avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || '',
            guild: guild.name,
            guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
            count: guild.memberCount || 0,
            birthday: row.birthday,
            birthdayFull: fullDate(row.birthday, row.birthday_year),
            age: age != null ? String(age) : '',
            birthdaysCount: String(birthdaysCount),
            section: 'birthdays',
          };

          try {
            const components = buildComponentsFromConfig(cfgMsg, tokens);
            if (components?.length) {
              const sent = await retryDiscord(
                () => channel.send({
                  flags: FLAG_COMPONENTS_V2,
                  components,
                  allowedMentions: buildAllowedMentions(components, { ping: true }),
                }),
                {
                  maxAttempts: 3,
                  baseDelayMs: 800,
                  maxDelayMs: 8000,
                  label: 'birthdays.announce',
                  logger: this.logger,
                  context: { bot_id: inst.id, guild_id: guild.id, user_id: row.user_id },
                },
              );

              if (sent?.id) {
                this.db.setBirthdayAnnounceMessage(
                  inst.id, guild.id, row.user_id, channel.id, sent.id,
                  Math.floor(Date.now() / 1000),
                );
              }
            }
          } catch (err) {
            this.logger.warn({ err, userId: row.user_id }, 'birthdays: announce send failed');
          }
        }

        this.db.setLastBirthdayAnnounced(inst.id, guild.id, row.user_id, Math.floor(Date.now() / 1000));

        // ФИКС: добавлены userId и meta — дашборд покажет КОГО поздравили
        // (через блок пользователя), а в message убран username, чтобы не дублировать.
        this.db.addLog(inst.id, guild.id, {
          level: 'info',
          module: 'birthdays',
          message: 'Поздравление с днём рождения',
          userId: row.user_id,
          meta: {
            userId: row.user_id,
            username: member.user.username,
            displayName: member.displayName || member.user.globalName || member.user.username,
            avatarUrl: member.user.displayAvatarURL?.({ size: 128 }) || null,
            birthday: row.birthday,
          },
        });
      }
    },

  });
}