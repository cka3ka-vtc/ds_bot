// server/db/migrations.js
export const MIGRATIONS = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          discriminator TEXT,
          avatar TEXT,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE TABLE user_guilds (
          user_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          permissions TEXT NOT NULL,
          PRIMARY KEY (user_id, guild_id),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE bots (
          id TEXT PRIMARY KEY,
          owner_id TEXT,
          name TEXT NOT NULL,
          avatar_url TEXT,
          token_encrypted TEXT NOT NULL,
          is_main INTEGER NOT NULL DEFAULT 0,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE guilds (
          id TEXT NOT NULL,
          bot_id TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT,
          owner_id TEXT,
          member_count INTEGER DEFAULT 0,
          discord_created_at INTEGER,
          online_count INTEGER,
          updated_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (id, bot_id),
          FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
        );
        CREATE TABLE module_configs (
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          module_key TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 0,
          config TEXT NOT NULL DEFAULT '{}',
          updated_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (bot_id, guild_id, module_key)
        );
        CREATE TABLE members (
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          xp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 0,
          birthday TEXT,
          warnings INTEGER DEFAULT 0,
          PRIMARY KEY (bot_id, guild_id, user_id)
        );
        CREATE TABLE mod_actions (
          id TEXT PRIMARY KEY,
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          moderator_id TEXT,
          kind TEXT NOT NULL,
          reason TEXT,
          expires_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE TABLE logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT,
          guild_id TEXT,
          level TEXT NOT NULL,
          module TEXT,
          message TEXT NOT NULL,
          meta TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE TABLE custom_commands (
          id TEXT PRIMARY KEY,
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL DEFAULT 'custom',
          response TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          UNIQUE(bot_id, guild_id, name)
        );
        CREATE TABLE guild_settings (
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'ru',
          welcome_channel TEXT,
          log_channel TEXT,
          excluded_roles TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (bot_id, guild_id)
        );
        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          user_id TEXT,
          type TEXT NOT NULL,
          meta TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_logs_bot_guild ON logs(bot_id, guild_id, created_at DESC);
        CREATE INDEX idx_logs_level ON logs(bot_id, guild_id, level, created_at DESC);
        CREATE INDEX idx_commands_bot_guild ON custom_commands(bot_id, guild_id);
        CREATE INDEX idx_mod_actions_bot_guild ON mod_actions(bot_id, guild_id, created_at DESC);
        CREATE INDEX idx_events_bot_guild_type ON events(bot_id, guild_id, type, created_at DESC);
        CREATE INDEX idx_events_guild_type_created ON events(guild_id, type, created_at DESC);
      `);
    },
  },
  {
    version: 2,
    up(db) {
      db.exec(`
        CREATE TABLE user_profiles (
          bot_id TEXT NOT NULL,
          guild_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          username TEXT,
          display_name TEXT,
          avatar_url TEXT,
          updated_at INTEGER DEFAULT (unixepoch()),
          PRIMARY KEY (bot_id, guild_id, user_id)
        );
        CREATE INDEX idx_user_profiles_lookup ON user_profiles(bot_id, guild_id);
      `);
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`ALTER TABLE user_profiles ADD COLUMN left_at INTEGER;`);
    },
  },
  {
    version: 4,
    up(db) {
      db.exec(`
        ALTER TABLE members ADD COLUMN last_active_at INTEGER;
        ALTER TABLE members ADD COLUMN daily_at INTEGER;
        ALTER TABLE members ADD COLUMN auto_roles TEXT NOT NULL DEFAULT '[]';
        CREATE INDEX idx_members_leaderboard ON members(bot_id, guild_id, xp DESC);
        CREATE INDEX idx_members_inactive ON members(bot_id, guild_id, last_active_at);
      `);
    },
  },
  {
    version: 5,
    up(db) {
      db.exec(`
        ALTER TABLE members ADD COLUMN birthday_public INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX idx_members_birthday ON members(bot_id, guild_id, birthday);
      `);
    },
  },
  {
    version: 6,
    up(db) {
      // Отдельный timestamp штрафа: не перезаписывает last_active_at
      // и позволяет раз в сутки проверять «уже оштрафован?».
      db.exec(`
        ALTER TABLE members ADD COLUMN last_penalty_at INTEGER;
        CREATE INDEX idx_members_penalty ON members(bot_id, guild_id, last_penalty_at);
      `);
    },
  },
];

export function runMigrations(db, logger) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER DEFAULT (unixepoch())
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version),
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    logger?.info({ version: m.version }, 'applying migration');
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    });
    tx();
  }
}