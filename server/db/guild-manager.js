// server/db/guild-manager.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runGuildMigrations } from './guild-migrations.js';
import { runWithConcurrency } from '../core/concurrency.js';
import { createModulesRepo } from './repositories/modules.js';
import { createMembersRepo } from './repositories/members.js';
import { createModerationRepo } from './repositories/moderation.js';
import { createCommandsRepo } from './repositories/commands.js';
import { createEventsRepo } from './repositories/events.js';
import { createUserProfilesRepo } from './repositories/userProfiles.js';
import { createStickyRepo } from './repositories/sticky.js';
import { createAutodeleteRepo } from './repositories/autodelete.js';
import { createScheduledRepo } from './repositories/scheduled.js';
import { createMessageTemplatesRepo } from './repositories/message-templates.js';
import { createRoleButtonsRepo } from './repositories/role-buttons.js';

const MAX_OPEN_CONNECTIONS = 200;
const IDLE_EVICT_MS = 30 * 60_000;

function openDbWithPragmas(dbPath) {
  const raw = new Database(dbPath);
  raw.pragma('journal_mode = WAL');
  raw.pragma('foreign_keys = ON');
  raw.pragma('busy_timeout = 5000');
  return raw;
}

function digitsOnly(s) {
  return String(s == null ? '' : s).replace(/[^0-9]/g, '');
}

export class GuildDbManager {
  constructor({ baseDir, logger }) {
    this.baseDir = path.join(baseDir, 'guilds');
    this.logger = logger;
    this.connections = new Map();
    fs.mkdirSync(this.baseDir, { recursive: true });

    try { this._migrateOldLayout(); }
    catch (err) { this.logger?.warn({ err }, 'guild-db: initial migration failed'); }
  }

