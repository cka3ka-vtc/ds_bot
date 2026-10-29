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

function safeName(botId, guildId) {
  return `${botId}_${guildId}`.replace(/[^0-9a-zA-Z_]/g, '');
}

export class GuildDbManager {
  constructor({ baseDir, logger }) {
    this.baseDir = path.join(baseDir, 'guilds');
    this.logger = logger;
    this.connections = new Map();
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _key(botId, guildId) {
    return `${botId}:${guildId}`;
  }

  _path(botId, guildId) {
    return path.join(this.baseDir, `${safeName(botId, guildId)}.sqlite`);
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
    const dbPath = this._path(botId, guildId);
    try {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      for (const ext of ['-wal', '-shm']) {
        const p = dbPath + ext;
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
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

  /** Применить миграции ко всем БД гильдий при старте. */
  async applyAllMigrations() {
    if (!fs.existsSync(this.baseDir)) return 0;
    const files = fs.readdirSync(this.baseDir).filter((f) => f.endsWith('.sqlite'));
    let applied = 0;
    for (const f of files) {
      const fullPath = path.join(this.baseDir, f);
      try {
        const raw = new Database(fullPath);
        raw.pragma('journal_mode = WAL');
        runGuildMigrations(raw, this.logger, f.replace('.sqlite', ''));
        raw.close();
        applied++;
      } catch (err) {
        this.logger?.warn({ err, file: f }, 'guild-db: migration failed');
      }
    }
    this.logger?.info({ count: applied }, 'guild-db: migrations applied on startup');
    return applied;
  }

  /** Retention: удаляет старые строки во всех БД гильдий по указанной таблице. */
  purgeAll(table, cutoff) {
    const validTables = ['events', 'logs', 'panel_audit'];
    if (!validTables.includes(table)) return 0;
    if (!fs.existsSync(this.baseDir)) return 0;
    let total = 0;
    for (const f of fs.readdirSync(this.baseDir).filter((x) => x.endsWith('.sqlite'))) {
      try {
        const raw = new Database(path.join(this.baseDir, f));
        total += raw.prepare(`DELETE FROM ${table} WHERE created_at < ?`).run(cutoff).changes;
        raw.close();
      } catch {}
    }
    return total;
  }
}