import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { backupFile } from './backups.js';
import { migrate, CURRENT_VERSION } from './migrations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '..', 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const BACKUP_SECTIONS = new Set([
  'rules',
  'messages',
  'announcements',
  'delayed',
  'autodelete',
  'birthdays',
  'profiles',
  'settings'
]);

export function guildDir(guildId) {
  const dir = path.join(DATA_DIR, guildId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sectionFile(guildId, section) {
  return path.join(guildDir(guildId), `${section}.json`);
}

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

export function readSection(guildId, section) {
  const file = sectionFile(guildId, section);
  if (!fs.existsSync(file)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const migrated = migrate(section, raw);

    if (migrated.__needsWrite) {
      delete migrated.__needsWrite;
      writeSection(guildId, section, migrated.data);
    }
    return migrated.data;
  } catch (e) {
    console.error(`readSection error [${guildId}/${section}]:`, e.message);
    return null;
  }
}

export function writeSection(guildId, section, data) {
  const file = sectionFile(guildId, section);

  if (BACKUP_SECTIONS.has(section) && fs.existsSync(file)) {
    backupFile(file);
  }

  const payload = {
    version: CURRENT_VERSION,
    updatedAt: new Date().toISOString(),
    data
  };

  atomicWrite(file, payload);
  return payload;
}

export function listGuilds() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR).filter(name => {
    const stat = fs.statSync(path.join(DATA_DIR, name));
    return stat.isDirectory() && !name.startsWith('.');
  });
}