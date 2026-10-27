// server/db/connection.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migrations.js';

let db = null;

export function initConnection(dbPath, logger) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db, logger);
  return db;
}

export function getConnection() {
  if (!db) throw new Error('db not initialized');
  return db;
}