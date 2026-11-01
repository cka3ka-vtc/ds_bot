// shared/moderation-config.js
// Дефолты и нормализация конфига модуля «Автомодерация».
// Токен {violation} — номер нарушения по конкретному фильтру (не XP).

export const FILTER_KEYS = [
  'spam', 'profanity', 'caps', 'duplicates', 'links',
  'invites', 'mentions', 'raid', 'zalgo', 'emoji',
];

export const FILTER_META = {
  spam:       { icon: 'fa-gauge-high',        color: 'orange', name: 'Антиспам',            desc: 'N сообщений за M секунд' },
  profanity:  { icon: 'fa-comment-slash',     color: 'purple', name: 'Фильтр мата',         desc: 'Словари с обфускацией и исключениями' },
  caps:       { icon: 'fa-font',              color: 'pink',   name: 'Фильтр капса',        desc: 'Доля заглавных букв' },
  duplicates: { icon: 'fa-copy',              color: 'blue',   name: 'Дубликаты',           desc: 'N одинаковых подряд' },
  links:      { icon: 'fa-link-slash',        color: 'blue',   name: 'Блокировка ссылок',   desc: 'Внешние URL' },
  invites:    { icon: 'fa-discord',           color: 'blue',   name: 'Блокировка инвайтов', desc: 'Приглашения на другие серверы' },
  mentions:   { icon: 'fa-at',                color: 'orange', name: 'Массовые упоминания', desc: '@everyone, @here и пачки пингов' },
  raid:       { icon: 'fa-user-shield',       color: 'red',    name: 'Антирейд',            desc: 'Массовые входы и подозрительные аккаунты' },
  zalgo:      { icon: 'fa-eye-slash',         color: 'purple', name: 'Анти-залго',          desc: '«Порченный» текст' },
  emoji:      { icon: 'fa-face-laugh-squint', color: 'pink',   name: 'Эмодзи-спам',         desc: 'Слишком много эмодзи' },
};

export const ACTION_OPTIONS = [
  { value: 'delete', label: 'Удаление' },
  { value: 'warn',   label: 'Удаление и предупреждение' },
  { value: 'mute',   label: 'Мут' },
  { value: 'ban',    label: 'Бан' },
];

export const ESCALATION_ACTIONS = ACTION_OPTIONS;
export const ESCALATION_MAX_LEVELS = 10;

export const RAID_AGE_ACTIONS = [
  { value: 'alert', label: 'Только алерт' },
  { value: 'kick',  label: 'Кик' },
  { value: 'ban',   label: 'Бан' },
];
export const RAID_WAVE_ACTIONS = [
  { value: 'alert',    label: 'Только алерт' },
  { value: 'slowmode', label: 'Slowmode' },
  { value: 'lockdown', label: 'Lockdown (запрет писать)' },
  { value: 'kick_all', label: 'Кикнуть всех вошедших' },
  { value: 'ban_all',  label: 'Забанить всех вошедших' },
];
export const RAID_MODE_ACTIONS = [
  { value: 'kick', label: 'Кик' },
  { value: 'ban',  label: 'Бан' },
];

const ACTION_VALUES = new Set(ACTION_OPTIONS.map((a) => a.value));
const ESC_VALUES = new Set(ESCALATION_ACTIONS.map((a) => a.value));
const RAID_AGE_VALUES = new Set(RAID_AGE_ACTIONS.map((a) => a.value));
const RAID_WAVE_VALUES = new Set(RAID_WAVE_ACTIONS.map((a) => a.value));
const RAID_MODE_VALUES = new Set(RAID_MODE_ACTIONS.map((a) => a.value));

export function actionNeedsDuration(action) {
  return action === 'mute' || action === 'ban';
}
export function escalationRowNeedsDuration(action) {
  return action === 'mute' || action === 'ban';
}

/* ═════════════════ Дефолтные тексты ═════════════════ */

const FILTER_ACCENT = {
  spam: '#f59e0b', profanity: '#8b5cf6', caps: '#ec4899',
  duplicates: '#3b82f6', links: '#3b82f6', invites: '#3b82f6',
  mentions: '#f59e0b', raid: '#dc2626', zalgo: '#8b5cf6', emoji: '#ec4899',
};

