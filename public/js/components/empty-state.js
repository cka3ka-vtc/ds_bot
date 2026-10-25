/* ============================================================
   Хелпер для вставки emptyState с обработчиками.

   Использование:
     container.appendChild(buildEmptyState(opts, {
       create: () => openCreate(),
       example: () => openExample()
     }));
   ============================================================ */

import { emptyState } from '../ui.js';

/**
 * Строит DOM-элемент empty state с обработчиками.
 * @param {object} opts - параметры для emptyState
 * @param {object} [handlers]
 * @param {Function} [handlers.create]
 * @param {Function} [handlers.example]
 * @returns {HTMLElement}
 */
export function buildEmptyState(opts, handlers = {}) {
  const wrap = document.createElement('div');
  wrap.innerHTML = emptyState(opts);
  const el = wrap.firstElementChild;

  el.querySelectorAll('[data-create], [data-example]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.hasAttribute('data-create') ? 'create' : 'example';
      try { handlers[key]?.(); }
      catch (e) { console.error('[empty-state] handler:', e); }
    });
  });

  return el;
}