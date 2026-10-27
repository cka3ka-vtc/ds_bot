// server/core/db.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let db = null;

/**
 * Инициализация базы данных.
 * @param {string} dbPath — путь к файлу .sqlite
 * @returns {object} — обёртка с методами
 */
export function initDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate();
  return wrap();
}

/* ============================================================
   МИГРАЦИИ
   ============================================================ */
function migrate() {
  db.exec(`
    -- Пользователи (залогиненные через Discord OAuth)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      discriminator TEXT,
      avatar TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    -- Связь пользователь ↔ сервер (только с правами ADMIN)
    CREATE TABLE IF NOT EXISTS user_guilds (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      permissions TEXT NOT NULL,
      PRIMARY KEY (user_id, guild_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Боты (главный + пользовательские)
    CREATE TABLE IF NOT EXISTS bots (
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

    -- Серверы (изолированные по bot_id + guild_id)
    CREATE TABLE IF NOT EXISTS guilds (
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

    -- Конфиги модулей
    CREATE TABLE IF NOT EXISTS module_configs (
      bot_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      module_key TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (bot_id, guild_id, module_key)
    );

    -- Участники (XP, уровень, предупреждения, ДР)
    CREATE TABLE IF NOT EXISTS members (
      bot_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      birthday TEXT,
      warnings INTEGER DEFAULT 0,
      PRIMARY KEY (bot_id, guild_id, user_id)
    );

    -- Наказания
    CREATE TABLE IF NOT EXISTS mod_actions (
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

    -- Логи бота
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT,
      guild_id TEXT,
      level TEXT NOT NULL,
      module TEXT,
      message TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Пользовательские slash-команды
    CREATE TABLE IF NOT EXISTS custom_commands (
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

    -- Настройки сервера (язык, каналы, исключения)
    CREATE TABLE IF NOT EXISTS guild_settings (
      bot_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'ru',
      welcome_channel TEXT,
      log_channel TEXT,
      excluded_roles TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (bot_id, guild_id)
    );

    -- События для статистики (сообщения, команды, входы/выходы, голос)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT,
      type TEXT NOT NULL,
      meta TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Индексы
    CREATE INDEX IF NOT EXISTS idx_logs_bot_guild
      ON logs(bot_id, guild_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level
      ON logs(bot_id, guild_id, level, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_commands_bot_guild
      ON custom_commands(bot_id, guild_id);
    CREATE INDEX IF NOT EXISTS idx_mod_actions_bot_guild
      ON mod_actions(bot_id, guild_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_bot_guild_type
      ON events(bot_id, guild_id, type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_guild_type_created
      ON events(guild_id, type, created_at DESC);
  `);

  // ── Безопасная миграция старых БД: добавляем колонки, если их нет ──
  try {
    const cols = db.prepare('PRAGMA table_info(guilds)').all();
    const has = (name) => cols.some((c) => c.name === name);
    if (!has('discord_created_at')) {
      db.exec('ALTER TABLE guilds ADD COLUMN discord_created_at INTEGER');
    }
    if (!has('online_count')) {
      db.exec('ALTER TABLE guilds ADD COLUMN online_count INTEGER');
    }
  } catch {
    // Игнорируем — колонки уже добавлены
  }
}

/* ============================================================
   ОБЁРТКА
   ============================================================ */
