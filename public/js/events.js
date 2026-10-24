import { state } from './state.js';
import { api } from './api.js';

let source = null;
let currentGuildId = null;
let firstConnect = true;
const pendingSections = new Set();
let flushTimer = null;

const ALL_SECTIONS = ['birthdays', 'profiles', 'logs', 'messages', 'announcements', 'delayed', 'autodelete'];
const DASHBOARD_RELEVANT = new Set(['birthdays', 'logs', 'announcements', 'delayed', 'autodelete']);

export function startEvents(guildId) {
  stopEvents();
  if (!guildId) return;
  currentGuildId = guildId;
  firstConnect = true;

  try { source = new EventSource(`/api/guilds/${guildId}/events`); }
  catch (e) { console.error('[events] EventSource init failed:', e); return; }

  source.onopen = () => {
    console.log('[events] SSE connected');
    if (firstConnect) { firstConnect = false; return; }
    console.log('[events] SSE reconnected → full resync');
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
    } catch (err) { console.error('[events] parse error:', err); }
  };

  source.onerror = () => {
    console.warn('[events] connection error (EventSource will auto-reconnect)');
  };
}

export function stopEvents() {
  if (source) { try { source.close(); } catch {} source = null; }
  currentGuildId = null;
  firstConnect = true;
  pendingSections.clear();
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
}

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
    if (sections.some(s => DASHBOARD_RELEVANT.has(s)) && state.currentSection === 'dashboard') {
      try {
        const m = await import('./sections/dashboard.js');
        m.renderDashboard?.();
      } catch (e) { console.error('[events] dashboard refresh failed:', e); }
    }
  }, 200);
}

function isModalOpen() {
  return !!document.querySelector('.modal-backdrop');
}

async function refreshSection(section) {
  if (!currentGuildId) return;
  const modalOpen = isModalOpen();

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
  } else if (section === 'profiles') {
    state.profiles = fresh;
    if (state.currentSection === 'profiles' && !modalOpen) {
      const m = await import('./sections/profiles.js');
      m.renderProfilesView?.();
    }
  } else if (section === 'messages') {
    state.messages = fresh.items || [];
    if (state.currentSection === 'messages' && !modalOpen) {
      const m = await import('./sections/messages.js');
      m.renderMessagesList?.();
    }
  } else if (section === 'announcements') {
    state.announcements = fresh.items || [];
    if (state.currentSection === 'announcements' && !modalOpen) {
      const m = await import('./sections/announcements.js');
      m.renderAnnouncementsList?.();
    }
  } else if (section === 'delayed') {
    state.delayed = fresh.items || [];
    if (state.currentSection === 'delayed' && !modalOpen) {
      const m = await import('./sections/delayed.js');
      m.renderDelayedList?.();
    }
  } else if (section === 'autodelete') {
    state.autodelete = fresh.items || [];
    if (state.currentSection === 'autodelete' && !modalOpen) {
      const m = await import('./sections/autodelete.js');
      m.renderAutodeleteList?.();
    }
  } else if (section === 'rules') {
    state.rules = fresh;
  }
}