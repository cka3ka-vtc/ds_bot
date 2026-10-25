/* ============================================================
   Файловое хранилище JSON с кэшем в памяти.

   Структура на диске:
     data/<guildId>/<section>.json
     data/<guildId>/.backups/<section>-YYYY-MM-DD.json

   Кэш: каждая запись живёт 2 секунды — защита от «N запросов
   в секунду к одному файлу» без риска устаревших данных надолго.
   ============================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupFile } from './backups.js';
import { migrate, CURRENT_VERSION } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* Секции, для которых делаются ежедневные бэкапы */
const BACKUP_SECTIONS = new Set([
  'rules', 'messages', 'announcements', 'delayed', 'autodelete',
  'birthdays', 'profiles', 'settings'
]);

/* TTL кэша в памяти */
const CACHE_TTL_MS = 2000;

/* key = `${guildId}:${section}` → { data, expires } */
const cache = new Map();

/**
 * Возвращает путь к папке гильдии, создавая её при необходимости.
 * @param {string} guildId
 * @returns {string}
 */
export function guildDir(guildId) {
  const dir = path.join(DATA_DIR, guildId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Полный путь к файлу секции.
 * @param {string} guildId
 * @param {string} section
 * @returns {string}
 */
export function sectionFile(guildId, section) {
  return path.join(guildDir(guildId), `${section}.json`);
}

/**
 * Атомарная запись: временный файл → rename.
 * Предотвращает повреждение JSON при падении во время записи.
 * @param {string} file
 * @param {object} payload
 */
function atomicWrite(file, payload) {
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(payload, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/**
 * Читает секцию с диска (или из кэша).
 * Автоматически применяет миграции, если версия схемы устарела.
 * @param {string} guildId
 * @param {string} section
 * @returns {object|null}
 */
export function readSection(guildId, section) {
  const key = `${guildId}:${section}`;

  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return structuredClone(entry.data);
  }

  const file = sectionFile(guildId, section);
  if (!fs.existsSync(file)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const migrated = migrate(section, raw);

    if (migrated.__needsWrite) {
      delete migrated.__needsWrite;
      writeSection(guildId, section, migrated.data);
    }

    cache.set(key, { data: migrated.data, expires: Date.now() + CACHE_TTL_MS });
    return structuredClone(migrated.data);
  } catch (e) {
    console.error(`readSection error [${guildId}/${section}]:`, e.message);
    return null;
  }
}

/**
 * Пишет секцию на диск с атомарной записью и бэкапом.
 * @param {string} guildId
 * @param {string} section
 * @param {object} data
 * @returns {{version: number, updatedAt: string, data: object}}
 */
export function writeSection(guildId, section, data) {
  const key = `${guildId}:${section}`;
  const file = sectionFile(guildId, section);

  /* Бэкап перед перезаписью */
  if (BACKUP_SECTIONS.has(section) && fs.existsSync(file)) {
    backupFile(file);
  }

  const payload = {
    version: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
    data
  };

  atomicWrite(file, payload);
  cache.set(key, { data: structuredClone(data), expires: Date.now() + CACHE_TTL_MS });
  return payload;
}

/**
 * Сбрасывает кэш для гильдии (все секции) или конкретной секции.
 * @param {string} guildId
 * @param {string} [section]
 */
export function invalidateCache(guildId, section) {
  if (section) {
    cache.delete(`${guildId}:${section}`);
  } else {
    for (const k of cache.keys()) {
      if (k.startsWith(`${guildId}:`)) cache.delete(k);
    }
  }
}

/**
 * Список гильдий, для которых есть данные.
 * @returns {string[]}
 */
export function listGuilds() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR).filter(name => {
    const stat = fs.statSync(path.join(DATA_DIR, name));
    return stat.isDirectory() && !name.startsWith('.');
  });
}