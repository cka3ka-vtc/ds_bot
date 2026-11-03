// server/api/routes/members/list.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateQuery } from '../../validate.js';
import { membersListQuery } from '../../../validators/schemas.js';
import { xpForLevel, progressOf } from '../../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../../shared/titles.js';

export function createListRouter() {
  const router = Router();

  router.get('/', validateQuery(membersListQuery), requireBotAccess, async (req, res) => {
    const { botId, guildId, page, limit, search, roleId, status } = req.validatedQuery;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    // ФИКС: 503 вместо 404 (bot_offline — временная недоступность,
    // как в /api/stats и /api/guilds).
    if (!inst?.client) return res.status(503).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const settings = db.getGuildSettings(botId, guildId);
    const excludedRoles = new Set(settings.excluded_roles || []);

    const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
    const levelsConfig = levelsCfg?.config || {};
    const titles = levelsConfig.titles || DEFAULT_TITLES;
    const formula = levelsConfig.formula === 'linear' ? 'linear' : 'classic';

    const allExtra = db.getAllMembersData(botId, guildId);
    const extraMap = new Map(allExtra.map((m) => [m.user_id, m]));

    const sortedByXp = [...allExtra]
      .filter((r) => (r.xp | 0) > 0)
      .sort((a, b) => (b.xp | 0) - (a.xp | 0));
    const rankMap = new Map();
    sortedByXp.forEach((r, i) => rankMap.set(r.user_id, i + 1));

    const q = (search || '').toLowerCase();

    const buildCommon = (userId, extra) => {
      const level = extra.level | 0;
      const xp = extra.xp | 0;
      const progress = progressOf(xp, level, formula, levelsConfig);
      const nextLevelXp = xpForLevel(level + 1, formula, levelsConfig);
      return {
        level, xp,
        title: getTitleForLevel(level, titles),
        rank: rankMap.get(userId) || null,
        nextLevelXp,
        progressPercent: progress.percent,
        progressCurrent: progress.current,
        progressTotal: progress.total,
        warnings: extra.warnings | 0,
        birthday: extra.birthday || null,
        birthdayPublic: !!(extra.birthday_public),
        lastActiveAt: extra.last_active_at || null,
      };
    };

    const activeMembers = guild.members.cache
      .filter((m) => !m.user.bot)
      .filter((m) => !m.roles.cache.some((r) => excludedRoles.has(r.id)))
      .map((m) => ({ id: m.id, member: m }));

    const activeIdSet = new Set(activeMembers.map((x) => x.id));
    const leftProfiles = db.getLeftUsers(botId, guildId)
      .filter((u) => !activeIdSet.has(u.user_id));
    const allIds = [...activeIdSet, ...leftProfiles.map((u) => u.user_id)];

    const statsMap = db.getUserStatsBatch(botId, guildId, allIds);

    const matchesSearch = (m) => !q
      || (m.username || '').toLowerCase().includes(q)
      || (m.displayName || '').toLowerCase().includes(q);

    const matchesRole = (m) => !roleId
      || (m.roles || []).some((r) => r.id === roleId);

    const active = activeMembers
      .map(({ id, member: m }) => {
        const extra = extraMap.get(id) || {};
        const stats = statsMap[id] || { messages: 0, commands: 0, voice: 0 };
        const common = buildCommon(id, extra);
        const roleList = m.roles.cache
          .filter((r) => r.name !== '@everyone')
          .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          id,
          username: m.user.username,
          displayName: m.displayName,
          serverNickname: m.nickname || null,
          avatar: m.user.displayAvatarURL({ size: 128 }),
          isBot: false,
          joinedAt: m.joinedTimestamp,
          leftAt: null,
          left: false,
          roles: roleList,
          ...common,
          messages: stats.messages | 0,
          commands: stats.commands | 0,
          voice: stats.voice | 0,
        };
      })
      .filter(matchesSearch)
      .filter(matchesRole);

    const left = leftProfiles
      .map((u) => {
        const extra = extraMap.get(u.user_id) || u;
        const stats = statsMap[u.user_id] || { messages: 0, commands: 0, voice: 0 };
        const common = buildCommon(u.user_id, extra);
        return {
          id: u.user_id,
          username: u.username || 'unknown',
          displayName: u.display_name || u.username || 'Покинувший участник',
          serverNickname: null,
          avatar: u.avatar_url || null,
          isBot: false,
          joinedAt: null,
          leftAt: u.left_at ? u.left_at * 1000 : null,
          left: true,
          roles: [],
          ...common,
          messages: stats.messages | 0,
          commands: stats.commands | 0,
          voice: stats.voice | 0,
        };
      })
      .filter(matchesSearch);

    let combined;
    if (status === 'active') combined = active;
    else if (status === 'left') combined = left;
    else combined = [...active, ...left];

    const total = combined.length;
    const offset = (page - 1) * limit;
    const items = combined.slice(offset, offset + limit);

    res.json({
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: { active: active.length, left: left.length, all: active.length + left.length },
    });
  });

  return router;
}