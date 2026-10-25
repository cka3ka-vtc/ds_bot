/* ============================================================
   Сервис дней рождения.

   Содержит:
   - парсинг дат (ДД.ММ, ДД.ММ.ГГ, ДД.ММ.ГГГГ)
   - расчёт «сколько дней до ДР»
   - плюрализацию («день/дня/дней», «год/года/лет»)
   - запись/чтение ДР пользователя
   - сборку текста для /hb info
   - очистку старых поздравлений (сообщение + роль)
   ============================================================ */

import { readSection, writeSection } from '../storage/index.js';
import { notifySectionUpdate } from './sse-hub.js';
import { logInfo, logError } from './guild-logger.js';

export const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

/* ---------- Парсинг и валидация ---------- */

/**
 * Парсит строку даты рождения.
 * Форматы: 30.03 | 30.03.95 | 30.03.1995
 * @param {string} input
 * @returns {{ day:number, month:number, year:number|null } | null}
 */
export function parseBirthdayDate(input) {
  const m = String(input).match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/);
  if (!m) return null;

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let year = null;

  if (m[3]) {
    const v = parseInt(m[3], 10);
    year = m[3].length === 2 ? (v <= 68 ? 2000 + v : 1900 + v) : v;
    if (year < 1900 || year > 2100) return null;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(month, year)) return null;

  return { day, month, year };
}

function daysInMonth(month, year) {
  if (month === 2) return year ? (isLeap(year) ? 29 : 28) : 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/* ---------- Даты и склонения ---------- */

/**
 * Сколько дней осталось до ближайшего ДР.
 * 0 = сегодня, 1 = завтра.
 * @param {number} day
 * @param {number} month
 * @param {Date} [now]
 * @returns {number}
 */
export function daysUntilBirthday(day, month, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86_400_000);
}

export function pluralDays(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (l === 1) return 'день';
  if (l > 1 && l < 5) return 'дня';
  return 'дней';
}

export function pluralYears(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a > 10 && a < 20) return 'лет';
  if (l > 1 && l < 5) return 'года';
  if (l === 1) return 'год';
  return 'лет';
}

/* ---------- Данные ---------- */

function loadData(guildId) {
  return readSection(guildId, 'birthdays') || {
    settings: {
      time: '09:00',
      roleId: '',
      channelId: '',
      enabled: false,
      lastRunDate: null,
      roleRemoveNextDay: true,
      autoDeleteMessage: false,
      requiredRoleIds: [],
      _pending: []
    },
    users: [],
    template: null,
    templateNoYear: null
  };
}

/**
 * Записывает/обновляет ДР пользователя.
 * @param {string} guildId
 * @param {string} userId
 * @param {{ day:number, month:number, year?:number|null }} payload
 * @returns {Promise<{ entry: object, wasExisting: boolean }>}
 */
export async function setBirthday(guildId, userId, { day, month, year = null }) {
  const data = loadData(guildId);
  if (!Array.isArray(data.users)) data.users = [];

  const idx = data.users.findIndex(u => u.userId === userId);
  const entry = {
    ...(idx >= 0 ? data.users[idx] : {}),
    userId,
    day,
    month,
    year,
    enabled: idx >= 0 ? data.users[idx].enabled !== false : true
  };

  if (idx >= 0) data.users[idx] = entry;
  else data.users.push(entry);

  writeSection(guildId, 'birthdays', data);
  notifySectionUpdate(guildId, 'birthdays');

  logInfo(guildId, 'birthday_set', 'Пользователь обновил ДР',
    { userId, day, month, year });

  return { entry, wasExisting: idx >= 0 };
}

