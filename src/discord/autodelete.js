/* ============================================================
   Автоудаление сообщений.

   Две задачи:
   1. В каналах команд (birthdays.channelId, profiles.channelId) —
      удалять ВСЁ, кроме сообщений бота и legacy `!` команд.
   2. В обычных каналах — применять правила из autodelete.json:
      • instant — удалять сразу
      • delayed — ставить в очередь на удаление через N минут

   Очередь удалений хранится в autodelete-queue.json и
   обрабатывается отдельным модулем (scheduler/autodelete-queue.js).

   ⚠️ ВАЖНО: этот модуль НЕ обрабатывает очередь.
   Он только ловит messageCreate и складывает в очередь.
   ============================================================ */

import { readSection, writeSection } from '../storage/index.js';
import { logInfo, logError } from '../services/guild-logger.js';
import { isModuleEnabled } from '../services/discord-cache.js';

/* Кэши правил и «каналов команд» — с TTL, чтобы не читать файлы
   на каждое сообщение */
const RULES_TTL = 5000;
const CHANNELS_TTL = 5000;

const rulesCache = new Map();      // guildId → { rules, expires }
const channelsCache = new Map();   // guildId → { channelIds: Set, expires }

/* Очередь в памяти: guildId → массив { channelId, messageId, deleteAt } */
const queues = new Map();

/* Гильдии, у которых очередь изменилась и её нужно сбросить на диск */
const dirty = new Set();

/* Legacy-префиксы — их не удаляем сразу, оставляем redirect */
const LEGACY_PREFIXES = ['!hb', '!profile', '!vtc', '!steam', '!hmp', '!tmp', '!company'];

let initializedOn = null;
let flushTimer = null;

/* ============================================================
   Инициализация
   ============================================================ */

/**
 * Вешает обработчик messageCreate на клиент. Один раз за жизнь процесса.
 * @param {import('discord.js').Client} client
 */
export function initAutodelete(client) {
  if (initializedOn === client) return;
  initializedOn = client;
  client.on('messageCreate', handleMessage);
  console.log('[autodelete] ✅ messageCreate handler REGISTERED');
}

/* ============================================================
   Каналы команд и правила
   ============================================================ */

/**
 * Возвращает Set id каналов, где живут команды.
 * В этих каналах запрещены любые «болталки».
 * @param {string} guildId
 * @returns {Set<string>}
 */
function getCommandChannels(guildId) {
  const entry = channelsCache.get(guildId);
  if (entry && entry.expires > Date.now()) return entry.channelIds;

  const set = new Set();

  const birthdays = readSection(guildId, 'birthdays');
  if (birthdays?.settings?.channelId) set.add(birthdays.settings.channelId);

  const profiles = readSection(guildId, 'profiles');
  if (profiles?.settings?.channelId) set.add(profiles.settings.channelId);

  channelsCache.set(guildId, { channelIds: set, expires: Date.now() + CHANNELS_TTL });
  return set;
}

/**
 * Инвалидирует кэш каналов команд (вызывается при сохранении настроек).
 * @param {string} guildId
 */
export function invalidateCommandChannels(guildId) {
  channelsCache.delete(guildId);
}

function getRules(guildId) {
  const entry = rulesCache.get(guildId);
  if (entry && entry.expires > Date.now()) return entry.rules;

  const data = readSection(guildId, 'autodelete');
  const rules = data?.items || [];
  rulesCache.set(guildId, { rules, expires: Date.now() + RULES_TTL });
  return rules;
}

/**
 * Инвалидирует кэш правил (при сохранении правил из UI).
 * @param {string} guildId
 */
export function invalidateAutodeleteRules(guildId) {
  rulesCache.delete(guildId);
}

/* ============================================================
   Обработчик сообщений
   ============================================================ */

function isLegacyCommand(content) {
  if (!content) return false;
  const t = content.trimStart().toLowerCase();
  return LEGACY_PREFIXES.some(p => t === p || t.startsWith(p + ' '));
}