const DM_TEXTS = {
  spam: 'Твоё сообщение на сервере **{guild}** удалено за **спам**.\nДействие: **{action}**.',
  profanity: 'Твоё сообщение на сервере **{guild}** удалено за **нецензурную лексику**.\nДействие: **{action}**.',
  caps: 'Твоё сообщение на сервере **{guild}** удалено за **избыток капса**.\nДействие: **{action}**.',
  duplicates: 'Твоё сообщение на сервере **{guild}** удалено за **дубликат**.\nДействие: **{action}**.',
  links: 'Твоё сообщение на сервере **{guild}** удалено за **запрещённую ссылку**.\nДействие: **{action}**.',
  invites: 'Твоё сообщение на сервере **{guild}** удалено за **запрещённый инвайт**.\nДействие: **{action}**.',
  mentions: 'Твоё сообщение на сервере **{guild}** удалено за **массовые упоминания**.\nДействие: **{action}**.',
  raid: 'Твой доступ ограничен из-за **антирейда** на сервере **{guild}**.',
  zalgo: 'Твоё сообщение на сервере **{guild}** удалено за **испорченный текст**.\nДействие: **{action}**.',
  emoji: 'Твоё сообщение на сервере **{guild}** удалено за **избыток эмодзи**.\nДействие: **{action}**.',
};

export function filterDmDefault(key) {
  return {
    displayMode: 'embed-color',
    accentColor: FILTER_ACCENT[key] || '#5865F2',
    title: 'Сообщение удалено',
    subtitle: '',
    thumbnail: '',
    blocks: [{
      id: `dm_${key}_default`,
      type: 'text',
      content: DM_TEXTS[key] || 'Твоё сообщение было удалено.',
    }],
  };
}

export function filterLogDefault(key) {
  const meta = FILTER_META[key];
  return {
    displayMode: 'embed-color',
    accentColor: FILTER_ACCENT[key] || '#5865F2',
    title: meta?.name || key,
    subtitle: '',
    thumbnail: '',
    blocks: [{
      id: `log_${key}_default`,
      type: 'sections',
      listStyle: 'dot',
      items: [
        'Пользователь: {user}',
        'Канал: {channel}',
        'Причина: {reason}',
        'Действие: **{action}**',
        'Нарушение №**{violation}** по этому фильтру',
      ],
    }],
  };
}

export function defaultMessageConfig() {
  return {
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '', subtitle: '', thumbnail: '',
    blocks: [],
  };
}

export function defaultEscalationRow(level) {
  if (level === 1) return { action: 'warn', durationMin: 0,            roleId: '' };
  if (level === 2) return { action: 'mute', durationMin: 10,           roleId: '' };
  return             { action: 'ban',  durationMin: 7 * 24 * 60, roleId: '' };
}

export function defaultFilterEscalation() {
  return {
    enabled: true,
    resetEnabled: true,
    resetDays: 7,
    rows: [defaultEscalationRow(1), defaultEscalationRow(2), defaultEscalationRow(3)],
  };
}

export function defaultFilterConfig(key) {
  return {
    enabled: ['spam', 'profanity', 'caps', 'duplicates'].includes(key),
    action: 'warn',
    durationMin: 10,
    roleId: '',
    channelsMode: 'all',
    channels: [],
    excludeRoles: [],
    logChannelId: '',
    notifyDm: key !== 'raid',
    templateDm: filterDmDefault(key),
    templateLog: filterLogDefault(key),
    escalation: defaultFilterEscalation(),
    params: defaultFilterParams(key),
  };
}

export function defaultFilterParams(key) {
  switch (key) {
    case 'spam': return { count: 5, windowSec: 3 };

    case 'profanity':
      return {
        // Правила из Filter.txt: [{ pattern: string, whitelist: string[] }]
        regexRules: [],
        // Свои слова мата (триггеры)
        customWords: [],
        // Свои исключения (глобальный whitelist)
        customExceptions: [],
      };

    case 'caps': return { percent: 70, minLen: 10 };
    case 'duplicates': return { count: 3, windowSec: 30 };
    case 'links': return { allowedDomains: 'youtube.com, github.com, discord.gg' };
    case 'invites': return { allowedGuilds: '' };
    case 'mentions': return { maxMentions: 5, blockEveryone: true };

    case 'raid':
      return {
        joins: 10, windowSec: 10,
        checkAccountAge: true, minAccountAgeDays: 7,
        ageAction: 'kick', ageBanDurationMin: 0,
        waveAction: 'lockdown', waveBanDurationMin: 60,
        slowmodeSec: 30, lockdownDurationMin: 10,
        enableRaidMode: true, raidModeAction: 'kick',
        raidModeDurationMin: 60, raidModeBanDurationMin: 0,
        cooldownMin: 5,
      };

    case 'zalgo': return { maxMarks: 3, minLen: 5 };
    case 'emoji': return { maxEmoji: 10, includeCustom: true };
    default: return {};
  }
}