/**
 * Возвращает запись пользователя или null.
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getBirthday(guildId, userId) {
  const data = loadData(guildId);
  return (data.users || []).find(u => u.userId === userId) || null;
}

/**
 * Включает/выключает поздравления пользователя.
 * @param {string} guildId
 * @param {string} userId
 * @param {boolean} enabled
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function setBirthdayEnabled(guildId, userId, enabled) {
  const data = loadData(guildId);
  if (!Array.isArray(data.users)) return { ok: false, reason: 'no_users' };

  const idx = data.users.findIndex(u => u.userId === userId);
  if (idx < 0) return { ok: false, reason: 'not_found' };

  data.users[idx].enabled = enabled;
  writeSection(guildId, 'birthdays', data);
  notifySectionUpdate(guildId, 'birthdays');

  logInfo(guildId, 'birthday_toggle',
    enabled ? 'Включил поздравления' : 'Отключил поздравления',
    { userId });

  return { ok: true };
}

/**
 * Собирает текст для /hb info.
 * @param {object|null} entry
 * @returns {string|null}
 */
export function buildInfoText(entry) {
  if (!entry) return null;

  const dateStr = `${entry.day} ${MONTHS[entry.month - 1]}${entry.year ? ` ${entry.year} г.` : ''}`;
  const now = new Date();
  const days = daysUntilBirthday(entry.day, entry.month, now);

  let whenLine;
  if (days === 0) whenLine = '🎉 **Сегодня ваш день рождения!**';
  else if (days === 1) whenLine = '⏰ **Завтра ваш день рождения**';
  else whenLine = `⏳ До дня рождения: **${days}** ${pluralDays(days)}`;

  let ageLine = '';
  if (entry.year) {
    const hadBday = (now.getMonth() + 1 > entry.month) ||
      (now.getMonth() + 1 === entry.month && now.getDate() >= entry.day);
    const age = now.getFullYear() - entry.year - (hadBday ? 0 : 1);
    if (age >= 0) ageLine = `\n🎂 Возраст: **${age}** ${pluralYears(age)}`;
  }

  const status = entry.enabled !== false
    ? '🔔 Поздравления включены'
    : '🔕 Поздравления отключены';

  return `📅 **Ваш день рождения:** ${dateStr}\n${whenLine}${ageLine}\n${status}`;
}

/**
 * Убирает «хвосты» предыдущего поздравления пользователя
 * (сообщение и роль), если они есть в _pending.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} data - объект birthdays (мутируется: чистит _pending)
 * @param {string} userId
 * @param {object} [opts]
 * @param {boolean} [opts.skipIfToday=true] - не трогать, если ДР сегодня
 * @returns {Promise<{ removedMessage: boolean, removedRole: boolean }>}
 */
export async function cleanupCongrats(guild, data, userId, { skipIfToday = true } = {}) {
  const result = { removedMessage: false, removedRole: false };
  const now = new Date();

  const entry = (data.users || []).find(u => u.userId === userId);
  if (!entry) return result;

  /* Если ДР сегодня и skipIfToday — не трогаем, поздравление актуально */
  if (skipIfToday && entry.day === now.getDate() && entry.month === now.getMonth() + 1) {
    return result;
  }

  const pending = data.settings._pending || [];
  const mine = pending.filter(p => p.userId === userId);
  if (!mine.length) return result;

  /* Оставляем в _pending только чужие записи */
  data.settings._pending = pending.filter(p => p.userId !== userId);

  for (const p of mine) {
    try {
      if (p.type === 'message-delete') {
        const ch = await guild.channels.fetch(p.channelId).catch(() => null);
        const msg = ch ? await ch.messages.fetch(p.messageId).catch(() => null) : null;
        if (msg) {
          await msg.delete().catch(() => {});
          result.removedMessage = true;
        }
      } else if (p.type === 'role-remove') {
        const member = await guild.members.fetch(p.userId).catch(() => null);
        const role = await guild.roles.fetch(p.roleId).catch(() => null);
        if (member && role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role).catch(() => {});
          result.removedRole = true;
        }
      }
    } catch (e) {
      logError(guild.id, 'birthday_cleanup', e.message,
        { userId, pendingType: p.type }, e.stack);
    }
  }

  return result;
}