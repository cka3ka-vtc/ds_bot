/* ============================================================
   Hash-роутер.

   Формат URL: #/guilds/:guildId/:section
   Пример: http://localhost:3000/#/guilds/123456789/messages

   - parseHash()    — разбирает текущий URL
   - navigate()     — меняет hash без перезагрузки
   - onRouteChange() — подписка на смену маршрута
   ============================================================ */

const listeners = new Set();

/**
 * Разбирает текущий URL.
 * @returns {{ guildId: string|null, section: string|null }}
 */
export function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);

  if (parts[0] !== 'guilds' || parts.length < 2) {
    return { guildId: null, section: null };
  }
  return {
    guildId: parts[1] || null,
    section: parts[2] || 'dashboard'
  };
}

/**
 * Меняет URL и уведомляет подписчиков.
 * @param {string|null} guildId
 * @param {string|null} section
 */
export function navigate(guildId, section) {
  const hash = guildId
    ? `#/guilds/${guildId}/${section || 'dashboard'}`
    : '#/';

  if (location.hash === hash) {
    notify();
    return;
  }
  history.pushState(null, '', hash);
  notify();
}

/**
 * Подписка на изменение маршрута.
 * @param {(route: object) => void} fn
 * @returns {() => void} отписка
 */
export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  const route = parseHash();
  for (const fn of listeners) {
    try { fn(route); }
    catch (e) { console.error('[router] listener:', e); }
  }
}

window.addEventListener('hashchange', notify);
window.addEventListener('popstate', notify);