export function defaultModerationConfig() {
  const filters = {};
  for (const key of FILTER_KEYS) filters[key] = defaultFilterConfig(key);
  return { enabled: false, filters };
}

export function mergeMessageConfig(raw) {
  const d = defaultMessageConfig();
  if (!raw || typeof raw !== 'object') return d;
  return {
    displayMode: ['flat', 'embed', 'embed-color'].includes(raw.displayMode) ? raw.displayMode : d.displayMode,
    accentColor: typeof raw.accentColor === 'string' ? raw.accentColor : d.accentColor,
    title:    typeof raw.title === 'string' ? raw.title : '',
    subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : '',
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : '',
    blocks:   Array.isArray(raw.blocks) ? raw.blocks : [],
  };
}

function mergeEscRow(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  let action = r.action === 'warn_delete' ? 'warn' : r.action;
  if (!ESC_VALUES.has(action)) action = 'warn';
  return {
    action,
    durationMin: Math.max(0, parseInt(r.durationMin, 10) || 0),
    roleId: String(r.roleId || ''),
  };
}

export function mergeFilterEscalation(raw) {
  const d = defaultFilterEscalation();
  if (!raw || typeof raw !== 'object') return d;
  const rows = Array.isArray(raw.rows)
    ? raw.rows.slice(0, ESCALATION_MAX_LEVELS).map(mergeEscRow)
    : d.rows;
  return {
    enabled: raw.enabled !== false,
    resetEnabled: raw.resetEnabled !== false,
    resetDays: Math.max(1, Math.min(90, parseInt(raw.resetDays, 10) || 7)),
    rows: rows.length ? rows : d.rows,
  };
}

/**
 * Нормализация параметров profanity.
 * Поддерживает миграцию:
 *   - старый формат: { regexPatterns, whitelist }
 *   - простой формат: { custom (строка), exceptions (строка) }
 */
function mergeProfanityParams(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};

  /* ── regexRules ── */
  const regexRules = [];
  if (Array.isArray(r.regexRules)) {
    for (const rule of r.regexRules) {
      if (!rule || typeof rule !== 'object') continue;
      const pattern = String(rule.pattern || '').trim();
      if (!pattern) continue;
      try { new RegExp(pattern, 'iu'); } catch { continue; }
      const whitelist = Array.isArray(rule.whitelist)
        ? rule.whitelist.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 100)
        : [];
      regexRules.push({ pattern, whitelist });
      if (regexRules.length >= 1000) break;
    }
  }
  // миграция со старого { regexPatterns, whitelist }
  if (!regexRules.length && Array.isArray(r.regexPatterns)) {
    const sharedWl = Array.isArray(r.whitelist)
      ? r.whitelist.map((w) => String(w || '').trim()).filter(Boolean)
      : [];
    for (const pat of r.regexPatterns) {
      const pattern = String(pat || '').trim();
      if (!pattern) continue;
      try { new RegExp(pattern, 'iu'); } catch { continue; }
      regexRules.push({ pattern, whitelist: sharedWl });
      if (regexRules.length >= 1000) break;
    }
  }

  /* ── customWords ── */
  let customWords = [];
  if (Array.isArray(r.customWords)) {
    customWords = r.customWords.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 500);
  } else if (typeof r.custom === 'string' && r.custom.trim()) {
    customWords = r.custom.split(/[,\n]+/).map((w) => w.trim()).filter(Boolean).slice(0, 500);
  }

  /* ── customExceptions ── */
  let customExceptions = [];
  if (Array.isArray(r.customExceptions)) {
    customExceptions = r.customExceptions.map((w) => String(w || '').trim()).filter(Boolean).slice(0, 500);
  } else if (typeof r.exceptions === 'string' && r.exceptions.trim()) {
    customExceptions = r.exceptions.split(/[,\n]+/).map((w) => w.trim()).filter(Boolean).slice(0, 500);
  }

  return { regexRules, customWords, customExceptions };
}

