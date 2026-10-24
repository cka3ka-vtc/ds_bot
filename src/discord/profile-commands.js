import { readSection, writeSection } from '../storage/index.js';
import { logInfo, logError } from './logger.js';
import { notifySectionUpdate } from '../services/events.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from './builder.js';

const SET_TIMEOUT = 60 * 1000;
const PROFILE_TIMEOUT = 3 * 60 * 1000;
const REPLY_TIMEOUT_STD = 60 * 1000;

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const FIELD_LABELS = {
  vtc: 'VTC',
  steam: 'Steam',
  haulmp: 'HaulMP',
  truckersmp: 'TruckersMP',
  companySince: 'дата вступления в компанию'
};

const DEFAULT_PROFILE_SETTINGS = {
  channelId: '',
  requiredRoleIds: [],
  template: null
};

/* Дефолтный MessageConfig — если пользователь не задал шаблон */
const DEFAULT_PROFILE_CONFIG = {
  displayMode: 'flat',
  accentColor: '#5865F2',
  title: '',
  subtitle: '',
  thumbnail: '',
  blocks: [
    { id: 'prof-def-1', type: 'text', content: '**{mention}**' },
    { id: 'prof-def-2', type: 'text', content: '📅 Дата рождения: {birthday}' },
    { id: 'prof-def-3', type: 'text', content: '🔗 Ссылки: {links}' },
    { id: 'prof-def-4', type: 'text', content: '👔 В компании с: {companySince}\n⏳ Стаж: {companyDuration}' }
  ]
};

export function initProfileCommands(client) {
  client.prependListener('messageCreate', handleProfileCommand);
  console.log('[profile-commands] ✓ messageCreate handler REGISTERED');
}

async function handleProfileCommand(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;
    if (message.system) return;
    if (!message.content || !message.content.length) return;

    const raw = message.content.trimStart();
    const lower = raw.toLowerCase();

    const isProfileCmd = lower === '!profile' || lower.startsWith('!profile ');
    const setter = detectSetter(lower);
    if (!isProfileCmd && !setter) return;

    const guildId = message.guild.id;

    const profilesData = readSection(guildId, 'profiles');
    const settings = { ...DEFAULT_PROFILE_SETTINGS, ...(profilesData?.settings || {}) };

    if (!settings.channelId) return;
    if (message.channel.id !== settings.channelId) return;

    console.log(`[profile-commands] ▶ command: "${message.content}" | #${message.channel.name} | user=${message.author.id}`);

    const requiredRoles = settings.requiredRoleIds || [];
    if (requiredRoles.length > 0) {
      let member = message.member;
      if (!member) member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (!member) {
        await sendReply(message, '❌ Не удалось проверить ваши роли.', REPLY_TIMEOUT_STD);
        scheduleMessageDelete(message, isProfileCmd ? PROFILE_TIMEOUT : SET_TIMEOUT);
        return;
      }
      const hasAny = requiredRoles.some(rid => member.roles.cache.has(rid));
      if (!hasAny) {
        await sendReply(message, '❌ У вас нет необходимой роли для использования этой команды.', REPLY_TIMEOUT_STD);
        scheduleMessageDelete(message, isProfileCmd ? PROFILE_TIMEOUT : SET_TIMEOUT);
        return;
      }
    }

    const birthdaysData = readSection(guildId, 'birthdays') || { settings: {}, users: [] };

    if (isProfileCmd) {
      await handleProfile(message, birthdaysData, settings, guildId);
    } else {
      await handleSetter(message, birthdaysData, settings, guildId, setter);
    }
  } catch (e) {
    console.error('[profile-commands] ✗ unhandled error:', e);
  }
}

function detectSetter(lower) {
  const map = [
    { name: '!vtc',     field: 'vtc' },
    { name: '!steam',   field: 'steam' },
    { name: '!hmp',     field: 'haulmp' },
    { name: '!tmp',     field: 'truckersmp' },
    { name: '!company', field: 'companySince' }
  ];
  for (const m of map) {
    if (lower === m.name || lower.startsWith(m.name + ' ')) return m;
  }
  return null;
}

/* ============================================================
   Setter
   ============================================================ */
