// server/db/repositories/users.js
export function createUsersRepo(db) {
  return {
    upsertUser(u) {
      db.prepare(`
        INSERT INTO users (id, username, discriminator, avatar)
        VALUES (@id, @username, @discriminator, @avatar)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          discriminator = excluded.discriminator,
          avatar = excluded.avatar,
          updated_at = unixepoch()
      `).run(u);
    },
    getUser(id) {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    },
    setUserGuilds(userId, guilds) {
      const tx = db.transaction((rows) => {
        db.prepare('DELETE FROM user_guilds WHERE user_id = ?').run(userId);
        const ins = db.prepare('INSERT INTO user_guilds (user_id, guild_id, permissions) VALUES (?, ?, ?)');
        for (const g of rows) ins.run(userId, g.guildId, g.permissions);
      });
      tx(guilds);
    },
    userHasGuildAccess(userId, guildId) {
      return !!db.prepare('SELECT 1 FROM user_guilds WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
    },
    getUserAdminGuilds(userId) {
      return db.prepare('SELECT guild_id FROM user_guilds WHERE user_id = ?')
        .all(userId).map((r) => r.guild_id);
    },
  };
}