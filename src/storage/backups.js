import fs from 'fs';
import path from 'path';

/* ============================================================
   Храним один бэкап в день на секцию. Так как старые файлы
   назывались {section}-{timestamp}.json — trimBackups
   использует mtime (а не имя), чтобы корректно чистить оба формата.
   ============================================================ */
const MAX_BACKUP_FILES = 15; // 14 дней + 1 запасной

export function backupFile(file) {
  try {
    const dir = path.join(path.dirname(file), '.backups');
    const base = path.basename(file, '.json');
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const target = path.join(dir, `${base}-${today}.json`);

    /* Бэкап дня уже создан — больше не плодим файлы */
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

function trimBackups(dir, base) {
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(base + '-') && f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        return { name: f, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // newest first

    for (const f of files.slice(MAX_BACKUP_FILES)) {
      fs.unlinkSync(path.join(dir, f.name));
    }
  } catch (e) {
    console.error('trimBackups error:', e.message);
  }
}

/* ============================================================
   listBackups — поддерживает и новый формат (YYYY-MM-DD),
   и старый ({timestamp}).
   ============================================================ */
export function listBackups(guildId, section, guildDir) {
  const dir = path.join(guildDir, '.backups');
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.startsWith(section + '-') && f.endsWith('.json'))
    .map(f => {
      /* новый: {section}-YYYY-MM-DD.json */
      const daily = f.match(/^(.+)-(\d{4}-\d{2}-\d{2})\.json$/);
      if (daily) {
        const date = daily[2];
        const ts = new Date(date + 'T00:00:00Z').getTime();
        return { filename: f, date, timestamp: ts };
      }
      /* старый: {section}-{timestamp}.json */
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

export function restoreBackup(guildId, section, guildDir, filename) {
  const dir = path.join(guildDir, '.backups');
  const src = path.join(dir, filename);
  if (!fs.existsSync(src)) throw new Error('Backup not found');
  const dst = path.join(guildDir, `${section}.json`);
  fs.copyFileSync(src, dst);
}