async function handleSetter(message, birthdaysData, settings, guildId, cmd) {
  const arg = message.content.trim().slice(cmd.name.length).trim();
  const isDate = cmd.field === 'companySince';

  if (!arg) {
    const usage = isDate
      ? `📝 Использование: \`${cmd.name} ДД.ММ.ГГГГ\` (или \`${cmd.name} ГГГГ-ММ-ДД\`)`
      : `📝 Использование: \`${cmd.name} <ссылка>\``;
    await sendReply(message, usage, REPLY_TIMEOUT_STD);
    scheduleMessageDelete(message, SET_TIMEOUT);
    return;
  }

  let value;
  if (isDate) {
    value = parseCompanyDate(arg);
    if (!value) {
      await sendReply(message,
        '❌ Некорректная дата. Используйте `ДД.ММ.ГГГГ` или `ГГГГ-ММ-ДД`.\n' +
        'Дата не может быть в будущем.', REPLY_TIMEOUT_STD);
      scheduleMessageDelete(message, SET_TIMEOUT);
      return;
    }
  } else {
    if (!isValidUrl(arg)) {
      await sendReply(message,
        `❌ Некорректная ссылка для ${FIELD_LABELS[cmd.field]}.\n` +
        'Ссылка должна начинаться с `http://` или `https://`.', REPLY_TIMEOUT_STD);
      scheduleMessageDelete(message, SET_TIMEOUT);
      return;
    }
    value = arg;
  }

  const users = Array.isArray(birthdaysData.users) ? birthdaysData.users : [];
  const idx = users.findIndex(u => u.userId === message.author.id);

  if (idx < 0) {
    users.push({
      userId: message.author.id,
      day: null, month: null, year: null, enabled: true,
      profile: { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null, [cmd.field]: value }
    });
  } else {
    if (!users[idx].profile || typeof users[idx].profile !== 'object') {
      users[idx].profile = { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };
    }
    users[idx].profile[cmd.field] = value;
  }
  birthdaysData.users = users;

  try {
    writeSection(guildId, 'birthdays', birthdaysData);
    notifySectionUpdate(guildId, 'birthdays');
  } catch (e) {
    logError(guildId, 'profile_command_save', e.message,
      { userId: message.author.id, field: cmd.field }, e.stack);
    await sendReply(message, '❌ Не удалось сохранить. Обратитесь к администрации.', REPLY_TIMEOUT_STD);
    scheduleMessageDelete(message, SET_TIMEOUT);
    return;
  }

  logInfo(guildId, 'profile_command_update',
    `Пользователь обновил ${FIELD_LABELS[cmd.field]}`,
    { userId: message.author.id, field: cmd.field }
  );

  const saved = isDate
    ? `✅ Дата вступления в компанию сохранена: **${formatDateRu(value)}**`
    : `✅ ${FIELD_LABELS[cmd.field]} сохранено.`;
  await sendReply(message, saved, REPLY_TIMEOUT_STD);
  scheduleMessageDelete(message, SET_TIMEOUT);
}

/* ============================================================
   !profile [@user] — сборка через buildComponentsFromConfig
   ============================================================ */
async function handleProfile(message, birthdaysData, settings, guildId) {
  const arg = message.content.trim().slice('!profile'.length).trim();

  let targetUser = message.author;
  if (arg) {
    const mentioned = message.mentions.users.first();
    if (!mentioned) {
      await sendReply(message,
        '❌ Укажите пользователя через @упоминание.\n' +
        'Пример: `!profile @username`', PROFILE_TIMEOUT);
      scheduleMessageDelete(message, PROFILE_TIMEOUT);
      return;
    }
    targetUser = mentioned;
  }

  const users = Array.isArray(birthdaysData.users) ? birthdaysData.users : [];
  const entry = users.find(u => u.userId === targetUser.id);

  if (!entry) {
    const isSelf = targetUser.id === message.author.id;
    const text = isSelf
      ? '⚠️ У вас нет профиля на сервере.\n' +
        'Установите данные командами: `!vtc <ссылка>`, `!steam <ссылка>`, `!hmp <ссылка>`, `!tmp <ссылка>`, `!company <дата>`.'
      : `⚠️ У пользователя <@${targetUser.id}> нет профиля на сервере.`;
    await sendReply(message, text, PROFILE_TIMEOUT);
    scheduleMessageDelete(message, PROFILE_TIMEOUT);
    return;
  }

  const profile = entry.profile || { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };

  /* Готовим контекст для resolveTokens */
  const member = message.guild?.members?.cache.get(targetUser.id);
  const displayName = member?.displayName || targetUser.displayName || targetUser.username || '';
  const username = targetUser.username || '';

  const birthday = buildBirthdayText(entry);
  const age = buildAgeText(entry);
  const links = buildLinksMarkdown(profile);

  const cfg = settings.template?.blocks?.length ? settings.template : DEFAULT_PROFILE_CONFIG;

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
      companyDuration: profile.companySince ? (formatCompanyDuration(profile.companySince) || '—') : '—'
    }
  });

  /* Отправляем с V2-компонентами и удаляем через PROFILE_TIMEOUT */
  let sent = null;
  try {
    sent = await message.reply({
      components,
      flags: FLAG_COMPONENTS_V2,
      allowedMentions: { parse: [] }
    });
  } catch (e) {
    console.warn(`[profile-commands] reply-with-components failed (${e.message}), fallback channel.send`);
  }
  if (!sent) {
    try {
      sent = await message.channel.send({
        components,
        flags: FLAG_COMPONENTS_V2,
        allowedMentions: { parse: [] }
      });
    } catch (e) {
      console.error('[profile-commands] ✗ channel.send with components FAILED:', e.message);
    }
  }
  if (sent) {
    console.log(`[profile-commands] ✓ profile reply: ${sent.id}`);
    setTimeout(() => sent.delete().catch(() => {}), PROFILE_TIMEOUT);
  } else {
    try { await message.author.send('❌ Не удалось отправить профиль в канал. Обратитесь к администрации.'); } catch {}
  }

  scheduleMessageDelete(message, PROFILE_TIMEOUT);

  logInfo(guildId, 'profile_command_info',
    'Пользователь запросил информацию о профиле',
    {
      requesterId: message.author.id,
      targetId: targetUser.id,
      self: targetUser.id === message.author.id
    }
  );
}

