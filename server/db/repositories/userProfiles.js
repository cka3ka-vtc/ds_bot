// server/db/repositories/userProfiles.js
export function createUserProfilesRepo(db) {
  return {
    /** Обновляет снапшот профиля. left_at не трогает. */
    upsertUserProfile(p) {
      db.prepare(`
        INSERT INTO user_profiles (bot_id, guild_id, user_id, username, display_name, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, user_id) DO UPDATE SET
          username     = COALESCE(excluded.username,     user_profiles.username),
          display_name = COALESCE(excluded.display_name, user_profiles.display_name),
          avatar_url   = COALESCE(excluded.avatar_url,   user_profiles.avatar_url),
          updated_at   = unixepoch()
      `).run(
        p.botId, p.guildId, p.userId,
        p.username || null,
        p.displayName || null,
        p.avatarUrl || null,
      );
    },

    /** Участник на сервере: сбрасываем left_at (если был). */
    markActive(botId, guildId, userId) {
      db.prepare(`
        UPDATE user_profiles
        SET left_at = NULL, updated_at = unixepoch()
        WHERE bot_id = ? AND guild_id = ? AND user_id = ? AND left_at IS NOT NULL
      `).run(botId, guildId, userId);
    },

    /** Участник ушёл: ставим left_at = сейчас. */
    markLeft(botId, guildId, userId) {
      db.prepare(`
        UPDATE user_profiles
        SET left_at = unixepoch(), updated_at = unixepoch()
        WHERE bot_id = ? AND guild_id = ? AND user_id = ?
      `).run(botId, guildId, userId);
    },

    getUserProfile(botId, guildId, userId) {
      return db.prepare(
        'SELECT * FROM user_profiles WHERE bot_id = ? AND guild_id = ? AND user_id = ?',
      ).get(botId, guildId, userId);
    },

    /** Все ушедшие участники (left_at установлен), свежие сверху. */
    getLeftUsers(botId, guildId) {
      return db.prepare(`
        SELECT * FROM user_profiles
        WHERE bot_id = ? AND guild_id = ? AND left_at IS NOT NULL
        ORDER BY left_at DESC
      `).all(botId, guildId);
    },
  };
}