// server/db/repositories/guilds.js
export function createGuildsRepo(db) {
  return {
    upsertGuild(g) {
      db.prepare(`
        INSERT INTO guilds (id, bot_id, name, icon, owner_id, member_count, discord_created_at, online_count)
        VALUES (@id, @bot_id, @name, @icon, @owner_id, @member_count, @discord_created_at, @online_count)
        ON CONFLICT(id, bot_id) DO UPDATE SET
          name = excluded.name,
          icon = excluded.icon,
          member_count = excluded.member_count,
          discord_created_at = COALESCE(excluded.discord_created_at, guilds.discord_created_at),
          online_count = COALESCE(excluded.online_count, guilds.online_count),
          updated_at = unixepoch()
      `).run({
        ...g,
        discord_created_at: g.discord_created_at ?? null,
        online_count: g.online_count ?? null,
      });
    },
    getGuild(botId, guildId) {
      return db.prepare('SELECT * FROM guilds WHERE bot_id = ? AND id = ?').get(botId, guildId);
    },
    getGuildsForBot(botId) {
      return db.prepare('SELECT * FROM guilds WHERE bot_id = ? ORDER BY member_count DESC').all(botId);
    },
    deleteGuild(botId, guildId) {
      db.prepare('DELETE FROM guilds WHERE bot_id = ? AND id = ?').run(botId, guildId);
    },

    // Guild settings
    getGuildSettings(botId, guildId) {
      let row = db.prepare('SELECT * FROM guild_settings WHERE bot_id = ? AND guild_id = ?').get(botId, guildId);
      if (!row) {
        db.prepare('INSERT INTO guild_settings (bot_id, guild_id) VALUES (?, ?)').run(botId, guildId);
        row = db.prepare('SELECT * FROM guild_settings WHERE bot_id = ? AND guild_id = ?').get(botId, guildId);
      }
      return { ...row, excluded_roles: JSON.parse(row.excluded_roles || '[]') };
    },

    /**
     * Обновление только тех полей, что явно переданы.
     * s = { language?, welcomeChannel?, logChannel?, excludedRoles? }
     */
    setGuildSettings(botId, guildId, s) {
      const existing = this.getGuildSettings(botId, guildId);

      const language = s.language !== undefined ? s.language : existing.language;
      const welcomeChannel = s.welcomeChannel !== undefined ? s.welcomeChannel : existing.welcome_channel;
      const logChannel = s.logChannel !== undefined ? s.logChannel : existing.log_channel;
      const excludedRoles = s.excludedRoles !== undefined ? s.excludedRoles : existing.excluded_roles;

      db.prepare(`
        INSERT INTO guild_settings (bot_id, guild_id, language, welcome_channel, log_channel, excluded_roles)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id) DO UPDATE SET
          language        = excluded.language,
          welcome_channel = excluded.welcome_channel,
          log_channel     = excluded.log_channel,
          excluded_roles  = excluded.excluded_roles,
          updated_at      = unixepoch()
      `).run(
        botId, guildId,
        language || 'ru',
        welcomeChannel || null,
        logChannel || null,
        JSON.stringify(excludedRoles || []),
      );
    },
  };
}