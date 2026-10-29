// server/db/main-migrations.js
export const MAIN_MIGRATIONS = [
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
        CREATE TABLE panel_audit_global (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          bot_id TEXT,
          guild_id TEXT,
          action TEXT NOT NULL,
          target TEXT,
          meta TEXT,
          ip TEXT,
          created_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX idx_audit_global_user ON panel_audit_global(user_id, created_at DESC);
        CREATE INDEX idx_audit_global_created ON panel_audit_global(created_at);
      `);
    },
  },
];

export function runMainMigrations(db, logger) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER DEFAULT (unixepoch())
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r) => r.version),
  );

  for (const m of MAIN_MIGRATIONS) {
    if (applied.has(m.version)) continue;
    logger?.info({ version: m.version, db: 'main' }, 'applying main migration');
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    });
    tx();
  }
}