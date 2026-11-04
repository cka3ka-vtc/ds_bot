// server/modules/levels/commands.js
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { getTitleForLevel } from '../../../shared/titles.js';
import { mergeLevelsConfig } from '../../../shared/levels-config.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { handleBuiltinCommand } from '../../core/builtin-command.js';
import { tryReplyWithMessageConfig } from '../../core/interaction-reply.js';
import { editReplyWithMessageConfig } from '../../core/message-sender.js';

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
          return { enabled: r.enabled, config: mergeLevelsConfig(r.config || {}) };
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

      try { await this._flushXpUserSync(botId, guildId, targetUser.id); }
      catch (err) { this.logger.warn({ err, userId: targetUser.id }, 'levels /rank: flush failed'); }

      const member = interaction.guild.members.cache.get(targetUser.id)
        || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return interaction.editReply({ content: 'Пользователь не найден на сервере' });
      }

      const data = this._getMemberDataCached(botId, guildId, targetUser.id);
      const rank = this.db.getUserRank(botId, guildId, targetUser.id);
      const progress = progressOf(data.xp, data.level, config.formula, config);
      const title = getTitleForLevel(data.level, config.titles);
      const nextLevelTotal = xpForLevel(data.level + 1, config.formula, config);

      const tokens = {
        user: `<@${targetUser.id}>`,
        mention: `<@${targetUser.id}>`,
        username: targetUser.username,
        displayName: member.displayName || targetUser.globalName || targetUser.username,
        avatarUrl: targetUser.displayAvatarURL?.({ size: 128 }) || '',
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
        level: data.level, title, xp: data.xp,
        nextLevelXp: nextLevelTotal,
        xpToNext: progress.toNext,
        progress: `${progress.current} / ${progress.total}`,
        progressPercent: progress.percent,
        position: rank, rank,
        count: interaction.guild.memberCount || 0,
      };

      if (/\{count\}/.test(JSON.stringify(config.messages?.rank || ''))) {
        try { tokens.count = await getNonBotMemberCount(interaction.guild, { timeout: 1500 }); }
        catch {}
      }

      const hasCfg = config.messages?.rank
        && (config.messages.rank.title
          || config.messages.rank.subtitle
          || (Array.isArray(config.messages.rank.blocks) && config.messages.rank.blocks.length));

      if (hasCfg && await editReplyWithMessageConfig(interaction, config.messages.rank, tokens)) {
        return;
      }

      return interaction.editReply({
        content:
          `<@${targetUser.id}> · **${title || 'без титула'}** · Уровень **${data.level}**\n` +
          `**Опыт:** ${data.xp.toLocaleString('ru-RU')} / ${nextLevelTotal.toLocaleString('ru-RU')} XP\n` +
          `**До следующего:** ${progress.toNext.toLocaleString('ru-RU')} XP\n` +
          `**Место в топе:** #${rank}`,
        allowedMentions: { parse: [] },
      });
    },

    async _cmdLeaderboard({ botId, guildId, config, interaction }) {
      try { await this._flushXpGuildSync(botId, guildId); }
      catch (err) { this.logger.warn({ err, guildId }, 'levels /leaderboard: flush failed'); }

      const rows = this.db.getLeaderboard(botId, guildId, 10, 0);
      const total = this.db.countLeaderboard(botId, guildId);
      const userId = interaction.user.id;

      const myData = this._getMemberDataCached(botId, guildId, userId);
      const myTitle = getTitleForLevel(myData.level, config.titles);
      const myTitleSuffix = myTitle ? ` · ${myTitle}` : '';

      let myLine;
      if (myData.xp > 0) {
        const myRank = this.db.getUserRank(botId, guildId, userId);
        myLine = `Твоё место: **#${myRank}** — **${myData.xp.toLocaleString('ru-RU')} XP** · Ур. ${myData.level}${myTitleSuffix}`;
      } else {
        myLine = `Твоё место: **—** · Ты пока не в топе`;
      }

      if (!rows.length) {
        return interaction.editReply({
          content: `## Топ по уровням\n\n${myLine}\n\n-# Всего в топе: 0`,
          allowedMentions: { parse: [] },
        });
      }

      const lines = rows.map((r, i) => {
        const t = getTitleForLevel(r.level, config.titles);
        return `**${i + 1}.** <@${r.user_id}> — **${r.xp.toLocaleString('ru-RU')} XP** · Ур. ${r.level}${t ? ` · ${t}` : ''}`;
      });

      return interaction.editReply({
        content:
          `## Топ по уровням\n\n` +
          `${myLine}\n\n` +
          lines.join('\n') +
          `\n\n-# Всего в топе: ${total}`,
        allowedMentions: { parse: [] },
      });
    },

    async _cmdDaily({ botId, guildId, config, interaction }) {
      if (!config.dailyEnabled) {
        return interaction.editReply({ content: 'Ежедневная награда отключена' });
      }
      const userId = interaction.user.id;
      const now = Math.floor(Date.now() / 1000);
      const lastDaily = this.db.getDailyCooldown(botId, guildId, userId);
      const nextAt = lastDaily + 86_400;
      if (lastDaily && now < nextAt) {
        const rem = nextAt - now;
        const h = Math.floor(rem / 3600);
        const m = Math.floor((rem % 3600) / 60);
        return interaction.editReply({ content: `Следующая награда через **${h} ч ${m} мин**` });
      }
      const member = interaction.member;
      if (!member) return interaction.editReply({ content: 'Не удалось получить профиль участника' });

      try { await this._flushXpUserSync(botId, guildId, userId); }
      catch (err) { this.logger.warn({ err, userId }, 'levels /daily: flush failed'); }

      this.db.setDailyAt(botId, guildId, userId, now);
      await this._awardXp({ botId, guildId, member, config, amount: config.dailyXp, source: 'daily' });
      const after = this._getMemberDataCached(botId, guildId, userId);

      const tokens = {
        user: `<@${userId}>`,
        mention: `<@${userId}>`,
        username: interaction.user.username,
        displayName: member.displayName || interaction.user.globalName || interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL?.({ size: 128 }) || '',
        guild: interaction.guild.name,
        guildIconUrl: interaction.guild.iconURL?.({ size: 128 }) || '',
        section: 'levels',
        xpGained: config.dailyXp,
        newXp: after.xp, newLevel: after.level,
        nextDailyAt: `<t:${now + 86_400}:R>`,
        count: interaction.guild.memberCount || 0,
      };

      if (/\{count\}/.test(JSON.stringify(config.messages?.daily || ''))) {
        try { tokens.count = await getNonBotMemberCount(interaction.guild, { timeout: 1500 }); }
        catch {}
      }

      const sent = await tryReplyWithMessageConfig(interaction, config.messages?.daily, tokens);
      if (sent) return;

      return interaction.editReply({
        content:
          `<@${userId}> получил **${config.dailyXp} XP**!\n` +
          `**Теперь:** ${after.xp.toLocaleString('ru-RU')} XP (уровень ${after.level})`,
        allowedMentions: { parse: [] },
      });
    },

  });
}