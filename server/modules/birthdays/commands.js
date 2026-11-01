// server/modules/birthdays/commands.js
import { mergeBirthdaysConfig } from '../../../shared/birthdays-config.js';
import { handleBuiltinCommand } from '../../core/builtin-command.js';
import { replyWithConfig } from '../../core/interaction-reply.js';
import {
  parseBirthday,
  daysUntilBirthday,
  humanDaysLeft,
  ageOnNextBirthday,
  fullDate,
} from './helpers.js';

/**
 * Slash-команды модуля «Дни рождения»:
 *   - handleCommand(interaction, opts) — общий каркас (core/builtin-command.js);
 *   - dispatch — switch по конкретным командам;
 *   - _cmdSet / _cmdToggle / _cmdList — реализации;
 *   - ответ через core/interaction-reply.js → replyWithConfig(...).
 */
export function mountCommandMethods(BirthdaysModule) {
  Object.assign(BirthdaysModule.prototype, {

    async handleCommand(interaction, opts = {}) {
      return handleBuiltinCommand(interaction, opts, {
        db: this.db,
        logger: this.logger,
        logScope: 'birthdays',
        useCooldowns: this._useCooldowns,

        fetchModuleConfig: async (botId, guildId) => {
          const r = await this.getConfig(botId, guildId);
          return {
            enabled: r.enabled,
            config: mergeBirthdaysConfig(r.config || {}),
          };
        },

        dispatch: async (ctx) => {
          switch (ctx.interaction.commandName) {
            case 'birthday_set':    return this._cmdSet(ctx);
            case 'birthday_toggle': return this._cmdToggle(ctx);
            case 'birthdays':       return this._cmdList(ctx);
            default:
              return ctx.interaction.editReply({ content: 'Неизвестная команда' }).catch(() => {});
          }
        },
      });
    },

    /* ─── /birthday_set <DD.MM или DD.MM.YYYY> ─── */

    async _cmdSet({ botId, guildId, config, interaction }) {
      const raw = interaction.options.getString('date');
      const parsed = parseBirthday(raw);
      if (!parsed) {
        return interaction.editReply({
          content: '⚠ Неверный формат. Введите **ДД.ММ** или **ДД.ММ.ГГГГ**, например **15.06** или **15.06.1995**.',
        });
      }

      this.db.setBirthday(botId, guildId, interaction.user.id, parsed.ddmm, parsed.year);

      const age = ageOnNextBirthday(parsed.year);
      const full = fullDate(parsed.ddmm, parsed.year);
      const birthdaysCount = this.db.countPublicBirthdays(botId, guildId);

      const tokens = {
        user: `<@${interaction.user.id}>`,
        mention: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        count: interaction.guild.memberCount || 0,
        birthday: parsed.ddmm,
        birthdayFull: full,
        age: age != null ? String(age) : '',
        birthdaysCount: String(birthdaysCount),
        section: 'birthdays',
      };

      const ageText = age != null ? ` (${age} лет)` : '';
      return replyWithConfig(
        interaction,
        config.messages?.cmdSet,
        tokens,
        `✅ Твой день рождения сохранён: **${full}**${ageText}. Я поздравлю тебя в этот день!`,
      );
    },

    /* ─── /birthday_toggle ─── */

    async _cmdToggle({ botId, guildId, config, interaction }) {
      const row = this.db.getBirthday(botId, guildId, interaction.user.id);
      if (!row.birthday) {
        return interaction.editReply({
          content: '⚠ Сначала установите день рождения командой **/birthday_set**.',
        });
      }

      const next = !row.birthday_public;
      this.db.setBirthdayPublic(botId, guildId, interaction.user.id, next);
      const stateLabel = next ? 'включены' : 'отключены';
      const age = ageOnNextBirthday(row.birthday_year);
      const full = fullDate(row.birthday, row.birthday_year);
      const birthdaysCount = this.db.countPublicBirthdays(botId, guildId);

      const tokens = {
        user: `<@${interaction.user.id}>`,
        mention: `<@${interaction.user.id}>`,
        username: interaction.user.username,
        displayName: interaction.member?.displayName || interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        count: interaction.guild.memberCount || 0,
        birthday: row.birthday,
        birthdayFull: full,
        age: age != null ? String(age) : '',
        birthdaysCount: String(birthdaysCount),
        state: stateLabel,
        section: 'birthdays',
      };

      return replyWithConfig(
        interaction,
        config.messages?.cmdToggle,
        tokens,
        next
          ? `🔔 Поздравления **включены**. Я поздравлю тебя ${full}.`
          : `🔕 Поздравления **отключены**. Ты не будешь получать поздравления.`,
      );
    },

    /* ─── /birthdays ─── */

    async _cmdList({ botId, guildId, config, interaction }) {
      const all = this.db.getUpcomingBirthdays(botId, guildId);
      const birthdaysCount = this.db.countPublicBirthdays(botId, guildId);

      const enriched = all
        .map((r) => ({
          ...r,
          daysLeft: daysUntilBirthday(r.birthday),
          age: ageOnNextBirthday(r.birthday_year),
        }))
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 10);

      let topUsersText = '—';
      if (enriched.length) {
        topUsersText = enriched
          .map((r, i) => {
            const prefix = `**${i + 1}.**`;
            const full = fullDate(r.birthday, r.birthday_year);
            const ageText = r.age != null ? ` · ${r.age} лет` : '';
            return `${prefix} <@${r.user_id}> — **${full}** (${humanDaysLeft(r.daysLeft)}${ageText})`;
          })
          .join('\n');
      }

      const tokens = {
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        count: enriched.length,
        birthdaysCount: String(birthdaysCount),
        topUsers: topUsersText,
        section: 'birthdays',
      };

      if (enriched.length === 0) {
        return interaction.editReply({
          content: '📅 Пока никто не указал день рождения. Используйте **/birthday_set**.',
        });
      }

      return replyWithConfig(
        interaction,
        config.messages?.cmdList,
        tokens,
        `📅 **Ближайшие дни рождения:**\n\n${topUsersText}`,
      );
    },

  });
}