function mergeRaidParams(raw) {
  const d = defaultFilterParams('raid');
  const r = raw && typeof raw === 'object' ? raw : {};

  const int = (v, def, min, max) => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return def;
    return Math.max(min, Math.min(max, n));
  };

  const ageAction = RAID_AGE_VALUES.has(r.ageAction) ? r.ageAction : d.ageAction;
  const waveAction = RAID_WAVE_VALUES.has(r.waveAction) ? r.waveAction : d.waveAction;
  const raidModeAction = RAID_MODE_VALUES.has(r.raidModeAction) ? r.raidModeAction : d.raidModeAction;

  return {
    joins:             int(r.joins, d.joins, 3, 100),
    windowSec:         int(r.windowSec, d.windowSec, 3, 300),
    checkAccountAge:   typeof r.checkAccountAge === 'boolean' ? r.checkAccountAge : d.checkAccountAge,
    minAccountAgeDays: int(r.minAccountAgeDays, d.minAccountAgeDays, 0, 365),
    ageAction,
    ageBanDurationMin: ageAction === 'ban' ? int(r.ageBanDurationMin, d.ageBanDurationMin, 0, 10080) : 0,
    waveAction,
    waveBanDurationMin: waveAction === 'ban_all' ? int(r.waveBanDurationMin, d.waveBanDurationMin, 1, 10080) : d.waveBanDurationMin,
    slowmodeSec:         int(r.slowmodeSec, d.slowmodeSec, 5, 21600),
    lockdownDurationMin: int(r.lockdownDurationMin, d.lockdownDurationMin, 1, 1440),
    enableRaidMode:      typeof r.enableRaidMode === 'boolean' ? r.enableRaidMode : d.enableRaidMode,
    raidModeAction,
    raidModeDurationMin: int(r.raidModeDurationMin, d.raidModeDurationMin, 1, 1440),
    raidModeBanDurationMin: raidModeAction === 'ban' ? int(r.raidModeBanDurationMin, d.raidModeBanDurationMin, 0, 10080) : 0,
    cooldownMin: int(r.cooldownMin, d.cooldownMin, 0, 720),
  };
}

function mergeFilter(raw, key) {
  const d = defaultFilterConfig(key);
  const r = raw && typeof raw === 'object' ? raw : {};
  let action = r.action;
  if (action === 'role' || action === 'kick' || action === 'warn_delete') action = 'warn';
  if (!ACTION_VALUES.has(action)) action = d.action;

  let params;
  if (key === 'raid') params = mergeRaidParams(r.params);
  else if (key === 'profanity') params = mergeProfanityParams(r.params);
  else params = { ...defaultFilterParams(key), ...(r.params || {}) };

  return {
    enabled:       typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    action,
    durationMin:   Math.max(1, parseInt(r.durationMin, 10) || d.durationMin),
    roleId:        String(r.roleId || ''),
    channelsMode:  ['all', 'whitelist', 'blacklist'].includes(r.channelsMode) ? r.channelsMode : d.channelsMode,
    channels:      Array.isArray(r.channels) ? r.channels.map(String) : [],
    excludeRoles:  Array.isArray(r.excludeRoles) ? r.excludeRoles.map(String) : [],
    logChannelId:  String(r.logChannelId || ''),
    notifyDm:      typeof r.notifyDm === 'boolean' ? r.notifyDm : d.notifyDm,
    templateDm:    mergeMessageConfig(r.templateDm || d.templateDm),
    templateLog:   mergeMessageConfig(r.templateLog || d.templateLog),
    escalation:    mergeFilterEscalation(r.escalation),
    params,
  };
}

export function mergeModerationConfig(raw) {
  const c = defaultModerationConfig();
  if (!raw || typeof raw !== 'object') return c;
  c.enabled = !!raw.enabled;
  if (raw.filters && typeof raw.filters === 'object') {
    for (const key of FILTER_KEYS) c.filters[key] = mergeFilter(raw.filters[key], key);
  }
  return c;
}