// server/api/routes/preview.js
// Резолвер токенов для превью в редакторе сообщений.
// Возвращает реальные данные авторизованного пользователя и текущей гильдии.

import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../shared/titles.js';

export function previewRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/tokens', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady?.()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const user = req.user;

    // Member — для displayName и avatar
    let member = guild.members.cache.get(user.id);
    if (!member) {
      member = await guild.members.fetch({ user: user.id, force: false }).catch(() => null);
    }

    const displayName = member?.displayName || user.username;
    const avatarUrl = member?.user?.displayAvatarURL?.({ size: 128 })
      || (user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
        : '');

    const count = await getNonBotMemberCount(guild).catch(() => 0);

    // Уровни авторизованного пользователя
    const dbRow = db.getMemberData(botId, guildId, user.id) || { xp: 0, level: 0 };
    const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
    const levelsConfig = levelsCfg?.config || {};
    const formula = levelsConfig.formula === 'linear' ? 'linear' : 'classic';
    const titles = levelsConfig.titles || DEFAULT_TITLES;
    const level = dbRow.level | 0;
    const xp = dbRow.xp | 0;
    const progress = progressOf(xp, level, formula, levelsConfig);
    const nextLevelXp = xpForLevel(level + 1, formula, levelsConfig);
    const position = db.getUserRank(botId, guildId, user.id) || 0;

    // Роль-награда за текущий уровень
    let rewardRole = '';
    if (levelsConfig.rewards?.enabled && Array.isArray(levelsConfig.rewards.entries)) {
      const entry = levelsConfig.rewards.entries.find((r) => Number(r.level) === level);
      if (entry?.roleId) {
        const role = guild.roles.cache.get(entry.roleId);
        if (role) rewardRole = `@${role.name}`;
      }
    }

    res.json({
      // Пользователь — для превью используем «красивые» значения
      user: `@${displayName}`,
      mention: `@${displayName}`,
      username: user.username,
      displayName,
      avatarUrl,

      // Сервер
      guild: guild.name,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      count,

      // Уровни
      level,
      oldLevel: Math.max(0, level - 1),
      title: getTitleForLevel(level, titles),
      xp,
      nextLevelXp,
      xpToNext: progress.toNext,
      progress: `${progress.current} / ${progress.total}`,
      progressPercent: progress.percent,
      position,
      rank: position,
      rewardRole,
    });
  });

  return router;
}