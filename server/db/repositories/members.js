// server/db/repositories/members.js
export function createMembersRepo(db) {
  return {
    getAllMembersData(botId, guildId) {
      return db.prepare('SELECT * FROM members WHERE bot_id = ? AND guild_id = ?').all(botId, guildId);
    },
    getMemberData(botId, guildId, userId) {
      return db.prepare('SELECT * FROM members WHERE bot_id = ? AND guild_id = ? AND user_id = ?')
        .get(botId, guildId, userId);
    },
    upsertMemberData(botId, guildId, userId, data) {
      db.prepare(`
        INSERT INTO members (bot_id, guild_id, user_id, xp, level, warnings, birthday)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET
          xp       = COALESCE(?, xp),
          level    = COALESCE(?, level),
          warnings = COALESCE(?, warnings),
          birthday = COALESCE(?, birthday)
      `).run(
        botId, guildId, userId,
        data.xp ?? 0, data.level ?? 0, data.warnings ?? 0, data.birthday ?? null,
        data.xp ?? null, data.level ?? null, data.warnings ?? null, data.birthday ?? null,
      );
    },
  };
}