/* ============================================================
   Загрузка и миграция config.json.

   Поддерживает два формата:
   - старый: { token, port }         → миграция в multi-bot
   - новый:  { port, bots, activeBotId }

   При обнаружении старого формата — перезаписывает файл.
   ============================================================ */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '..', '..', 'config.json');

/**
 * Загружает конфиг с диска, при необходимости мигрирует и сохраняет.
 * @returns {object} Валидный multi-bot конфиг.
 */
export function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const migrated = migrateConfig(raw);

  if (migrated.__changed) {
    delete migrated.__changed;
    saveConfig(migrated);
    console.log('[config] конфиг мигрирован в multi-bot формат');
  }
  return migrated;
}

/**
 * Сохраняет конфиг на диск.
 * @param {object} cfg
 */
export function saveConfig(cfg) {
  const clean = JSON.parse(JSON.stringify(cfg));
  delete clean.__changed;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(clean, null, 2));
}

/**
 * Приводит любой формат к multi-bot.
 * @param {object} cfg - сырой конфиг
 * @returns {object} с флагом __changed, если что-то поменяли
 */
function migrateConfig(cfg) {
  /* ---- старый формат: один токен ---- */
  if (cfg.token && !cfg.bots) {
    return {
      port: cfg.port ?? 3000,
      bots: [
        {
          id: 'main',
          label: 'Основной',
          token: cfg.token,
          activity: { type: 'WATCHING', text: 'за сервером', url: null }
        }
      ],
      activeBotId: 'main',
      __changed: true
    };
  }

  /* ---- новый формат, но нет дефолтов ---- */
  let changed = false;
  if (!Array.isArray(cfg.bots)) cfg.bots = [];

  for (const bot of cfg.bots) {
    if (!bot.activity) {
      bot.activity = { type: 'WATCHING', text: 'за сервером', url: null };
      changed = true;
    }
    if (!bot.label) {
      bot.label = bot.id;
      changed = true;
    }
  }

  if (!cfg.activeBotId && cfg.bots[0]) {
    cfg.activeBotId = cfg.bots[0].id;
    changed = true;
  }

  if (changed) cfg.__changed = true;
  return cfg;
}

export { CONFIG_PATH };