  _key(botId, guildId) { return `${botId}:${guildId}`; }
  _folder(guildId) { return path.join(this.baseDir, digitsOnly(guildId)); }
  _file(botId) { return `${digitsOnly(botId)}.sqlite`; }
  _pathExisting(botId, guildId) { return path.join(this._folder(guildId), this._file(botId)); }
  _path(botId, guildId) {
    const dir = this._folder(guildId);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, this._file(botId));
  }

  _migrateOldLayout() {
    if (!fs.existsSync(this.baseDir)) return 0;

    let entries;
    try { entries = fs.readdirSync(this.baseDir, { withFileTypes: true }); }
    catch { return 0; }

    let moved = 0;
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.sqlite')) continue;
      const base = entry.name.replace(/\.sqlite$/, '');
      const parts = base.split('_');
      if (parts.length !== 2) continue;
      const [botId, guildId] = parts;
      if (!/^\d+$/.test(botId) || !/^\d+$/.test(guildId)) continue;

      const oldPath = path.join(this.baseDir, entry.name);
      const newPath = this._path(botId, guildId);
      if (fs.existsSync(newPath)) continue;

      try {
        fs.renameSync(oldPath, newPath);
        for (const ext of ['-wal', '-shm']) {
          const oldSide = oldPath + ext;
          if (fs.existsSync(oldSide)) {
            try { fs.renameSync(oldSide, newPath + ext); } catch {}
          }
        }
        moved++;
      } catch (err) {
        this.logger?.warn({ err, file: entry.name }, 'guild-db: migrate old layout failed');
      }
    }
    if (moved > 0) {
      this.logger?.info({ moved }, 'guild-db: migrated to per-guild folders');
    }
    return moved;
  }

  _ensureSchema(raw, guildId) {
    try {
      const tables = new Set(
        raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
      );

      if (tables.has('mod_actions')) {
        const cols = new Set(raw.prepare('PRAGMA table_info(mod_actions)').all().map((r) => r.name));
        let healed = false;
        if (!cols.has('removed_at')) { raw.exec('ALTER TABLE mod_actions ADD COLUMN removed_at INTEGER'); healed = true; }
        if (!cols.has('removed_by')) { raw.exec('ALTER TABLE mod_actions ADD COLUMN removed_by TEXT'); healed = true; }

        raw.exec(`
          CREATE INDEX IF NOT EXISTS idx_mod_actions_status ON mod_actions(removed_at, expires_at, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_mod_actions_kind ON mod_actions(kind, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON mod_actions(moderator_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_mod_actions_user ON mod_actions(user_id, created_at DESC);
        `);

        if (healed) {
          this.logger?.warn({ guildId }, 'guild-db: self-heal applied — mod_actions was missing removed_at/removed_by');
        }
      }

      if (tables.has('logs')) {
        const cols = new Set(raw.prepare('PRAGMA table_info(logs)').all().map((r) => r.name));
        if (!cols.has('user_id')) {
          raw.exec('ALTER TABLE logs ADD COLUMN user_id TEXT');
          raw.exec('CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id, created_at DESC)');
          this.logger?.warn({ guildId }, 'guild-db: self-heal added logs.user_id');
        }
      }
    } catch (err) {
      this.logger?.error({ err, guildId }, 'guild-db: self-heal failed');
    }
  }

  get(botId, guildId) {
    const k = this._key(botId, guildId);
    let entry = this.connections.get(k);
    const now = Date.now();

    if (entry) {
      this.connections.delete(k);
      entry.last_used = now;
      this.connections.set(k, entry);
      return entry.repos;
    }

    if (this.connections.size >= MAX_OPEN_CONNECTIONS) {
      const oldestKey = this.connections.keys().next().value;
      const oldest = this.connections.get(oldestKey);
      try { oldest?.raw?.close(); } catch {}
      this.connections.delete(oldestKey);
      this.logger?.info({ evicted: oldestKey, size: this.connections.size }, 'guild-db: LRU evict');
    }

    const dbPath = this._path(botId, guildId);
    const raw = openDbWithPragmas(dbPath);
    runGuildMigrations(raw, this.logger, guildId);
    this._ensureSchema(raw, guildId);

    const repos = {
      raw,
      ...createModulesRepo(raw),
      ...createMembersRepo(raw),
      ...createModerationRepo(raw),
      ...createCommandsRepo(raw),
      ...createEventsRepo(raw),
      ...createUserProfilesRepo(raw),
      ...createStickyRepo(raw),
      ...createAutodeleteRepo(raw),
      ...createScheduledRepo(raw),
      ...createMessageTemplatesRepo(raw),
      ...createRoleButtonsRepo(raw),
    };
    entry = { raw, repos, last_used: now };
    this.connections.set(k, entry);
    return repos;
  }

  sweepIdle() {
    const cutoff = Date.now() - IDLE_EVICT_MS;
    let closed = 0;
    for (const [k, entry] of this.connections) {
      if (entry.last_used < cutoff) {
        try { entry.raw.close(); } catch {}
        this.connections.delete(k);
        closed++;
      }
    }
    if (closed > 0) {
      this.logger?.debug({ closed, size: this.connections.size }, 'guild-db: swept idle connections');
    }
    return closed;
  }

  delete(botId, guildId) {
    const k = this._key(botId, guildId);
    const entry = this.connections.get(k);
    if (entry) {
      try { entry.raw.close(); } catch {}
      this.connections.delete(k);
    }

    const dbPath = this._pathExisting(botId, guildId);
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      for (const ext of ['-wal', '-shm']) {
        const p = dbPath + ext;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      try {
        const dir = this._folder(guildId);
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      } catch {}
      return true;
    } catch (err) {
      this.logger?.warn({ err, botId, guildId }, 'guild-db: delete failed');
      return false;
    }
  }

  closeAll() {
    for (const [, entry] of this.connections) {
      try { entry.raw.close(); } catch {}
    }
    this.connections.clear();
  }

  listOpen() {
    return [...this.connections.keys()].map((k) => {
      const [botId, guildId] = k.split(':');
      return { botId, guildId };
    });
  }

  async applyAllMigrations() {
    if (!fs.existsSync(this.baseDir)) return 0;
    this._migrateOldLayout();

    const folders = fs.readdirSync(this.baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const tasks = [];
    for (const guildId of folders) {
      const dir = path.join(this.baseDir, guildId);
      let files;
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')); }
      catch { continue; }
      for (const f of files) {
        tasks.push({ fullPath: path.join(dir, f), guildId, file: f });
      }
    }

    await runWithConcurrency(tasks, 5, async (t) => {
      try {
        const raw = openDbWithPragmas(t.fullPath);
        runGuildMigrations(raw, this.logger, t.guildId);
        this._ensureSchema(raw, t.guildId);
        raw.close();
        return true;
      } catch (err) {
        this.logger?.warn({ err, file: t.file, guildId: t.guildId }, 'guild-db: migration failed');
        return false;
      }
    });

    this.logger?.info({ count: tasks.length, folders: folders.length }, 'guild-db: migrations applied on startup');
    return tasks.length;
  }

  purgeAll(table, cutoff) {
    const validTables = ['events', 'logs', 'panel_audit'];
    if (!validTables.includes(table)) return 0;
    if (!fs.existsSync(this.baseDir)) return 0;

    let total = 0;
    const folders = fs.readdirSync(this.baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const folder of folders) {
      const dir = path.join(this.baseDir, folder.name);
      let files;
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')); }
      catch { continue; }

      for (const f of files) {
        try {
          const raw = openDbWithPragmas(path.join(dir, f));
          total += raw.prepare(`DELETE FROM ${table} WHERE created_at < ?`).run(cutoff).changes;
          raw.close();
        } catch {}
      }
    }
    return total;
  }
}