async function handleMessage(message) {
  try {
    if (!message.guild || message.system) return;

    const guildId = message.guild.id;

    /* Сообщения от нашего бота — не трогаем */
    if (message.author.id === message.client.user?.id) return;
    if (message.author.bot) return;

    /* Legacy-команды — их обработает redirect */
    if (isLegacyCommand(message.content)) return;

    /* Каналы команд — блокируем всё */
    const commandChannels = getCommandChannels(guildId);
    if (commandChannels.has(message.channel.id)) {
      await deleteMessageWithLog(
        message, guildId,
        'command_channel_lock',
        'Удалено постороннее сообщение в канале команд'
      );
      return;
    }

    /* Модуль выключен глобально */
    if (!isModuleEnabled(guildId, 'autodelete')) return;

    const rules = getRules(guildId);
    if (!rules.length) return;

    const rule = rules.find(r => r.enabled && r.channelId === message.channel.id);
    if (!rule) return;

    /* Мгновенное удаление */
    if (rule.mode === 'instant') {
      await deleteMessageWithLog(
        message, guildId,
        'autodelete_instant',
        `Мгновенное удаление в #${message.channel.name}`
      );
      return;
    }

    /* Отложенное — в очередь */
    if (rule.mode === 'delayed' && rule.deleteAfterMinutes > 0) {
      addToQueue(guildId, {
        channelId: message.channel.id,
        messageId: message.id,
        deleteAt: Date.now() + rule.deleteAfterMinutes * 60_000
      });
    }
  } catch (e) {
    console.error('[autodelete] handler error:', e.message);
  }
}

async function deleteMessageWithLog(message, guildId, logType, logMessage) {
  try {
    await message.delete();
    logInfo(guildId, logType, logMessage, {
      channelId: message.channel.id,
      messageId: message.id,
      authorId: message.author.id,
      preview: (message.content || '').slice(0, 100)
    });
  } catch (e) {
    logError(guildId, logType, e.message, {
      channelId: message.channel.id,
      messageId: message.id
    }, e.stack);
  }
}

/* ============================================================
   Очередь (in-memory + flush на диск)
   ============================================================ */

function addToQueue(guildId, item) {
  if (!queues.has(guildId)) {
    const data = readSection(guildId, 'autodelete-queue');
    queues.set(guildId, data?.items || []);
  }
  queues.get(guildId).push(item);
  dirty.add(guildId);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueues();
  }, 2000);
}

function flushQueues() {
  for (const guildId of dirty) {
    const items = queues.get(guildId) || [];
    try { writeSection(guildId, 'autodelete-queue', { items }); }
    catch (e) { console.error('flushQueues error:', e.message); }
  }
  dirty.clear();
}

/**
 * Принудительный сброс очереди на диск.
 * Вызывается из scheduler и при shutdown.
 */
export function shutdownAutodelete() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushQueues();
}

/* ============================================================
   Экспорт очереди для внешнего обработчика
   ============================================================ */

/**
 * Отдаёт (и при необходимости загружает) очередь гильдии.
 * Используется в scheduler/autodelete-queue.js.
 * @param {string} guildId
 * @returns {Array<{ channelId, messageId, deleteAt }>}
 */
export function getQueue(guildId) {
  if (!queues.has(guildId)) {
    const data = readSection(guildId, 'autodelete-queue');
    queues.set(guildId, data?.items || []);
  }
  return queues.get(guildId);
}

/**
 * Обновляет очередь гильдии после обработки.
 * @param {string} guildId
 * @param {Array<object>} items
 */
export function setQueue(guildId, items) {
  queues.set(guildId, items);
  dirty.add(guildId);
}

/**
 * Возвращает Set каналов команд (используется обработчиком очереди,
 * чтобы не удалять сообщения в каналах команд повторно).
 * @param {string} guildId
 * @returns {Set<string>}
 */
export function getCommandChannelsFor(guildId) {
  return getCommandChannels(guildId);
}

/**
 * Проверяет, является ли контент legacy-командой.
 * Используется обработчиком очереди — такие сообщения удалит redirect.
 * @param {string} content
 * @returns {boolean}
 */
export function isLegacyCommandContent(content) {
  return isLegacyCommand(content);
}