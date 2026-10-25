/* ============================================================
   Сервис профилей.

   Профиль = часть записи в birthdays.json (поле `profile`).
   Хранит: vtc, steam, haulmp, truckersmp, companySince.

   Здесь:
   - валидация URL и дат
   - запись поля профиля
   - сборка Components v2 для /profile
   ============================================================ */

import { readSection, writeSection } from '../storage/index.js';
import { notifySectionUpdate } from './sse-hub.js';
import { buildComponentsFromConfig } from '../discord/components-builder.js';
import { logInfo } from './guild-logger.js';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const FIELD_LABELS = {
  vtc: 'VTC',
  steam: 'Steam',
  haulmp: 'HaulMP',
  truckersmp: 'TruckersMP',
  companySince: 'дата вступления в компанию'
};

/* ---------- Валидация ---------- */

/**
 * Проверяет, что строка — валидный HTTP(S)-URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Парсит дату вступления в компанию.
 * Форматы: ГГГГ-ММ-ДД, ДД.ММ.ГГГГ, ДД.ММ.ГГ
 * @param {string} input
 * @returns {string|null} ISO-строка или null
 */
export function parseCompanyDate(input) {
  let m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return toIso(+m[1], +m[2], +m[3]);

  m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return toIso(+m[3], +m[2], +m[1]);

  m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) {
    const yy = +m[3];
    return toIso(yy <= 68 ? 2000 + yy : 1900 + yy, +m[2], +m[1]);
  }

  return null;
}

function toIso(y, mo, d) {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (dt.getTime() > Date.now()) return null;
  return dt.toISOString();
}

/* ---------- Запись ---------- */

/**
 * Записывает поле профиля пользователя.
 * Если пользователя ещё нет — создаёт запись с пустым ДР.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {'vtc'|'steam'|'haulmp'|'truckersmp'|'companySince'} field
 * @param {string|null} value
 * @returns {Promise<{ field: string, value: string|null }>}
 */
export async function setField(guildId, userId, field, value) {
  const data = readSection(guildId, 'birthdays') || { users: [] };
  if (!Array.isArray(data.users)) data.users = [];

  const idx = data.users.findIndex(u => u.userId === userId);

  if (idx < 0) {
    data.users.push({
      userId,
      day: null,
      month: null,
      year: null,
      enabled: true,
      profile: { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null, [field]: value }
    });
  } else {
    if (!data.users[idx].profile) {
      data.users[idx].profile = { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };
    }
    data.users[idx].profile[field] = value;
  }

  writeSection(guildId, 'birthdays', data);
  notifySectionUpdate(guildId, 'birthdays');

  logInfo(guildId, 'profile_set', `Обновлено поле ${FIELD_LABELS[field] || field}`,
    { userId, field });

  return { field, value };
}

/**
 * Возвращает запись пользователя (с ДР и profile).
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getEntry(guildId, userId) {
  const data = readSection(guildId, 'birthdays');
  return (data?.users || []).find(u => u.userId === userId) || null;
}

/* ---------- Сборка профиля ---------- */

/**
 * Собирает Components v2 для профиля.
 *
 * Возвращает null если:
 *  - у пользователя нет записи;
 *  - шаблон не содержит блоков (пользователь удалил всё в редакторе).
 *
 * @param {string} guildId
 * @param {import('discord.js').User} targetUser
 * @param {import('discord.js').GuildMember|null} member
 * @returns {Promise<Array<object>|null>}
 */
export async function buildProfilePayload(guildId, targetUser, member) {
  const birthdaysData = readSection(guildId, 'birthdays') || { users: [] };
  const entry = birthdaysData.users.find(u => u.userId === targetUser.id);
  if (!entry) return null;

  const profile = entry.profile || { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };

  const profilesSettings = readSection(guildId, 'profiles')?.settings || {};
  const cfg = profilesSettings.template?.blocks?.length
    ? profilesSettings.template
    : defaultProfileConfig();

  const displayName = member?.displayName || targetUser.displayName || targetUser.username || '';
  const username = targetUser.username || '';

  const birthday = entry.day && entry.month
    ? `${entry.day} ${MONTHS[entry.month - 1]}${entry.year ? ` ${entry.year} г.` : ''}`
    : 'не указана';

  const age = (() => {
    if (!entry.year) return '—';
    const now = new Date();
    const had = (now.getMonth() + 1 > entry.month) ||
      (now.getMonth() + 1 === entry.month && now.getDate() >= entry.day);
    const a = now.getFullYear() - entry.year - (had ? 0 : 1);
    return a >= 0 ? `${a} лет` : '—';
  })();

  const links = [
    profile.vtc ? `[VTC](${profile.vtc})` : null,
    profile.steam ? `[Steam](${profile.steam})` : null,
    profile.haulmp ? `[HaulMP](${profile.haulmp})` : null,
    profile.truckersmp ? `[TruckersMP](${profile.truckersmp})` : null
  ].filter(Boolean).join(' · ') || 'не указаны';

  const components = buildComponentsFromConfig(cfg, {
    userId: targetUser.id,
    section: 'profiles',
    displayName,
    username,
    birthday,
    age,
    links,
    profile: {
      vtc: profile.vtc || '',
      steam: profile.steam || '',
      haulmp: profile.haulmp || '',
      truckersmp: profile.truckersmp || '',
      companySince: profile.companySince || null,
      companySinceFormatted: profile.companySince ? formatDateRu(profile.companySince) : 'не указано',
      companyDuration: profile.companySince ? formatDurationRu(profile.companySince) : '—'
    }
  });

  if (!components?.length) return null;
  return components;
}

/* ---------- Дефолт и форматирование ---------- */

function defaultProfileConfig() {
  return {
    displayMode: 'flat',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: [
      { id: 'prof-1', type: 'text', content: '**{mention}**' },
      { id: 'prof-2', type: 'text', content: '🎂 ДР: {birthday}' },
      { id: 'prof-3', type: 'text', content: '🔗 Ссылки: {links}' },
      { id: 'prof-4', type: 'text', content: '📅 В компании с: {companySince}\n⏳ Стаж: {companyDuration}' }
    ]
  };
}

function formatDateRu(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('ru-RU'); }
  catch { return ''; }
}

function formatDurationRu(iso) {
  const from = new Date(iso);
  if (isNaN(from.getTime())) return '';
  const now = new Date();
  if (from > now) return '';

  let y = now.getFullYear() - from.getFullYear();
  let m = now.getMonth() - from.getMonth();
  let d = now.getDate() - from.getDate();

  if (d < 0) {
    d += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    m--;
  }
  if (m < 0) { m += 12; y--; }

  const parts = [];
  if (y > 0) parts.push(`${y} г.`);
  if (m > 0) parts.push(`${m} мес.`);
  if (d > 0) parts.push(`${d} дн.`);

  return parts.length ? parts.join(' ') : 'меньше дня';
}

export { FIELD_LABELS };