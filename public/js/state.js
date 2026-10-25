/* ============================================================
   Глобальное состояние приложения.

   Один объект, разделяемый между модулями. При входе в гильдию
   заполняется через setGuildData(), при выходе — сбрасывается
   через resetState().
   ============================================================ */

export const state = {
  /* Текущая гильдия */
  guildId: null,
  guild: null,

  /* Информация о боте */
  bot: null,

  /* Данные разделов */
  rules: null,
  channels: [],
  roles: [],
  members: [],
  messages: [],
  announcements: [],
  delayed: [],
  autodelete: [],
  birthdays: null,
  profiles: null,
  logs: [],

  /* Текущий раздел для навигации */
  currentSection: 'dashboard',

  /* Свёрнутые карточки в редакторе (context → Set<id>) */
  collapsed: new Map()
};

/**
 * Заполняет состояние данными гильдии.
 * @param {object} data
 */
export function setGuildData(data) {
  Object.assign(state, data);
}

/**
 * Полный сброс при выходе на главную.
 */
export function resetState() {
  state.guildId = null;
  state.guild = null;
  state.rules = null;
  state.channels = [];
  state.roles = [];
  state.members = [];
  state.messages = [];
  state.announcements = [];
  state.delayed = [];
  state.autodelete = [];
  state.birthdays = null;
  state.profiles = null;
  state.logs = [];
  state.collapsed.clear();
}

/* ---------- Свёрнутые блоки в редакторах ---------- */

function getCollapsedKey(context) {
  return `${state.guildId}_${context}`;
}

export function loadCollapsed(context) {
  const key = getCollapsedKey(context);
  if (state.collapsed.has(key)) return state.collapsed.get(key);

  try {
    const raw = localStorage.getItem(`nexus_collapsed_${key}`);
    const set = raw ? new Set(JSON.parse(raw)) : new Set();
    state.collapsed.set(key, set);
    return set;
  } catch {
    const set = new Set();
    state.collapsed.set(key, set);
    return set;
  }
}

export function saveCollapsed(context) {
  const key = getCollapsedKey(context);
  const set = state.collapsed.get(key) || new Set();
  try {
    localStorage.setItem(`nexus_collapsed_${key}`, JSON.stringify([...set]));
  } catch {}
}

export function clearCollapsed() {
  state.collapsed.clear();
}