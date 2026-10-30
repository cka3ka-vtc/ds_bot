// server/db/guild-manager.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runGuildMigrations } from './guild-migrations.js';
import { createModulesRepo } from './repositories/modules.js';
import { createMembersRepo } from './repositories/members.js';
import { createModerationRepo } from './repositories/moderation.js';
import { createCommandsRepo } from './repositories/commands.js';
import { createEventsRepo } from './repositories/events.js';
import { createUserProfilesRepo } from './repositories/userProfiles.js';

function digitsOnly(s) {
  return String(s == null ? '' : s).replace(/[^0-9]/g, '');
}

export class GuildDbManager {
  constructor({ baseDir, logger }) {
    this.baseDir = path.join(baseDir, 'guilds');
    this.logger = logger;
    this.connections = new Map();
    fs.mkdirSync(this.baseDir, { recursive: true });

    // Автомиграция старого плоского layout → per-guild папки.
    try { this._migrateOldLayout(); }
    catch (err) { this.logger?.warn({ err }, 'guild-db: initial migration failed'); }
  }

  _key(botId, guildId) {
    return `${botId}:${guildId}`;
  }

  _folder(guildId) {
    return path.join(this.baseDir, digitsOnly(guildId));
  }

  _file(botId) {
    return `${digitsOnly(botId)}.sqlite`;
  }

  /** Путь без создания папки (для delete / проверок). */
  _pathExisting(botId, guildId) {
    return path.join(this._folder(guildId), this._file(botId));
  }

  /** Путь с гарантированным созданием папки гильдии (для get). */
  _path(botId, guildId) {
    const dir = this._folder(guildId);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, this._file(botId));
  }

  /**
   * Старый формат: data/guilds/<botId>_<guildId>.sqlite (+wal/shm)
   * Новый формат: data/guilds/<guildId>/<botId>.sqlite (+wal/shm)
   *
   * Discord ID — всегда только цифры, поэтому split('_') безопасен.
   */
  _migrateOldLayout() {
    if (!fs.existsSync(this.baseDir)) return 0;

    let entries;
    try { entries = fs.readdirSync(this.baseDir, { withFileTypes: true }); }
    catch { return 0; }

    let moved = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.sqlite')) continue;

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

  get(botId, guildId) {
    const k = this._key(botId, guildId);
    let entry = this.connections.get(k);
    if (entry) return entry.repos;

    const dbPath = this._path(botId, guildId);
    const raw = new Database(dbPath);
    raw.pragma('journal_mode = WAL');
    raw.pragma('foreign_keys = ON');
    runGuildMigrations(raw, this.logger, guildId);

    const repos = {
      raw,
      ...createModulesRepo(raw),
      ...createMembersRepo(raw),
      ...createModerationRepo(raw),
      ...createCommandsRepo(raw),
      ...createEventsRepo(raw),
      ...createUserProfilesRepo(raw),
    };
    entry = { raw, repos };
    this.connections.set(k, entry);
    return repos;
  }

  /** Полное удаление БД гильдии с диска. */
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
      // Если папка гильдии опустела — удаляем её
      try {
        const dir = this._folder(guildId);
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
        }
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

  /** Прогнать миграции на всех БД гильдий при старте. */
  async applyAllMigrations() {
    if (!fs.existsSync(this.baseDir)) return 0;

    this._migrateOldLayout();

    const folders = fs.readdirSync(this.baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    let applied = 0;
    for (const guildId of folders) {
      const dir = path.join(this.baseDir, guildId);
      let files;
      try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.sqlite')); }
      catch { continue; }

      for (const f of files) {
        try {
          const fullPath = path.join(dir, f);
          const raw = new Database(fullPath);
          raw.pragma('journal_mode = WAL');
          runGuildMigrations(raw, this.logger, guildId);
          raw.close();
          applied++;
        } catch (err) {
          this.logger?.warn({ err, file: f, guildId }, 'guild-db: migration failed');
        }
      }
    }

    this.logger?.info({ count: applied }, 'guild-db: migrations applied on startup');
    return applied;
  }

  /** Retention: удаление старых строк во всех БД гильдий по указанной таблице. */
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
          const raw = new Database(path.join(dir, f));
          total += raw.prepare(`DELETE FROM ${table} WHERE created_at < ?`).run(cutoff).changes;
          raw.close();
        } catch {}
      }
    }
    return total;
  }
}