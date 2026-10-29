// server/db/guild-migrations.js
export const GUILD_MIGRATIONS = [
  {
    version: 1,
    up(db) {
      db.exec(`
        CREATE TABLE module_configs (
          module_key TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 0,
          config TEXT NOT NULL DEFAULT '{}',
          updated_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE members (
          user_id TEXT PRIMARY KEY,
          xp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 0,
          birthday TEXT,
          birthday_public INTEGER NOT NULL DEFAULT 0,
          warnings INTEGER DEFAULT 0,
          last_active_at INTEGER,
          last_penalty_at INTEGER,
          daily_at INTEGER,
          auto_roles TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX idx_members_leaderboard ON members(xp DESC);
        CREATE INDEX idx_members_inactive ON members(last_active_at);
        CREATE INDEX idx_members_birthday ON members(birthday);
        CREATE INDEX idx_members_penalty ON members(last_penalty_at);

        CREATE TABLE mod_actions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          moderator_id TEXT,
          kind TEXT NOT NULL,
          reason TEXT,
          expires_at INTEGER,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_mod_actions ON mod_actions(created_at DESC);

        CREATE TABLE logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL,
          module TEXT,
          message TEXT NOT NULL,
          meta TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_logs_created ON logs(created_at DESC);
        CREATE INDEX idx_logs_level ON logs(level, created_at DESC);

        CREATE TABLE custom_commands (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          type TEXT NOT NULL DEFAULT 'custom',
          response TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE guild_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          language TEXT NOT NULL DEFAULT 'ru',
          welcome_channel TEXT,
          log_channel TEXT,
          excluded_roles TEXT NOT NULL DEFAULT '[]',
          updated_at INTEGER DEFAULT (unixepoch())
        );

        CREATE TABLE events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          type TEXT NOT NULL,
          meta TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_events_type_created ON events(type, created_at DESC);
        CREATE INDEX idx_events_user_type ON events(user_id, type, created_at);
        CREATE INDEX idx_events_created ON events(created_at);

        CREATE TABLE user_profiles (
          user_id TEXT PRIMARY KEY,
          username TEXT,
          display_name TEXT,
          avatar_url TEXT,
          left_at INTEGER,
          updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_user_profiles_left ON user_profiles(left_at);

        CREATE TABLE panel_audit (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          target TEXT,
          meta TEXT,
          ip TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_audit_user ON panel_audit(user_id, created_at DESC);
        CREATE INDEX idx_audit_action ON panel_audit(action, created_at DESC);

        INSERT OR IGNORE INTO guild_settings (id) VALUES (1);
      `);
    },
  },
];

export function runGuildMigrations(db, logger, guildId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER DEFAULT (unixepoch())
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version),
  );

  for (const m of GUILD_MIGRATIONS) {
    if (applied.has(m.version)) continue;
    logger?.info({ version: m.version, db: 'guild', guildId }, 'applying guild migration');
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    });
    tx();
  }
}