/* ============================================================
   Утилиты контекста
   ============================================================ */
function buildBirthdayText(entry) {
  if (!entry.day || !entry.month) return 'не указана';
  const dateStr = `${entry.day} ${MONTHS[entry.month - 1]}`;
  if (entry.year) return `${dateStr} ${entry.year} г.`;
  return dateStr;
}

function buildAgeText(entry) {
  if (!entry.year) return '—';
  const now = new Date();
  const hadBdayThisYear =
    (now.getMonth() + 1 > entry.month) ||
    (now.getMonth() + 1 === entry.month && now.getDate() >= entry.day);
  const age = now.getFullYear() - entry.year - (hadBdayThisYear ? 0 : 1);
  if (age < 0) return '—';
  return `${age} ${pluralYears(age)}`;
}

function buildLinksMarkdown(profile) {
  const parts = [];
  if (profile.vtc) parts.push(`[VTC](${profile.vtc})`);
  if (profile.steam) parts.push(`[Steam](${profile.steam})`);
  if (profile.haulmp) parts.push(`[HaulMP](${profile.haulmp})`);
  if (profile.truckersmp) parts.push(`[TruckersMP](${profile.truckersmp})`);
  return parts.length ? parts.join(' · ') : 'не указаны';
}

/* ============================================================
   Базовые ответы
   ============================================================ */
async function sendReply(message, text, replyTimeout) {
  let sent = null;
  try {
    sent = await message.reply({ content: text, allowedMentions: { parse: [] } });
  } catch (e) {
    console.warn(`[profile-commands] reply failed (${e.message}), fallback to channel.send`);
  }
  if (!sent) {
    try { sent = await message.channel.send({ content: text, allowedMentions: { parse: [] } }); }
    catch (e) { console.error('[profile-commands] ✗ channel.send FAILED:', e.message); }
  }
  if (sent) {
    setTimeout(() => sent.delete().catch(() => {}), replyTimeout);
    return;
  }
  try { await message.author.send(text); } catch {}
}

function scheduleMessageDelete(message, delayMs) {
  setTimeout(() => {
    message.delete().catch(() => {});
  }, delayMs);
}

/* ============================================================
   Утилиты
   ============================================================ */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch { return false; }
}

function parseCompanyDate(input) {
  let m = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return toIsoDate(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
  m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return toIsoDate(parseInt(m[3], 10), parseInt(m[2], 10), parseInt(m[1], 10));
  m = input.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/);
  if (m) {
    const yy = parseInt(m[3], 10);
    const y = yy <= 68 ? 2000 + yy : 1900 + yy;
    return toIsoDate(y, parseInt(m[2], 10), parseInt(m[1], 10));
  }
  return null;
}

function toIsoDate(y, m, d) {
  if (y < 1900 || y > 2100) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;
  return date.toISOString();
}

function formatDateRu(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return ''; }
}

function formatCompanyDuration(iso) {
  const from = new Date(iso);
  if (isNaN(from.getTime())) return '';
  const now = new Date();
  if (from > now) return '';

  let y = now.getFullYear() - from.getFullYear();
  let m = now.getMonth() - from.getMonth();
  let d = now.getDate() - from.getDate();

  if (d < 0) {
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    d += prevMonth.getDate();
    m--;
  }
  if (m < 0) { m += 12; y--; }
  if (y < 0) return '';

  const parts = [];
  if (y > 0) parts.push(`${y} ${pluralYears(y)}`);
  if (m > 0) parts.push(`${m} ${pluralMonths(m)}`);
  if (d > 0) parts.push(`${d} ${pluralDays(d)}`);

  return parts.length ? parts.join(' ') : 'меньше дня';
}

function pluralYears(n) { const a = Math.abs(n) % 100, l = a % 10; if (a > 10 && a < 20) return 'лет'; if (l > 1 && l < 5) return 'года'; if (l === 1) return 'год'; return 'лет'; }
function pluralMonths(n) { const a = Math.abs(n) % 100, l = a % 10; if (a > 10 && a < 20) return 'месяцев'; if (l > 1 && l < 5) return 'месяца'; if (l === 1) return 'месяц'; return 'месяцев'; }
function pluralDays(n) { const a = Math.abs(n) % 100, l = a % 10; if (a > 10 && a < 20) return 'дней'; if (l > 1 && l < 5) return 'дня'; if (l === 1) return 'день'; return 'дней'; }