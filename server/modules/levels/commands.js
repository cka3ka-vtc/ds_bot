// server/modules/levels/commands.js
import { EmbedBuilder } from 'discord.js';
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { getTitleForLevel } from '../../../shared/titles.js';
import { mergeLevelsConfig } from '../../../shared/levels-config.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { handleBuiltinCommand } from '../../core/builtin-command.js';
import {
  tryReplyWithMessageConfig,
  replyWithConfig,
} from '../../core/interaction-reply.js';

export function mountCommandMethods(LevelsModule) {
  Object.assign(LevelsModule.prototype, {

    async handleCommand(interaction, opts = {}) {
      return handleBuiltinCommand(interaction, opts, {
        db: this.db,
        logger: this.logger,
        logScope: 'levels',
        useCooldowns: this._useCooldowns,

        fetchModuleConfig: async (botId, guildId) => {
          const r = await this.getConfig(botId, guildId);
          return {
            enabled: r.enabled,
            config: mergeLevelsConfig(r.config || {}),
          };
        },

        dispatch: async (ctx) => {
          switch (ctx.interaction.commandName) {
            case 'rank':        return this._cmdRank(ctx);
            case 'leaderboard': return this._cmdLeaderboard(ctx);
            case 'daily':       return this._cmdDaily(ctx);
            default:
              return ctx.interaction.editReply({ content: 'Неизвестная команда' }).catch(() => {});
          }
        },
      });
    },

    async _cmdRank({ botId, guildId, config, interaction }) {
      const targetUser = interaction.options.getUser('user') || interaction.user;

      // Flush pending XP для этого юзера — иначе /rank покажет устаревшие данные,
      // если он писал сообщения <3 сек назад.
      try { await this._flushXpUserSync(botId, guildId, targetUser.id); }
      catch (err) { this.logger.warn({ err, userId: targetUser.id }, 'levels /rank: flush failed'); }

      const member = interaction.guild.members.cache.get(targetUser.id)
        || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const data = this._getMemberDataCached(botId, guildId, targetUser.id);
      const rank = this.db.getUserRank(botId, guildId, targetUser.id);
      const progress = progressOf(data.xp, data.level, config.formula, config);
      const title = getTitleForLevel(data.level, config.titles);
      const nextLevelTotal = xpForLevel(data.level + 1, config.formula, config);
      const displayName = member?.displayName || targetUser.username;
      const avatarUrl = targetUser.displayAvatarURL?.({ size: 128 }) || '';

      const tokens = {
        user: `<@${targetUser.id}>`,
        mention: `<@${targetUser.id}>`,
        username: targetUser.username,
        displayName,
        avatarUrl,
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
        level: data.level,
        title,
        xp: data.xp,
        nextLevelXp: nextLevelTotal,
        xpToNext: progress.toNext,
        progress: `${progress.current} / ${progress.total}`,
        progressPercent: progress.percent,
        position: rank,
        rank,
        count: interaction.guild.memberCount || 0,
      };

      if (/\{count\}/.test(JSON.stringify(config.messages?.rank || ''))) {
        try {
          tokens.count = await getNonBotMemberCount(interaction.guild, { timeout: 1500 });
        } catch {}
      }

      const sent = await tryReplyWithMessageConfig(interaction, config.messages?.rank, tokens);
      if (sent) return;

      if (!member) {
        return interaction.editReply({ content: '❌ Пользователь не найден на сервере' });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: displayName, iconURL: avatarUrl })
        .setTitle(title ? `${title} · Уровень ${data.level}` : `Уровень ${data.level}`)
        .addFields(
          { name: 'Опыт', value: `**${data.xp.toLocaleString('ru-RU')}** / ${nextLevelTotal.toLocaleString('ru-RU')} XP`, inline: true },
          { name: 'До след. уровня', value: `**${progress.toNext.toLocaleString('ru-RU')}** XP`, inline: true },
          { name: 'Место в топе', value: rank ? `**#${rank}**` : '—', inline: true },
        )
        .setFooter({ text: `Прогресс: ${progress.percent}%` });

      return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    },

    async _cmdLeaderboard({ botId, guildId, config, interaction }) {
      // Flush всё для гильдии — иначе топ-10 может недосчитаться
      // участников с pending XP в буфере.
      try { await this._flushXpGuildSync(botId, guildId); }
      catch (err) { this.logger.warn({ err, guildId }, 'levels /leaderboard: flush failed'); }

      const rows = this.db.getLeaderboard(botId, guildId, 10, 0);
      const total = this.db.countLeaderboard(botId, guildId);
      const guild = interaction.guild;

      const medals = ['🥇', '🥈', '🥉'];
      const lines = rows.map((r, i) => {
        const prefix = medals[i] || `**${i + 1}.**`;
        const t = getTitleForLevel(r.level, config.titles);
        return `${prefix} <@${r.user_id}> — **${r.xp.toLocaleString('ru-RU')} XP** · Ур. ${r.level}${t ? ` · ${t}` : ''}`;
      });
      const topUsers = lines.length ? lines.join('\n') : '—';

      const tokens = {
        guild: guild.name,
        count: total,
        topCount: total,
        topUsers,
        avatarUrl: '',
        guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
      };

      const sent = await tryReplyWithMessageConfig(interaction, config.messages?.leaderboard, tokens);
      if (sent) return;

      if (!rows.length) {
        return interaction.editReply({ content: '📊 Пока нет активных участников' });
      }

      const embed = new EmbedBuilder()
        .setColor(0xF59E0B)
        .setTitle('🏆 Топ по уровням')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Всего в топе: ${total}` });

      return interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
    },

    async _cmdDaily({ botId, guildId, config, interaction }) {
      if (!config.dailyEnabled) {
        return interaction.editReply({ content: '⚠ Ежедневная награда отключена' });
      }

      const userId = interaction.user.id;
      const now = Math.floor(Date.now() / 1000);
      const lastDaily = this.db.getDailyCooldown(botId, guildId, userId);
      const nextAt = lastDaily + 86_400;

      if (lastDaily && now < nextAt) {
        const rem = nextAt - now;
        const h = Math.floor(rem / 3600);
        const m = Math.floor((rem % 3600) / 60);
        return interaction.editReply({ content: `⏳ Следующая награда через **${h} ч ${m} мин**` });
      }

      const member = interaction.member;
      if (!member) {
        return interaction.editReply({ content: '❌ Не удалось получить профиль участника' });
      }

      // Flush pending — чтобы не потерять активность до ответа с новым XP.
      try { await this._flushXpUserSync(botId, guildId, userId); }
      catch (err) { this.logger.warn({ err, userId }, 'levels /daily: flush failed'); }

      this.db.setDailyAt(botId, guildId, userId, now);

      // ФИКС: явно указываем source — чтобы в логах было видно, что это daily.
      await this._awardXp({ botId, guildId, member, config, amount: config.dailyXp, source: 'daily' });

      const after = this._getMemberDataCached(botId, guildId, userId);

      const tokens = {
        user: `<@${userId}>`,
        mention: `<@${userId}>`,
        username: interaction.user.username,
        displayName: member.displayName || interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
        xpGained: config.dailyXp,
        newXp: after.xp,
        newLevel: after.level,
        nextDailyAt: `<t:${now + 86_400}:R>`,
        count: interaction.guild.memberCount || 0,
      };

      if (/\{count\}/.test(JSON.stringify(config.messages?.daily || ''))) {
        try {
          tokens.count = await getNonBotMemberCount(interaction.guild, { timeout: 1500 });
        } catch {}
      }

      return replyWithConfig(
        interaction,
        config.messages?.daily,
        tokens,
        `🎁 Ты получил **${config.dailyXp} XP**! Теперь у тебя **${after.xp.toLocaleString('ru-RU')} XP** (Уровень ${after.level})`,
      );
    },

  });
}