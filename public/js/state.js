export const state = {
  guildId: null,
  guild: null,
  bot: null,
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
  currentSection: 'rules',
  collapsed: new Map()
};

export function setGuildData(data) {
  Object.assign(state, data);
}

export function getCollapsedKey(context) {
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
  try { localStorage.setItem(`nexus_collapsed_${key}`, JSON.stringify([...set])); } catch {}
}

export function clearCollapsed() {
  state.collapsed.clear();
}