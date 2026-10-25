/* ============================================================
   Ежедневные бэкапы JSON-секций.

   Стратегия:
   - один бэкап на секцию в день
   - если бэкап за сегодня уже есть — не перезаписываем
   - храним N последних, старые удаляем по mtime

   Файлы: data/<guildId>/.backups/<section>-YYYY-MM-DD.json
   ============================================================ */

import fs from 'fs';
import path from 'path';

/* Сколько бэкапов хранить на секцию */
const MAX_BACKUP_FILES = 15;

/**
 * Делает бэкап файла, если за сегодня его ещё нет.
 * @param {string} file - полный путь к section.json
 * @returns {string|null} путь к бэкапу или null, если не создан
 */
export function backupFile(file) {
  try {
    const dir = path.join(path.dirname(file), '.backups');
    const base = path.basename(file, '.json');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const target = path.join(dir, `${base}-${today}.json`);

    /* За сегодня бэкап уже есть — не перезаписываем */
    if (fs.existsSync(target)) return null;

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, target);

    trimBackups(dir, base);
    return target;
  } catch (e) {
    console.error('backupFile error:', e.message);
    return null;
  }
}

/**
 * Удаляет старые бэкапы, оставляя MAX_BACKUP_FILES последних.
 * @param {string} dir
 * @param {string} base - basename без .json
 */
function trimBackups(dir, base) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(base + '-') && f.endsWith('.json'))
      .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const f of files.slice(MAX_BACKUP_FILES)) {
      fs.unlinkSync(path.join(dir, f.name));
    }
  } catch (e) {
    console.error('trimBackups error:', e.message);
  }
}

/**
 * Возвращает список бэкапов для секции (новые первыми).
 * @param {string} guildId
 * @param {string} section
 * @param {string} guildDirPath
 * @returns {Array<{ filename: string, date: string, timestamp: number }>}
 */
export function listBackups(guildId, section, guildDirPath) {
  const dir = path.join(guildDirPath, '.backups');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.startsWith(section + '-') && f.endsWith('.json'))
    .map(f => {
      /* формат: {section}-YYYY-MM-DD.json */
      const daily = f.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.json$/);
      if (daily) {
        const date = daily[2];
        const ts = new Date(date + 'T00:00:00Z').getTime();
        return { filename: f, date, timestamp: ts };
      }

      /* старый формат: {section}-{timestamp}.json */
      const legacy = f.match(/^(.+)-(\d{10,13})\.json$/);
      if (legacy) {
        const ts = parseInt(legacy[2], 10);
        const date = new Date(ts).toISOString().slice(0, 10);
        return { filename: f, date, timestamp: ts };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Восстанавливает секцию из бэкапа.
 * @param {string} guildId
 * @param {string} section
 * @param {string} guildDirPath
 * @param {string} filename
 */
export function restoreBackup(guildId, section, guildDirPath, filename) {
  const dir = path.join(guildDirPath, '.backups');
  const src = path.join(dir, filename);
  if (!fs.existsSync(src)) throw new Error('Backup not found');
  const dst = path.join(guildDirPath, `${section}.json`);
  fs.copyFileSync(src, dst);
}