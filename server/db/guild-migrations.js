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
  {
    version: 2,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(custom_commands)').all().map((r) => r.name),
      );
      const add = (name, sql) => {
        if (!cols.has(name)) db.exec(`ALTER TABLE custom_commands ADD COLUMN ${sql}`);
      };
      add('channels_mode',        "channels_mode TEXT NOT NULL DEFAULT 'all'");
      add('channels',             "channels TEXT NOT NULL DEFAULT '[]'");
      add('cooldown_seconds',     'cooldown_seconds INTEGER NOT NULL DEFAULT 0');
      add('require_roles',        "require_roles TEXT NOT NULL DEFAULT '[]'");
      add('exclude_roles',        "exclude_roles TEXT NOT NULL DEFAULT '[]'");
      add('ephemeral',            'ephemeral INTEGER NOT NULL DEFAULT 0');
      add('response_mode',        "response_mode TEXT NOT NULL DEFAULT 'text'");
      add('response_embed_color', "response_embed_color TEXT DEFAULT '#5865F2'");
      add('usage_count',          'usage_count INTEGER NOT NULL DEFAULT 0');
      add('last_used_at',         'last_used_at INTEGER');
    },
  },
  {
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS builtin_command_settings (
          command_name TEXT PRIMARY KEY,
          enabled INTEGER NOT NULL DEFAULT 1,
          description TEXT,
          cooldown_seconds INTEGER NOT NULL DEFAULT 0,
          channels_mode TEXT NOT NULL DEFAULT 'all',
          channels TEXT NOT NULL DEFAULT '[]',
          require_roles TEXT NOT NULL DEFAULT '[]',
          exclude_roles TEXT NOT NULL DEFAULT '[]',
          ephemeral INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER DEFAULT (unixepoch())
        );
      `);

      const cols = new Set(
        db.prepare('PRAGMA table_info(custom_commands)').all().map((r) => r.name),
      );
      if (!cols.has('message_config')) {
        db.exec("ALTER TABLE custom_commands ADD COLUMN message_config TEXT NOT NULL DEFAULT '{}'");
      }
    },
  },
  {
    version: 4,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(members)').all().map((r) => r.name),
      );
      const add = (name, sql) => {
        if (!cols.has(name)) db.exec(`ALTER TABLE members ADD COLUMN ${sql}`);
      };
      add('birthday_role_until',        'birthday_role_until INTEGER');
      add('last_birthday_announced_at', 'last_birthday_announced_at INTEGER');

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_members_bday_public
          ON members(birthday_public, birthday);
        CREATE INDEX IF NOT EXISTS idx_members_bday_role_until
          ON members(birthday_role_until);
      `);
    },
  },
  {
    version: 5,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(members)').all().map((r) => r.name),
      );
      if (!cols.has('birthday_year')) {
        db.exec('ALTER TABLE members ADD COLUMN birthday_year INTEGER');
      }
    },
  },
  {
    version: 6,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(members)').all().map((r) => r.name),
      );
      if (!cols.has('last_announce_channel_id')) {
        db.exec('ALTER TABLE members ADD COLUMN last_announce_channel_id TEXT');
      }
      if (!cols.has('last_announce_message_id')) {
        db.exec('ALTER TABLE members ADD COLUMN last_announce_message_id TEXT');
      }
      if (!cols.has('last_announce_created_at')) {
        db.exec('ALTER TABLE members ADD COLUMN last_announce_created_at INTEGER');
      }
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_members_last_announce
          ON members(last_announce_created_at);
      `);
    },
  },
  {
    version: 7,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(events)').all().map((r) => r.name),
      );
      if (!cols.has('command_name')) {
        db.exec('ALTER TABLE events ADD COLUMN command_name TEXT');
      }
      if (!cols.has('channel_id')) {
        db.exec('ALTER TABLE events ADD COLUMN channel_id TEXT');
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_events_type_created_cmd
          ON events(type, created_at, command_name);
        CREATE INDEX IF NOT EXISTS idx_events_type_created_chan
          ON events(type, created_at, channel_id, user_id);
      `);

      try {
        db.exec(`
          UPDATE events
          SET command_name = json_extract(meta, '$.command')
          WHERE meta IS NOT NULL
            AND command_name IS NULL
            AND json_extract(meta, '$.command') IS NOT NULL;

          UPDATE events
          SET channel_id = json_extract(meta, '$.channelId')
          WHERE meta IS NOT NULL
            AND channel_id IS NULL
            AND json_extract(meta, '$.channelId') IS NOT NULL;
        `);
      } catch {
        // json_extract может упасть на битом JSON — не блокируем миграцию.
      }
    },
  },
  {
    // v8: user_id для logs — чтобы JOIN с user_profiles давал username/displayName/avatarUrl.
    version: 8,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(logs)').all().map((r) => r.name),
      );
      if (!cols.has('user_id')) {
        db.exec('ALTER TABLE logs ADD COLUMN user_id TEXT');
        db.exec(
          'CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id, created_at DESC)',
        );
      }

      try {
        db.exec(`
          UPDATE logs
          SET user_id = json_extract(meta, '$.userId')
          WHERE meta IS NOT NULL
            AND user_id IS NULL
            AND json_extract(meta, '$.userId') IS NOT NULL
        `);
      } catch {
        // старый битый JSON — пропускаем
      }
    },
  },
  {
    // v9: soft-delete для mod_actions — снятие/истечение бана больше не удаляет
    // запись из БД, а помечает её. Появилась колонка removed_at / removed_by,
    // а также индексы под фильтры журнала.
    version: 9,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(mod_actions)').all().map((r) => r.name),
      );
      if (!cols.has('removed_at')) {
        db.exec('ALTER TABLE mod_actions ADD COLUMN removed_at INTEGER');
      }
      if (!cols.has('removed_by')) {
        db.exec('ALTER TABLE mod_actions ADD COLUMN removed_by TEXT');
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_mod_actions_status
          ON mod_actions(removed_at, expires_at, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_mod_actions_kind
          ON mod_actions(kind, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator
          ON mod_actions(moderator_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_mod_actions_user
          ON mod_actions(user_id, created_at DESC);
      `);
    },
  },
  {
    // v10: filter_key + violation в mod_actions — для структурированного
    // отображения в журнале («по правилу «Фильтр мата» · нарушение №3»).
    // Backfill переводит старые auto-записи (reason = 'мат'/'спам'/...) в новый формат.
    version: 10,
    up(db) {
      const cols = new Set(
        db.prepare('PRAGMA table_info(mod_actions)').all().map((r) => r.name),
      );
      if (!cols.has('filter_key')) {
        db.exec('ALTER TABLE mod_actions ADD COLUMN filter_key TEXT');
      }
      if (!cols.has('violation')) {
        db.exec('ALTER TABLE mod_actions ADD COLUMN violation INTEGER');
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_mod_actions_filter
          ON mod_actions(filter_key, created_at DESC);
      `);

      try {
        db.exec(`
          UPDATE mod_actions
          SET filter_key = CASE reason
            WHEN 'мат'         THEN 'profanity'
            WHEN 'спам'        THEN 'spam'
            WHEN 'капс'        THEN 'caps'
            WHEN 'дубликат'    THEN 'duplicates'
            WHEN 'ссылка'      THEN 'links'
            WHEN 'инвайт'      THEN 'invites'
            WHEN 'упоминания'  THEN 'mentions'
            WHEN 'рейд'        THEN 'raid'
            WHEN 'залго'       THEN 'zalgo'
            WHEN 'эмодзи'      THEN 'emoji'
          END
          WHERE moderator_id IS NULL
            AND filter_key IS NULL
            AND reason IN ('мат','спам','капс','дубликат','ссылка','инвайт','упоминания','рейд','залго','эмодзи');
        `);

        db.exec(`
          UPDATE mod_actions
          SET reason = CASE filter_key
            WHEN 'profanity'  THEN 'Фильтр мата'
            WHEN 'spam'       THEN 'Антиспам'
            WHEN 'caps'       THEN 'Фильтр капса'
            WHEN 'duplicates' THEN 'Дубликаты'
            WHEN 'links'      THEN 'Блокировка ссылок'
            WHEN 'invites'    THEN 'Блокировка инвайтов'
            WHEN 'mentions'   THEN 'Массовые упоминания'
            WHEN 'raid'       THEN 'Антирейд'
            WHEN 'zalgo'      THEN 'Анти-залго'
            WHEN 'emoji'      THEN 'Эмодзи-спам'
          END
          WHERE filter_key IS NOT NULL
            AND moderator_id IS NULL;
        `);
      } catch {
        // backfill — best-effort, при ошибке не блокируем миграцию
      }
    },
  },
  {
    // v11: sticky_messages, autodelete_rules, autodelete_pending
    version: 11,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sticky_messages (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_config TEXT NOT NULL DEFAULT '{}',
          last_message_id TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_sticky_channel
          ON sticky_messages(channel_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_sticky_unique_enabled_channel
          ON sticky_messages(channel_id) WHERE enabled = 1;

        CREATE TABLE IF NOT EXISTS autodelete_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          mode TEXT NOT NULL DEFAULT 'instant',
          delay_value INTEGER,
          delay_unit TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_autodelete_channel
          ON autodelete_rules(channel_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_autodelete_unique_enabled_channel
          ON autodelete_rules(channel_id) WHERE enabled = 1;

        CREATE TABLE IF NOT EXISTS autodelete_pending (
          message_id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL,
          delete_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_autodelete_pending_at
          ON autodelete_pending(delete_at);
      `);
    },
  },
  {
    // v12: scheduled_messages, message_templates
    version: 12,
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          channel_id TEXT NOT NULL,
          message_config TEXT NOT NULL DEFAULT '{}',
          scheduled_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          last_sent_at INTEGER,
          last_error TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_scheduled_pending
          ON scheduled_messages(status, scheduled_at)
          WHERE enabled = 1;

        CREATE TABLE IF NOT EXISTS message_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          message_config TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
      `);
    },
  },
  {
    // v13: default_channel_id для message_templates
    version: 13,
    up(db) {
      const tables = new Set(
        db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
      );
      if (!tables.has('message_templates')) return;

      const cols = new Set(
        db.prepare('PRAGMA table_info(message_templates)').all().map((r) => r.name),
      );
      if (!cols.has('default_channel_id')) {
        db.exec('ALTER TABLE message_templates ADD COLUMN default_channel_id TEXT');
      }
    },
  },
  {
    // v14: last_sent_at для message_templates, last_deleted_at для autodelete_rules
    version: 14,
    up(db) {
      const tables = new Set(
        db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
      );

      if (tables.has('message_templates')) {
        const cols = new Set(
          db.prepare('PRAGMA table_info(message_templates)').all().map((r) => r.name),
        );
        if (!cols.has('last_sent_at')) {
          db.exec('ALTER TABLE message_templates ADD COLUMN last_sent_at INTEGER');
        }
      }

      if (tables.has('autodelete_rules')) {
        const cols = new Set(
          db.prepare('PRAGMA table_info(autodelete_rules)').all().map((r) => r.name),
        );
        if (!cols.has('last_deleted_at')) {
          db.exec('ALTER TABLE autodelete_rules ADD COLUMN last_deleted_at INTEGER');
        }
      }
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