// server/db/index.js
import path from 'node:path';
import { initMainConnection } from './main-connection.js';
import { GuildDbManager } from './guild-manager.js';
import { createUsersRepo } from './repositories/users.js';
import { createBotsRepo } from './repositories/bots.js';
import { createGuildsRepo } from './repositories/guilds.js';
import { createAuditRepo } from './repositories/audit.js';

export function initDb(dbPath, logger) {
  const main = initMainConnection(dbPath, logger);
  const guildManager = new GuildDbManager({ baseDir: path.dirname(dbPath), logger });

  const usersRepo = createUsersRepo(main);
  const botsRepo = createBotsRepo(main);
  const guildsRepo = createGuildsRepo(main);
  const auditRepo = createAuditRepo(main);

  const g = (botId, guildId) => guildManager.get(botId, guildId);

  return {
    raw: main,
    main,
    guildManager,
    guild: g,

    // ───── MAIN ─────
    ...usersRepo,
    ...botsRepo,
    ...guildsRepo,
    ...auditRepo,

    // ───── GUILD ─────
    ensureModuleDefaults: (botId, guildId, mods) => g(botId, guildId).ensureModuleDefaults(mods),
    getModuleConfig: (botId, guildId, key) => g(botId, guildId).getModuleConfig(key),
    setModuleEnabled: (botId, guildId, key, enabled) => g(botId, guildId).setModuleEnabled(key, enabled),
    setModuleConfig: (botId, guildId, key, config) => g(botId, guildId).setModuleConfig(key, config),
    getEnabledModules: (botId, guildId) => g(botId, guildId).getEnabledModules(),
    getModuleStates: (botId, guildId) => g(botId, guildId).getModuleStates(),
    countEnabledModules: (botId, guildId) => g(botId, guildId).countEnabledModules(),

    // members
    getAllMembersData: (botId, guildId) => g(botId, guildId).getAllMembersData(),
    getMemberData: (botId, guildId, userId) => g(botId, guildId).getMemberData(userId),
    upsertMemberData: (botId, guildId, userId, data) => g(botId, guildId).upsertMemberData(userId, data),
    updateXp: (botId, guildId, userId, data) => g(botId, guildId).updateXp(userId, data),
    applyPenalty: (botId, guildId, userId, data) => g(botId, guildId).applyPenalty(userId, data),
    touchActive: (botId, guildId, userId) => g(botId, guildId).touchActive(userId),
    getLeaderboard: (botId, guildId, limit, offset) => g(botId, guildId).getLeaderboard(limit, offset),
    getUserRank: (botId, guildId, userId) => g(botId, guildId).getUserRank(userId),
    countLeaderboard: (botId, guildId) => g(botId, guildId).countLeaderboard(),
    getInactive: (botId, guildId, ts) => g(botId, guildId).getInactive(ts),
    getDailyCooldown: (botId, guildId, userId) => g(botId, guildId).getDailyCooldown(userId),
    setDailyAt: (botId, guildId, userId, ts) => g(botId, guildId).setDailyAt(userId, ts),

    // birthdays
    getBirthday: (botId, guildId, userId) => g(botId, guildId).getBirthday(userId),
    setBirthday: (botId, guildId, userId, ddmm, year) => g(botId, guildId).setBirthday(userId, ddmm, year),
    setBirthdayPublic: (botId, guildId, userId, pub) => g(botId, guildId).setBirthdayPublic(userId, pub),
    getUpcomingBirthdays: (botId, guildId, publicOnly = true) =>
      g(botId, guildId).getUpcomingBirthdays(publicOnly),
    getTodayBirthdays: (botId, guildId, ddmm) => g(botId, guildId).getTodayBirthdays(ddmm),
    countPublicBirthdays: (botId, guildId) => g(botId, guildId).countPublicBirthdays(),
    getBirthdayRoleExpired: (botId, guildId, nowTs) => g(botId, guildId).getBirthdayRoleExpired(nowTs),
    setBirthdayRoleUntil: (botId, guildId, userId, untilTs) => g(botId, guildId).setBirthdayRoleUntil(userId, untilTs),
    clearBirthdayRoleUntil: (botId, guildId, userId) => g(botId, guildId).clearBirthdayRoleUntil(userId),
    getLastBirthdayAnnounced: (botId, guildId, userId) => g(botId, guildId).getLastBirthdayAnnounced(userId),
    setLastBirthdayAnnounced: (botId, guildId, userId, ts) => g(botId, guildId).setLastBirthdayAnnounced(userId, ts),
    setBirthdayAnnounceMessage: (botId, guildId, userId, channelId, messageId, createdAt) =>
      g(botId, guildId).setLastAnnounce(userId, channelId, messageId, createdAt),
    clearBirthdayAnnounceMessage: (botId, guildId, userId) =>
      g(botId, guildId).clearLastAnnounce(userId),
    getOldBirthdayAnnouncements: (botId, guildId, beforeTs) =>
      g(botId, guildId).getOldAnnouncements(beforeTs),

    // moderation
    getModActions: (botId, guildId, kind) => g(botId, guildId).getModActions(kind),
    addModAction: (botId, guildId, a) => g(botId, guildId).addModAction(a),
    removeModAction: (botId, guildId, id) => g(botId, guildId).removeModAction(id),
    getModAction: (botId, guildId, id) => g(botId, guildId).getModAction(id),
    addLog: (botId, guildId, entry) => g(botId, guildId).addLog(entry),
    getLogs: (botId, guildId, limit) => g(botId, guildId).getLogs(limit),
    countLogsByLevel: (botId, guildId, level, since) => g(botId, guildId).countLogsByLevel(level, since),
    getRecentAudit: (botId, guildId, limit) => g(botId, guildId).getRecentAudit(limit),

    // commands — custom
    getCustomCommands: (botId, guildId) => g(botId, guildId).getCustomCommands(),
    createCustomCommand: (botId, guildId, c) => g(botId, guildId).createCustomCommand(c),
    updateCustomCommand: (botId, guildId, id, data) => g(botId, guildId).updateCustomCommand(id, data),
    deleteCustomCommand: (botId, guildId, id) => g(botId, guildId).deleteCustomCommand(id),
    getCustomCommand: (botId, guildId, id) => g(botId, guildId).getCustomCommand(id),
    incrementCommandUsage: (botId, guildId, id) => g(botId, guildId).incrementCommandUsage(id),

    // commands — builtin settings
    getBuiltinSettings: (botId, guildId, name) => g(botId, guildId).getBuiltinSettings(name),
    getAllBuiltinSettings: (botId, guildId) => g(botId, guildId).getAllBuiltinSettings(),
    upsertBuiltinSettings: (botId, guildId, name, data) => g(botId, guildId).upsertBuiltinSettings(name, data),

    // events
    addEvent: ({ botId, guildId, userId, type, meta }) =>
      g(botId, guildId).addEvent({ userId, type, meta }),
    countEvents: (botId, guildId, type, since) => g(botId, guildId).countEvents(type, since),
    countUniqueUsers: (botId, guildId, since) => g(botId, guildId).countUniqueUsers(since),
    getEventsByDay: (botId, guildId, type, since, tz) => g(botId, guildId).getEventsByDay(type, since, tz),
    getTopCommands: (botId, guildId, since, limit) => g(botId, guildId).getTopCommands(since, limit),
    getTopChannels: (botId, guildId, type, since, limit) => g(botId, guildId).getTopChannels(type, since, limit),
    getRecentActivity: (botId, guildId, limit) => g(botId, guildId).getRecentActivity(limit),
    getMemberEvents: (botId, guildId, type, since, limit) => g(botId, guildId).getMemberEvents(type, since, limit),
    getActiveUsersWithStats: (botId, guildId, since, limit) => g(botId, guildId).getActiveUsersWithStats(since, limit),
    getUserStatsBatch: (botId, guildId, userIds) => g(botId, guildId).getUserStatsBatch(userIds),
    getUserStats: (botId, guildId, userId) => g(botId, guildId).getUserStats(userId),

    // user profiles
    upsertUserProfile: ({ botId, guildId, userId, username, displayName, avatarUrl }) =>
      g(botId, guildId).upsertUserProfile(userId, username, displayName, avatarUrl),
    markActive: (botId, guildId, userId) => g(botId, guildId).markActive(userId),
    markLeft: (botId, guildId, userId) => g(botId, guildId).markLeft(userId),
    getUserProfile: (botId, guildId, userId) => g(botId, guildId).getUserProfile(userId),
    getLeftUsers: (botId, guildId) => g(botId, guildId).getLeftUsers(),

    // guild settings
    getGuildSettings: (botId, guildId) => g(botId, guildId).getGuildSettings(),
    setGuildSettings: (botId, guildId, s) => g(botId, guildId).setGuildSettings(s),

    // audit
    addAudit: ({ userId, botId, guildId, action, target, meta, ip }) => {
      if (botId && guildId) {
        g(botId, guildId).addAudit({ userId, action, target, meta, ip });
      } else {
        auditRepo.addGlobalAudit({ userId, botId, guildId, action, target, meta, ip });
      }
    },

    // retention
    purgeOldEvents: (days) => {
      if (!days || days <= 0) return 0;
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      return guildManager.purgeAll('events', cutoff);
    },
    purgeOldLogs: (days) => {
      if (!days || days <= 0) return 0;
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      return guildManager.purgeAll('logs', cutoff);
    },
    purgeOlderThan: (days) => {
      if (!days || days <= 0) return 0;
      const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
      let total = main.prepare('DELETE FROM panel_audit_global WHERE created_at < ?').run(cutoff).changes;
      total += guildManager.purgeAll('panel_audit', cutoff);
      return total;
    },
  };
}