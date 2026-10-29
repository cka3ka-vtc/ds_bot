// public/assets/js/views/module-settings/levels/helpers.js
import { escapeHtml } from '../../../core/utils.js';
import { emptyMessageConfig } from '../message-editor.js';
import { DEFAULT_TITLES } from '/shared/titles.js';

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
    customFormula: [],
    maxLevel: 100,
    boostMultiplier: 2,
    dailyEnabled: true,
    dailyXp: 150,
    titles: structuredClone(DEFAULT_TITLES),
    rewards: { enabled: true, entries: [] },
    excludedChannels: [],
    excludedRoles: [],
    inactivity: { enabled: false, days: 30, penaltyXp: 50, removeRolesOnDecrease: false },
    messages: { levelUp: emptyMessageConfig() },
  };
}

function normalizeEvents(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const key of ['message', 'command', 'voice']) {
    const ev = raw[key];
    if (!ev) continue;
    let min = ev.cooldownMin;
    if (min == null && ev.cooldownSec != null) {
      min = Math.max(1, Math.round(ev.cooldownSec / 60));
    }
    out[key] = { ...ev, ...(min != null ? { cooldownMin: min } : {}) };
    delete out[key].cooldownSec;
  }
  return out;
}

export function mergeLevelsConfig(raw) {
  const c = defaultLevelsConfig();
  if (!raw || typeof raw !== 'object') return c;

  c.enabledEvents = { ...c.enabledEvents, ...(raw.enabledEvents || {}) };
  const migrated = normalizeEvents(raw.events);
  if (migrated) {
    for (const k of ['message', 'command', 'voice']) {
      if (migrated[k]) c.events[k] = { ...c.events[k], ...migrated[k] };
    }
  }

  for (const k of [
    'announceChannelId', 'linearBase', 'customFormula', 'maxLevel',
    'boostMultiplier', 'excludedChannels', 'excludedRoles',
  ]) {
    if (raw[k] !== undefined) c[k] = raw[k];
  }

  // formula: только classic / linear (custom убран)
  if (raw.formula === 'linear') c.formula = 'linear';
  else c.formula = 'classic';

  // Миграция старых daily-дефолтов
  const isOldDailyDefault =
    (raw.dailyXp === undefined || raw.dailyXp === 50) &&
    (raw.dailyEnabled === undefined || raw.dailyEnabled === false);

  if (isOldDailyDefault) {
    c.dailyEnabled = true;
    c.dailyXp = 150;
  } else {
    if (raw.dailyEnabled !== undefined) c.dailyEnabled = !!raw.dailyEnabled;
    if (raw.dailyXp !== undefined) c.dailyXp = Math.max(1, parseInt(raw.dailyXp, 10) || 150);
  }

  if (Array.isArray(raw.titles) && raw.titles.length) {
    c.titles = raw.titles.map((t) => ({
      minLevel: Math.max(1, parseInt(t.minLevel, 10) || 1),
      name: String(t.name || '').trim().slice(0, 40),
    })).filter((t) => t.name);
  }

  if (raw.rewards) {
    c.rewards = {
      enabled: raw.rewards.enabled !== false,
      entries: Array.isArray(raw.rewards.entries) ? raw.rewards.entries : [],
    };
  }
  if (raw.inactivity) c.inactivity = { ...c.inactivity, ...raw.inactivity };
  if (raw.messages?.levelUp !== undefined) c.messages.levelUp = raw.messages.levelUp;
  return c;
}

export function numStepper({ value = 0, min = 0, max = 999999, step = 1, suffix = '', data = '' }) {
  return `
    <div class="num-stepper" data-num-stepper ${data}>
      <button type="button" class="num-stepper-btn" data-step="-${step}" aria-label="Уменьшить">
        <i class="fa-solid fa-minus"></i>
      </button>
      <input type="number" class="num-stepper-input" value="${value}" min="${min}" max="${max}" step="${step}">
      ${suffix ? `<span class="num-stepper-suffix">${escapeHtml(suffix)}</span>` : ''}
      <button type="button" class="num-stepper-btn" data-step="${step}" aria-label="Увеличить">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  `;
}

export function bindNumSteppers(root) {
  root.querySelectorAll('[data-num-stepper]').forEach((el) => {
    if (el._bound) return;
    el._bound = true;
    const input = el.querySelector('.num-stepper-input');
    el.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseFloat(btn.dataset.step) || 1;
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        let v = (parseFloat(input.value) || 0) + step;
        if (!isNaN(min)) v = Math.max(min, v);
        if (!isNaN(max)) v = Math.min(max, v);
        input.value = Number.isInteger(v) ? v : v.toFixed(2);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}