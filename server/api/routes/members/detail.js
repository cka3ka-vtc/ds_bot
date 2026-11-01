// server/api/routes/members/detail.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { xpForLevel, progressOf } from '../../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../../shared/titles.js';

export function createDetailRouter() {
  const router = Router();

  router.get('/:userId', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const { userId } = req.params;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client) return res.status(404).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch(userId).catch(() => null);
    }

    const dbRow = db.getMemberData(botId, guildId, userId) || {};
    const profile = db.getUserProfile(botId, guildId, userId) || {};
    const stats = db.getUserStats(botId, guildId, userId);
    const rank = db.getUserRank(botId, guildId, userId);

    const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
    const levelsConfig = levelsCfg?.config || {};
    const titles = levelsConfig.titles || DEFAULT_TITLES;
    const formula = levelsConfig.formula === 'linear' ? 'linear' : 'classic';
    const level = dbRow.level | 0;
    const xp = dbRow.xp | 0;
    const progress = progressOf(xp, level, formula, levelsConfig);
    const nextLevelXp = xpForLevel(level + 1, formula, levelsConfig);

    const roleList = member
      ? member.roles.cache
          .filter((r) => r.name !== '@everyone')
          .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    res.json({
      userId,
      username: profile.username || member?.user?.username || null,
      displayName: member?.displayName || profile.display_name || profile.username || 'Участник',
      serverNickname: member?.nickname || null,
      avatarUrl: member?.user?.displayAvatarURL?.({ size: 128 }) || profile.avatar_url || null,
      level, xp,
      title: getTitleForLevel(level, titles),
      rank,
      nextLevelXp,
      progress,
      warnings: dbRow.warnings | 0,
      birthday: dbRow.birthday || null,
      birthdayPublic: !!(dbRow.birthday_public),
      lastActiveAt: dbRow.last_active_at || null,
      left: !!profile.left_at,
      leftAt: profile.left_at || null,
      roles: roleList,
      stats: {
        messages: stats.messages | 0,
        commands: stats.commands | 0,
        voice: stats.voice | 0,
        lastEventAt: stats.last_active || null,
      },
    });
  });

  return router;
}