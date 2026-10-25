/* ============================================================
   Планировщик задач.

   Каждые 30 секунд запускает цепочку обработчиков:
   1. Объявления по расписанию (autoposts.js)
   2. Отложенные сообщения (delayed.js)
   3. Автоудаление очереди (autodelete-queue.js)
   4. Поздравления с ДР (birthdays.js)

   Защита от наложения: если предыдущий тик ещё идёт —
   следующий пропускается.

   Параллельность по гильдиям: Promise.allSettled,
   чтобы одна медленная гильдия не блокировала остальные.
   ============================================================ */

import { getClient } from '../client.js';
import { readSection, writeSection } from '../../storage/index.js';
import { logInfo, logError } from '../../services/guild-logger.js';
import { notifySectionUpdate } from '../../services/sse-hub.js';
import { isModuleEnabled } from '../../services/discord-cache.js';
import { shutdownAutodelete } from '../autodelete.js';

import { processAutoposts } from './autoposts.js';
import { processDelayed } from './delayed.js';
import { processBirthdays } from './birthdays.js';
import { processAutodeleteQueue } from './autodelete-queue.js';
import { computeNextRun } from '../../services/announcements.js';

let schedulerRunning = false;
let schedulerInterval = null;

/* ============================================================
   Публичный API
   ============================================================ */

/**
 * Запускает планировщик. Первый тик — через 5 секунд.
 */
export function startScheduler() {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(tick, 30_000);
  setTimeout(tick, 5_000);
  console.log('⏱  Планировщик запущен');
}

/**
 * Останавливает планировщик и сбрасывает очередь автоудаления.
 */
export function stopScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
  shutdownAutodelete();
}

/**
 * Восстанавливает расписания объявлений после рестарта.
 * Если бот был выключен, nextRunAt мог уйти в прошлое —
 * пересчитываем или запускаем немедленно.
 */
export function recoverScheduler() {
  const client = getClient();
  for (const guild of client.guilds.cache.values()) {
    recoverAutoposts(guild);
  }
  console.log('🔁 Планировщик восстановлен');
}

/* ============================================================
   Внутренние функции
   ============================================================ */

function recoverAutoposts(guild) {
  const data = readSection(guild.id, 'announcements');
  if (!data?.items?.length) return;

  let changed = false;
  const now = Date.now();
  const grace = 5 * 60_000; // 5 минут — если пропустили недавно, отправим

  for (const ann of data.items) {
    if (!ann.enabled) { ann.nextRunAt = null; continue; }
    if (ann.schedule?.type === 'manual') { ann.nextRunAt = null; continue; }

    if (!ann.nextRunAt) {
      ann.nextRunAt = computeNextRun(ann, now);
      changed = true;
      continue;
    }

    if (ann.nextRunAt < now) {
      const missed = now - ann.nextRunAt;
      if (ann.schedule.type === 'interval') ann.nextRunAt = now;
      else if (missed <= grace) ann.nextRunAt = now;
      else ann.nextRunAt = computeNextRun(ann, now);
      changed = true;
    }
  }

  if (changed) writeSection(guild.id, 'announcements', data);
}

/**
 * Один тик планировщика.
 * Защита от наложения через schedulerRunning.
 */
async function tick() {
  if (schedulerRunning) return;
  schedulerRunning = true;

  try {
    const client = getClient();

    /* Параллельно по всем гильдиям с ограничением через allSettled */
    await Promise.allSettled(
      [...client.guilds.cache.values()].map(guild => processGuild(guild))
    );

    /* Обработчики, не привязанные к конкретной гильдии */
    await processAutodeleteQueue(client);
    await processBirthdays(client);
  } catch (e) {
    console.error('scheduler tick error:', e);
  } finally {
    schedulerRunning = false;
  }
}

/**
 * Обработка одной гильдии: autoposts + delayed.
 * @param {import('discord.js').Guild} guild
 */
async function processGuild(guild) {
  try {
    await processAutoposts(guild);
  } catch (e) {
    console.error(`[scheduler] autoposts ${guild.id}:`, e.message);
  }

  try {
    await processDelayed(guild);
  } catch (e) {
    console.error(`[scheduler] delayed ${guild.id}:`, e.message);
  }
}