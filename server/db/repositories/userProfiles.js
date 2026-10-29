// server/db/repositories/userProfiles.js
export function createUserProfilesRepo(raw) {
  return {
    upsertUserProfile(userId, username, displayName, avatarUrl) {
      raw.prepare(`
        INSERT INTO user_profiles (user_id, username, display_name, avatar_url)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username     = COALESCE(excluded.username,     user_profiles.username),
          display_name = COALESCE(excluded.display_name, user_profiles.display_name),
          avatar_url   = COALESCE(excluded.avatar_url,   user_profiles.avatar_url),
          updated_at   = unixepoch()
      `).run(userId, username || null, displayName || null, avatarUrl || null);
    },

    markActive(userId) {
      raw.prepare(`
        UPDATE user_profiles SET left_at = NULL, updated_at = unixepoch()
        WHERE user_id = ? AND left_at IS NOT NULL
      `).run(userId);
    },

    markLeft(userId) {
      raw.prepare(`
        UPDATE user_profiles SET left_at = unixepoch(), updated_at = unixepoch()
        WHERE user_id = ?
      `).run(userId);
    },

    getUserProfile(userId) {
      return raw.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
    },

    getLeftUsers() {
      return raw.prepare(`
        SELECT * FROM user_profiles WHERE left_at IS NOT NULL ORDER BY left_at DESC
      `).all();
    },
  };
}