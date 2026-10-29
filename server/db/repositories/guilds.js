// server/db/repositories/guilds.js
export function createGuildsRepo(mainDb) {
  return {
    upsertGuild(g) {
      mainDb.prepare(`
        INSERT INTO guilds (id, bot_id, name, icon, owner_id, member_count, discord_created_at, online_count)
        VALUES (@id, @bot_id, @name, @icon, @owner_id, @member_count, @discord_created_at, @online_count)
        ON CONFLICT(id, bot_id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          owner_id = COALESCE(excluded.owner_id, guilds.owner_id),
          member_count = COALESCE(excluded.member_count, guilds.member_count),
          discord_created_at = COALESCE(excluded.discord_created_at, guilds.discord_created_at),
          online_count = COALESCE(excluded.online_count, guilds.online_count),
          updated_at = unixepoch()
      `).run({
        ...g,
        owner_id: g.owner_id ?? null,
        member_count: g.member_count ?? null,
        discord_created_at: g.discord_created_at ?? null,
        online_count: g.online_count ?? null,
      });
    },

    getGuild(botId, guildId) {
      return mainDb.prepare('SELECT * FROM guilds WHERE bot_id = ? AND id = ?').get(botId, guildId);
    },

    getGuildsForBot(botId) {
      return mainDb.prepare('SELECT * FROM guilds WHERE bot_id = ? ORDER BY member_count DESC').all(botId);
    },

    getAllGuilds() {
      return mainDb.prepare('SELECT * FROM guilds').all();
    },

    deleteGuild(botId, guildId) {
      mainDb.prepare('DELETE FROM guilds WHERE bot_id = ? AND id = ?').run(botId, guildId);
    },
  };
}