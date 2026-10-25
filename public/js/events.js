/* ============================================================
   SSE-клиент: подписка на обновления гильдии.

   При событии «section-update» — перезагружает нужную секцию
   через API и перерисовывает её, если пользователь на этой
   странице и не открыта модалка.
   ============================================================ */

import { api } from './api.js';
import { state } from './state.js';

let source = null;
let currentGuildId = null;
let firstConnect = true;

const pendingSections = new Set();
let flushTimer = null;

const ALL_SECTIONS = ['birthdays', 'profiles', 'logs', 'messages', 'announcements', 'delayed', 'autodelete'];
const DASHBOARD_RELEVANT = new Set(['birthdays', 'logs', 'announcements', 'delayed', 'autodelete']);

/**
 * Открывает SSE-соединение для гильдии.
 * @param {string} guildId
 */
export function startEvents(guildId) {
  stopEvents();
  if (!guildId) return;

  currentGuildId = guildId;
  firstConnect = true;

  try {
    source = new EventSource(`/api/guilds/${guildId}/events`);
  } catch (e) {
    console.error('[events] EventSource init failed:', e);
    return;
  }

  source.onopen = () => {
    console.log('[events] SSE connected');
    if (firstConnect) { firstConnect = false; return; }
    /* Переподключились — перезагружаем всё, что могли пропустить */
    ALL_SECTIONS.forEach(s => pendingSections.add(s));
    scheduleFlush();
  };

  source.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg?.type === 'section-update' && msg.section) {
        pendingSections.add(msg.section);
        scheduleFlush();
      }
    } catch (err) {
      console.error('[events] parse error:', err);
    }
  };

  source.onerror = () => {
    console.warn('[events] connection error (EventSource auto-reconnect)');
  };
}

/**
 * Закрывает SSE-соединение.
 */
export function stopEvents() {
  if (source) {
    try { source.close(); } catch {}
    source = null;
  }
  currentGuildId = null;
  firstConnect = true;
  pendingSections.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/* ---------- Внутренняя логика ---------- */

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const sections = [...pendingSections];
    pendingSections.clear();

    for (const section of sections) {
      try { await refreshSection(section); }
      catch (e) { console.error(`[events] refresh ${section} failed:`, e); }
    }

    /* Если открыт дашборд — обновим его тоже */
    if (sections.some(s => DASHBOARD_RELEVANT.has(s)) && state.currentSection === 'dashboard') {
      try {
        const m = await import('./sections/dashboard.js');
        m.renderDashboard?.();
      } catch (e) {
        console.error('[events] dashboard refresh failed:', e);
      }
    }
  }, 200);
}

function isModalOpen() {
  return !!document.querySelector('.modal-backdrop');
}

async function refreshSection(section) {
  if (!currentGuildId) return;
  const modalOpen = isModalOpen();

  /* Логи */
  if (section === 'logs') {
    if (state.currentSection === 'logs' && !modalOpen) {
      const m = await import('./sections/logs.js');
      await m.renderLogsView?.();
    } else {
      const data = await api.logs(currentGuildId).catch(() => null);
      if (!data) return;
      state.logs = data.items || [];
      const helpers = await import('./sections/helpers.js');
      helpers.updateLogsBadge?.();
    }
    return;
  }

  /* Остальные секции */
  const fresh = await api.getData(currentGuildId, section).catch(() => null);
  if (!fresh) return;

  if (section === 'birthdays') {
    state.birthdays = fresh;
    if (state.currentSection === 'birthdays' && !modalOpen) {
      const m = await import('./sections/birthdays.js');
      m.refreshBirthdaysList?.();
    }
    if (state.currentSection === 'profiles' && !modalOpen) {
      const m = await import('./sections/profiles.js');
      m.refreshProfilesList?.();
    }
    return;
  }

  if (section === 'profiles') {
    state.profiles = fresh;
    if (state.currentSection === 'profiles' && !modalOpen) {
      const m = await import('./sections/profiles.js');
      m.renderProfilesView?.();
    }
    return;
  }

  if (section === 'messages') {
    state.messages = fresh.items || [];
    if (state.currentSection === 'messages' && !modalOpen) {
      const m = await import('./sections/messages.js');
      m.renderMessagesList?.();
    }
    return;
  }

  if (section === 'announcements') {
    state.announcements = fresh.items || [];
    if (state.currentSection === 'announcements' && !modalOpen) {
      const m = await import('./sections/announcements.js');
      m.renderAnnouncementsList?.();
    }
    return;
  }

  if (section === 'delayed') {
    state.delayed = fresh.items || [];
    if (state.currentSection === 'delayed' && !modalOpen) {
      const m = await import('./sections/delayed.js');
      m.renderDelayedList?.();
    }
    return;
  }

  if (section === 'autodelete') {
    state.autodelete = fresh.items || [];
    if (state.currentSection === 'autodelete' && !modalOpen) {
      const m = await import('./sections/autodelete.js');
      m.renderAutodeleteList?.();
    }
    return;
  }

  if (section === 'rules') {
    state.rules = fresh;
  }
}