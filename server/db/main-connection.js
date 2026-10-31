// server/db/main-connection.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMainMigrations } from './main-migrations.js';

let mainDb = null;

export function initMainConnection(dbPath, logger) {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'guilds'), { recursive: true });

  mainDb = new Database(dbPath);
  mainDb.pragma('journal_mode = WAL');
  mainDb.pragma('foreign_keys = ON');
  mainDb.pragma('busy_timeout = 5000');
  runMainMigrations(mainDb, logger);
  return mainDb;
}

export function getMainConnection() {
  if (!mainDb) throw new Error('main db not initialized');
  return mainDb;
}