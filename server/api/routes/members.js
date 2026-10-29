// server/api/routes/members.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { xpForLevel, progressOf } from '../../core/formulas.js';
import { DEFAULT_TITLES, getTitleForLevel } from '../../../shared/titles.js';

export function membersRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client) return res.status(404).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    try { await guild.members.fetch(); } catch {}

    const settings = db.getGuildSettings(botId, guildId);
    const excludedRoles = new Set(settings.excluded_roles || []);
    const dbExtraArr = db.getAllMembersData(botId, guildId);
    const dbExtra = new Map(dbExtraArr.map((m) => [m.user_id, m]));

    const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
    const levelsConfig = levelsCfg?.config || {};
    const titles = levelsConfig.titles || DEFAULT_TITLES;
    const formula = levelsConfig.formula === 'linear' ? 'linear' : 'classic';

    const activeMembers = guild.members.cache
      .filter((m) => !m.user.bot)
      .filter((m) => !m.roles.cache.some((r) => excludedRoles.has(r.id)))
      .map((m) => ({ id: m.id, member: m }));

    const activeIds = activeMembers.map((x) => x.id);
    const leftProfiles = db.getLeftUsers(botId, guildId)
      .filter((u) => !activeIds.includes(u.user_id));
    const allIds = [...activeIds, ...leftProfiles.map((u) => u.user_id)];

    const statsMap = db.getUserStatsBatch(botId, guildId, allIds);

    const sortedByXp = [...dbExtraArr]
      .filter((r) => (r.xp | 0) > 0)
      .sort((a, b) => (b.xp | 0) - (a.xp | 0));
    const rankMap = new Map();
    sortedByXp.forEach((r, i) => rankMap.set(r.user_id, i + 1));

    const buildCommon = (userId, extra, stats) => {
      const level = extra.level | 0;
      const xp = extra.xp | 0;
      const progress = progressOf(xp, level, formula, levelsConfig);
      const nextLevelXp = xpForLevel(level + 1, formula, levelsConfig);

      return {
        level,
        xp,
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
        messages: stats.messages | 0,
        commands: stats.commands | 0,
        voice: stats.voice | 0,
      };
    };

    const active = activeMembers.map(({ id, member: m }) => {
      const extra = dbExtra.get(id) || {};
      const stats = statsMap[id] || { messages: 0, commands: 0, voice: 0 };
      const common = buildCommon(id, extra, stats);

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
      };
    });

    const left = leftProfiles.map((u) => {
      const extra = dbExtra.get(u.user_id) || u;
      const stats = statsMap[u.user_id] || { messages: 0, commands: 0, voice: 0 };
      const common = buildCommon(u.user_id, extra, stats);

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
      };
    });

    const all = [...active, ...left];
    all.sort((a, b) => (a.left !== b.left) ? (a.left ? 1 : -1) : 0);
    res.json(all);
  });

  router.get('/:userId', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const { userId } = req.params;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client) return res.status(404).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

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

    const member = guild.members.cache.get(userId);
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
      level,
      xp,
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

  /* PUT — возвращает warning вместо молчаливого пропуска */
  router.put('/:userId', requireBotAccess, async (req, res) => {
    const { botId, guildId, level, warnings, nickname, roles } = req.body || {};
    const userId = req.params.userId;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: 'guild_not_found' });

    const me = guild.members.me;

    if (level !== undefined || warnings !== undefined) {
      try {
        db.upsertMemberData(botId, guildId, userId, { level, warnings });
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'member data update failed');
        return res.status(500).json({ error: 'db_failed' });
      }
    }

    const member = guild.members.cache.get(userId)
      || await guild.members.fetch(userId).catch(() => null);

    // участник не найден, но передан nickname/roles — предупреждаем, а не молчим
    if (!member && (nickname !== undefined || roles !== undefined)) {
      return res.json({
        ok: true,
        warning: 'member_not_found',
        message: 'Участник не найден на сервере — никнейм и роли не изменены',
      });
    }

    if (nickname !== undefined && member) {
      if (!me?.permissions?.has('ManageNicknames')) {
        return res.status(403).json({
          error: 'no_permission',
          details: 'У бота нет права «Управление никнеймами»',
        });
      }
      try {
        const next = String(nickname || '').trim() || null;
        await member.setNickname(next, 'Изменение из панели');
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'setNickname failed');
        return res.status(400).json({ error: 'nickname_failed', details: err.message });
      }
    }

    if (Array.isArray(roles) && member) {
      if (!me?.permissions?.has('ManageRoles')) {
        return res.status(403).json({
          error: 'no_permission',
          details: 'У бота нет права «Управление ролями»',
        });
      }
      const botHighest = me.roles.highest.position;
      const current = new Set(
        member.roles.cache
          .filter((r) => r.id !== guild.id && r.position < botHighest)
          .map((r) => r.id),
      );
      const target = new Set(
        roles.filter((id) => {
          const r = guild.roles.cache.get(id);
          return r && r.position < botHighest;
        }),
      );

      const toAdd = [...target].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !target.has(id));

      try {
        if (toAdd.length) await member.roles.add(toAdd, 'Изменение из панели');
        if (toRemove.length) await member.roles.remove(toRemove, 'Изменение из панели');
      } catch (err) {
        req.app.locals.logger.warn({ err, userId }, 'roles update failed');
        return res.status(400).json({ error: 'roles_failed', details: err.message });
      }
    }

    return res.json({ ok: true });
  });

  return router;
}