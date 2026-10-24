import { state } from '../state.js';

export function updateBotStatus() {
  const s = state.settings;
  if (!s) return;
  const hasActiveAnnouncement = (state.announcements || []).some(a => a.enabled);
  const hasScheduledDelayed = (state.delayed || []).some(d => d.publishAt && !d.lastSentAt);
  const hasActiveAutodelete = (state.autodelete || []).some(a => a.enabled);
  const hasActiveBirthdays = !!state.birthdays?.settings?.enabled;
  const active = s.botEnabled !== false && (
    hasActiveAnnouncement || hasScheduledDelayed || hasActiveAutodelete || hasActiveBirthdays
  );
  const el = document.getElementById('botStatus');
  const txt = document.getElementById('botStatusText');
  if (!el) return;
  el.classList.toggle('on', active);
  txt.textContent = active ? 'Активен' : 'Выключен';
}

export function updateLogsBadge() {
  const errorCount = (state.logs || []).filter(l => l.level === 'error').length;
  const badge = document.getElementById('logsBadge');
  if (!badge) return;
  if (errorCount > 0) {
    badge.textContent = errorCount;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}