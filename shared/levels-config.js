// shared/levels-config.js
import { DEFAULT_TITLES } from './titles.js';

export function defaultLevelsConfig() {
  return {
    enabledEvents: { message: true, command: true, voice: true },
    events: {
      message: { xp: 15, cooldownMin: 1 },
      command: { xp: 10, cooldownMin: 2 },
      voice:   { xp: 5,  cooldownMin: 5 },
    },
    announceChannelId: '',
    formula: 'classic',
    linearBase: 100,
    maxLevel: 100,
    boostMultiplier: 2,
    dailyEnabled: true,
    dailyXp: 150,
    titles: structuredClone(DEFAULT_TITLES),
    rewards: { enabled: true, entries: [] },
    excludedChannels: [],
    excludedRoles: [],
    inactivity: { enabled: false, days: 30, penaltyXp: 50, removeRolesOnDecrease: false },
    messages: {},
  };
}

export function normalizeLevelsEvents(rawEvents) {
  const fallback = { message: 1, command: 2, voice: 5 };
  const out = {};
  for (const key of ['message', 'command', 'voice']) {
    const ev = rawEvents?.[key] || {};
    let min = ev.cooldownMin;
    if (min == null) {
      min = ev.cooldownSec != null ? Math.max(1, Math.round(ev.cooldownSec / 60)) : fallback[key];
    }
    out[key] = { xp: ev.xp ?? 0, cooldownMin: Math.max(1, min) };
  }
  return out;
}

export function mergeLevelsConfig(raw) {
  const c = defaultLevelsConfig();
  if (!raw || typeof raw !== 'object') return c;

  c.enabledEvents = { ...c.enabledEvents, ...(raw.enabledEvents || {}) };
  c.events = normalizeLevelsEvents(raw.events);

  for (const k of [
    'announceChannelId', 'linearBase', 'maxLevel',
    'boostMultiplier', 'excludedChannels', 'excludedRoles',
  ]) {
    if (raw[k] !== undefined) c[k] = raw[k];
  }

  c.formula = raw.formula === 'linear' ? 'linear' : 'classic';

  const isOldDailyDefault =
    (raw.dailyXp === undefined || raw.dailyXp === 50) &&
    (raw.dailyEnabled === undefined || raw.dailyEnabled === false);

  if (isOldDailyDefault) {
    c.dailyEnabled = true;
    c.dailyXp = 150;
  } else {
    c.dailyEnabled = !!raw.dailyEnabled;
    c.dailyXp = Math.max(1, parseInt(raw.dailyXp, 10) || 150);
  }

  if (Array.isArray(raw.titles) && raw.titles.length) {
    const normalized = raw.titles
      .map((t) => ({
        minLevel: Math.max(1, parseInt(t.minLevel, 10) || 1),
        name: String(t.name || '').trim().slice(0, 40),
      }))
      .filter((t) => t.name);
    if (normalized.length) c.titles = normalized;
  }

  if (raw.rewards) {
    c.rewards = {
      enabled: raw.rewards.enabled !== false,
      entries: Array.isArray(raw.rewards.entries) ? raw.rewards.entries : [],
    };
  }
  if (raw.inactivity) c.inactivity = { ...c.inactivity, ...raw.inactivity };

  // Сообщения: каждое — независимый MessageEditor-конфиг.
  //   levelUp      — при достижении нового уровня (announce channel)
  //   rank         — ответ на /rank (карточка конкретного участника)
  //   leaderboard  — ответ на /leaderboard
  //   daily        — ответ на /daily
  if (raw.messages && typeof raw.messages === 'object') {
    for (const k of ['levelUp', 'rank', 'leaderboard', 'daily']) {
      if (raw.messages[k] !== undefined) c.messages[k] = raw.messages[k];
    }
  }
  return c;
}

export const LEVELS_COOLDOWN_DEFAULT = { message: 1, command: 2, voice: 5 };