function wrap() {
  return {
    /* ────────────── USERS ──────────────────────────────── */
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
        const ins = db.prepare(
          'INSERT INTO user_guilds (user_id, guild_id, permissions) VALUES (?, ?, ?)',
        );
        for (const g of rows) ins.run(userId, g.guildId, g.permissions);
      });
      tx(guilds);
    },

    userHasGuildAccess(userId, guildId) {
      return !!db.prepare(
        'SELECT 1 FROM user_guilds WHERE user_id = ? AND guild_id = ?',
      ).get(userId, guildId);
    },

    getUserAdminGuilds(userId) {
      return db.prepare(
        'SELECT guild_id FROM user_guilds WHERE user_id = ?',
      ).all(userId).map((r) => r.guild_id);
    },

    /* ────────────── BOTS ───────────────────────────────── */
    createBot(b) {
      db.prepare(`
        INSERT INTO bots (id, owner_id, name, avatar_url, token_encrypted, is_main)
        VALUES (@id, @owner_id, @name, @avatar_url, @token_encrypted, @is_main)
      `).run({ is_main: 0, ...b, owner_id: b.owner_id || null });
    },

    getBot(id) {
      return db.prepare('SELECT * FROM bots WHERE id = ?').get(id);
    },

    getMainBot() {
      return db.prepare('SELECT * FROM bots WHERE is_main = 1').get();
    },

    getAllBots() {
      return db.prepare('SELECT * FROM bots WHERE enabled = 1').all();
    },

    getBotsForUser(userId) {
      return db.prepare(`
        SELECT * FROM bots
        WHERE is_main = 1 OR owner_id = ?
        ORDER BY is_main DESC, created_at ASC
      `).all(userId);
    },

    deleteBot(id) {
      db.prepare('DELETE FROM bots WHERE id = ? AND is_main = 0').run(id);
    },

    /* ────────────── GUILDS ─────────────────────────────── */
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
      return db.prepare(
        'SELECT * FROM guilds WHERE bot_id = ? AND id = ?',
      ).get(botId, guildId);
    },

    getGuildsForBot(botId) {
      return db.prepare(
        'SELECT * FROM guilds WHERE bot_id = ? ORDER BY member_count DESC',
      ).all(botId);
    },

    deleteGuild(botId, guildId) {
      db.prepare('DELETE FROM guilds WHERE bot_id = ? AND id = ?')
        .run(botId, guildId);
    },

    /* ────────────── MODULES ────────────────────────────── */
    getModuleConfig(botId, guildId, key) {
      const row = db.prepare(
        'SELECT enabled, config FROM module_configs WHERE bot_id = ? AND guild_id = ? AND module_key = ?',
      ).get(botId, guildId, key);
      return row
        ? { enabled: !!row.enabled, config: JSON.parse(row.config) }
        : { enabled: false, config: {} };
    },

    setModuleEnabled(botId, guildId, key, enabled) {
      db.prepare(`
        INSERT INTO module_configs (bot_id, guild_id, module_key, enabled)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, module_key) DO UPDATE SET
          enabled = excluded.enabled,
          updated_at = unixepoch()
      `).run(botId, guildId, key, enabled ? 1 : 0);
    },

    setModuleConfig(botId, guildId, key, config) {
      db.prepare(`
        INSERT INTO module_configs (bot_id, guild_id, module_key, config)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(bot_id, guild_id, module_key) DO UPDATE SET
          config = excluded.config,
          updated_at = unixepoch()
      `).run(botId, guildId, key, JSON.stringify(config));
    },

    getEnabledModules(botId, guildId) {
      return db.prepare(
        'SELECT module_key FROM module_configs WHERE bot_id = ? AND guild_id = ? AND enabled = 1',
      ).all(botId, guildId).map((r) => r.module_key);
    },

    getModuleStates(botId, guildId) {
      return db.prepare(
        'SELECT module_key, enabled FROM module_configs WHERE bot_id = ? AND guild_id = ?',
      ).all(botId, guildId);
    },

    countEnabledModules(botId, guildId) {
      return db.prepare(
        'SELECT COUNT(*) as c FROM module_configs WHERE bot_id = ? AND guild_id = ? AND enabled = 1',
      ).get(botId, guildId).c;
    },

    /* ────────────── LOGS ───────────────────────────────── */
    addLog(entry) {
      db.prepare(`
        INSERT INTO logs (bot_id, guild_id, level, module, message, meta)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        entry.botId || null,
        entry.guildId || null,
        entry.level,
        entry.module || null,
        entry.message,
        entry.meta ? JSON.stringify(entry.meta) : null,
      );
    },

    getLogs(botId, guildId, limit = 100) {
      return db.prepare(`
        SELECT * FROM logs
        WHERE bot_id = ? AND guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(botId, guildId, limit);
    },

    countLogsByLevel(botId, guildId, level, since = 0) {
      return db.prepare(`
        SELECT COUNT(*) as c FROM logs
        WHERE bot_id = ? AND guild_id = ? AND level = ? AND created_at >= ?
      `).get(botId, guildId, level, since).c;
    },

    /* ────────────── MOD ACTIONS ────────────────────────── */
    getModActions(botId, guildId, kind) {
      if (kind) {
        return db.prepare(
          'SELECT * FROM mod_actions WHERE bot_id = ? AND guild_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 200',
        ).all(botId, guildId, kind);
      }
      return db.prepare(
        'SELECT * FROM mod_actions WHERE bot_id = ? AND guild_id = ? ORDER BY created_at DESC LIMIT 200',
      ).all(botId, guildId);
    },

    addModAction(a) {
      const id = 'ma_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      db.prepare(`
        INSERT INTO mod_actions (id, bot_id, guild_id, user_id, moderator_id, kind, reason, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        a.botId,
        a.guildId,
        a.userId,
        a.moderatorId || null,
        a.kind,
        a.reason || null,
        a.expiresAt || null,
      );
      return id;
    },

    removeModAction(id) {
      db.prepare('DELETE FROM mod_actions WHERE id = ?').run(id);
    },

    /* ────────────── CUSTOM COMMANDS ────────────────────── */
    getCustomCommands(botId, guildId) {
      return db.prepare(
        'SELECT * FROM custom_commands WHERE bot_id = ? AND guild_id = ? ORDER BY name',
      ).all(botId, guildId);
    },

    createCustomCommand(c) {
      const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      db.prepare(`
        INSERT INTO custom_commands (id, bot_id, guild_id, name, description, type, response, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        c.botId,
        c.guildId,
        c.name,
        c.description || '',
        c.type || 'custom',
        c.response || '',
        c.enabled ? 1 : 0,
      );
      return id;
    },

    /**
     * Обновление кастомной команды. Поддерживает переименование.
     * Поля, переданные как `undefined` — не меняются (COALESCE).
     */
    updateCustomCommand(id, data) {
      db.prepare(`
        UPDATE custom_commands
        SET name        = COALESCE(?, name),
            description = COALESCE(?, description),
            response    = COALESCE(?, response),
            enabled     = COALESCE(?, enabled)
        WHERE id = ?
      `).run(
        data.name ?? null,
        data.description ?? null,
        data.response ?? null,
        data.enabled !== undefined ? (data.enabled ? 1 : 0) : null,
        id,
      );
    },

    deleteCustomCommand(id) {
      db.prepare('DELETE FROM custom_commands WHERE id = ?').run(id);
    },

    getCustomCommand(id) {
      return db.prepare('SELECT * FROM custom_commands WHERE id = ?').get(id);
    },

    /* ────────────── GUILD SETTINGS ─────────────────────── */
    getGuildSettings(botId, guildId) {
      let row = db.prepare(
        'SELECT * FROM guild_settings WHERE bot_id = ? AND guild_id = ?',
      ).get(botId, guildId);

      if (!row) {
        db.prepare(
          'INSERT INTO guild_settings (bot_id, guild_id) VALUES (?, ?)',
        ).run(botId, guildId);
        row = db.prepare(
          'SELECT * FROM guild_settings WHERE bot_id = ? AND guild_id = ?',
        ).get(botId, guildId);
      }

      return {
        ...row,
        excluded_roles: JSON.parse(row.excluded_roles || '[]'),
      };
    },

    setGuildSettings(botId, guildId, s) {
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
        botId,
        guildId,
        s.language || 'ru',
        s.welcomeChannel || null,
        s.logChannel || null,
        JSON.stringify(s.excludedRoles || []),
      );
    },

    /* ────────────── MEMBERS ────────────────────────────── */
    getAllMembersData(botId, guildId) {
      return db.prepare(
        'SELECT * FROM members WHERE bot_id = ? AND guild_id = ?',
      ).all(botId, guildId);
    },

    getMemberData(botId, guildId, userId) {
      return db.prepare(
        'SELECT * FROM members WHERE bot_id = ? AND guild_id = ? AND user_id = ?',
      ).get(botId, guildId, userId);
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

    /* ────────────── EVENTS (для статистики) ────────────── */
    addEvent(e) {
      db.prepare(`
        INSERT INTO events (bot_id, guild_id, user_id, type, meta)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        e.botId,
        e.guildId,
        e.userId || null,
        e.type,
        e.meta ? JSON.stringify(e.meta) : null,
      );
    },

    countEvents(botId, guildId, type, since = 0) {
      return db.prepare(`
        SELECT COUNT(*) as c FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = ? AND created_at >= ?
      `).get(botId, guildId, type, since).c;
    },

    countEvents24h(botId, guildId) {
      const since = Math.floor(Date.now() / 1000) - 86400;
      return db.prepare(`
        SELECT COUNT(*) as c FROM events
        WHERE bot_id = ? AND guild_id = ? AND created_at >= ?
      `).get(botId, guildId, since).c;
    },

    countUniqueUsers(botId, guildId, since = 0) {
      return db.prepare(`
        SELECT COUNT(DISTINCT user_id) as c FROM events
        WHERE bot_id = ? AND guild_id = ? AND created_at >= ? AND user_id IS NOT NULL
      `).get(botId, guildId, since).c;
    },

    /**
     * Агрегация событий по дням.
     * Возвращает [{ day: '2026-10-25', count: 42 }, ...]
     */
    getEventsByDay(botId, guildId, type, since) {
      return db.prepare(`
        SELECT
          date(created_at, 'unixepoch') as day,
          COUNT(*) as count
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = ? AND created_at >= ?
        GROUP BY day
        ORDER BY day
      `).all(botId, guildId, type, since);
    },

    /**
     * Топ команд за период.
     * Использует json_extract для извлечения meta.command.
     */
    getTopCommands(botId, guildId, since, limit = 5) {
      return db.prepare(`
        SELECT
          json_extract(meta, '$.command') as cmd,
          COUNT(*) as count
        FROM events
        WHERE bot_id = ? AND guild_id = ? AND type = 'command' AND created_at >= ?
        GROUP BY cmd
        ORDER BY count DESC
        LIMIT ?
      `).all(botId, guildId, since, limit);
    },

    /**
     * Последние события — объединение наказаний и логов.
     */
    getRecentActivity(botId, guildId, limit = 5) {
      return db.prepare(`
        SELECT 'mod' as source, kind as type, user_id, reason as message, created_at
        FROM mod_actions
        WHERE bot_id = ? AND guild_id = ?

        UNION ALL

        SELECT 'log' as source, module as type, NULL as user_id, message, created_at
        FROM logs
        WHERE bot_id = ? AND guild_id = ? AND level IN ('info', 'warn')

        ORDER BY created_at DESC
        LIMIT ?
      `).all(botId, guildId, botId, guildId, limit);
    },
  };
}