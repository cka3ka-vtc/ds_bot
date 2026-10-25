/* ============================================================
   Логгер действий бота (по гильдиям).

   Пишет в data/<guildId>/logs.json, хранит последние 500 записей.
   Буферизация: события копятся в памяти и сбрасываются на диск
   раз в 2 секунды. Это критично — иначе 100 сообщений в секунду
   дадут 100 парных чтений/записей файла, что заблокирует event loop.
   ============================================================ */

import crypto from 'crypto';
import { readSection, writeSection } from '../storage/index.js';
import { notifySectionUpdate } from './sse-hub.js';

const MAX_LOGS = 500;
const FLUSH_INTERVAL_MS = 2000;

/* guildId → массив накопленных записей */
let buffer = new Map();

/* Отложенный таймер сброса (один на все гильдии) */
let flushTimer = null;

/**
 * Планирует сброс буфера через FLUSH_INTERVAL_MS.
 * unref() — чтобы таймер не держал процесс при shutdown.
 */
function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAll();
  }, FLUSH_INTERVAL_MS).unref();
}

/**
 * Записывает событие в буфер.
 * @param {string} guildId
 * @param {'info'|'warn'|'error'} level
 * @param {string} type - тип события (birthday_send, role_toggle и т. д.)
 * @param {string} message - человекочитаемое описание
 * @param {object} [context] - структурированные данные
 * @param {string|null} [stack] - стек ошибки (для level='error')
 */
export function log(guildId, level, type, message, context = {}, stack = null) {
  if (!buffer.has(guildId)) buffer.set(guildId, []);
  buffer.get(guildId).push({
    id: 'log_' + crypto.randomBytes(6).toString('hex'),
    level,
    type,
    message: String(message).slice(0, 2000),
    stack: stack ? String(stack).slice(0, 4000) : null,
    context,
    timestamp: new Date().toISOString()
  });
  scheduleFlush();
}

/**
 * Принудительно сбрасывает буфер на диск.
 * Вызывается автоматически, а также при graceful shutdown.
 */
export function flushAll() {
  if (!buffer.size) return;

  for (const [guildId, entries] of buffer) {
    if (!entries.length) continue;

    try {
      const data = readSection(guildId, 'logs') || { items: [] };
      if (!data.items) data.items = [];

      /* Новые записи добавляем в начало */
      data.items.unshift(...entries);
      if (data.items.length > MAX_LOGS) data.items.length = MAX_LOGS;

      writeSection(guildId, 'logs', data);
      notifySectionUpdate(guildId, 'logs');
    } catch (e) {
      console.error('guild-logger.flush failed:', e.message);
    }
  }

  buffer = new Map();
}

/* Удобные обёртки */
export const logInfo  = (guildId, type, message, context = {}) => log(guildId, 'info', type, message, context);
export const logWarn  = (guildId, type, message, context = {}) => log(guildId, 'warn', type, message, context);
export const logError = (guildId, type, message, context = {}, stack = null) => log(guildId, 'error', type, message, context, stack);

/**
 * Полная очистка логов гильдии.
 * @param {string} guildId
 */
export function clearLogs(guildId) {
  buffer.delete(guildId);
  writeSection(guildId, 'logs', { items: [] });
  notifySectionUpdate(guildId, 'logs');
}

/**
 * Группирует записи по типу для UI.
 * @param {Array<object>} items
 * @returns {Array<{ type:string, count:number, errorCount:number, warnCount:number, lastAt:string, logs:Array }>}
 */
export function groupLogs(items) {
  const groups = {};
  for (const l of items) {
    if (!groups[l.type]) groups[l.type] = [];
    groups[l.type].push(l);
  }
  return Object.entries(groups)
    .map(([type, logs]) => ({
      type,
      count: logs.length,
      errorCount: logs.filter(l => l.level === 'error').length,
      warnCount: logs.filter(l => l.level === 'warn').length,
      lastAt: logs[0]?.timestamp,
      logs
    }))
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}