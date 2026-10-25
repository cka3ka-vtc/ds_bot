/* ============================================================
   Хелперы для разных секций: статус бота, счётчик ошибок в логах.
   ============================================================ */

import { state } from '../state.js';

/**
 * Обновляет индикатор «бот работает/выключен» в сайдбаре.
 * Считается «включённым», если хотя бы один модуль активен.
 */
export function updateBotStatus() {
  const s = state.settings;
  if (!s) return;

  const hasActiveAnnouncement = (state.announcements || []).some(a => a.enabled);
  const hasScheduledDelayed = (state.delayed || []).some(d => d.publishAt && !d.lastSentAt);
  const hasActiveAutodelete = (state.autodelete || []).some(a => a.enabled);
  const hasActiveBirthdays = !!state.birthdays?.settings?.enabled;

  const active = s.botEnabled !== false && (
    hasActiveAnnouncement ||
    hasScheduledDelayed ||
    hasActiveAutodelete ||
    hasActiveBirthdays
  );

  const el = document.getElementById('botStatus');
  const txt = document.getElementById('botStatusText');
  if (!el || !txt) return;

  el.classList.toggle('on', active);
  txt.textContent = active ? 'Активен' : 'Выключен';
}

/**
 * Обновляет бейдж с числом ошибок на иконке «Логи».
 */
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