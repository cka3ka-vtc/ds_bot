/* ============================================================
   UI-компоненты: toast, modal, confirmDialog, emptyState, skeleton.
   ============================================================ */

import { escapeHtml } from './utils.js';

/* ============================================================
   Toast
   ============================================================ */

/**
 * Показывает уведомление в правом нижнем углу.
 * @param {string} message
 * @param {object} [opts]
 * @param {'success'|'error'} [opts.type]
 * @param {number} [opts.duration]
 * @returns {{ close: () => void }}
 */
export function toast(message, opts = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return { close: () => {} };

  const el = document.createElement('div');
  el.className = 'toast' + (opts.type === 'error' ? ' error' : '');
  el.setAttribute('role', 'status');

  const icon = opts.type === 'error'
    ? '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger);"></i>'
    : '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';

  el.innerHTML = `
    ${icon}
    <span class="toast-message">${escapeHtml(message)}</span>
    ${opts.action ? `<button type="button" class="toast-action">${escapeHtml(opts.action.label)}</button>` : ''}
  `;

  container.appendChild(el);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  };

  if (opts.action) {
    el.querySelector('.toast-action').addEventListener('click', () => {
      try { opts.action.onClick?.(); }
      finally { close(); }
    });
  }

  setTimeout(close, opts.duration || 3500);
  return { close };
}

/* ============================================================
   Modal
   ============================================================ */

/**
 * Открывает модальное окно.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string|HTMLElement} opts.body - HTML-строка или DOM-элемент
 * @param {string|HTMLElement} [opts.footer] - HTML-строка или DOM-элемент
 * @param {'normal'|'fullscreen'} [opts.size]
 * @param {() => void} [opts.onClose]
 * @returns {{ backdrop, bodyEl, footerEl, close }}
 */
export function modal({ title, body, footer, size = 'normal', onClose }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  backdrop.innerHTML = `
    <div class="modal ${size === 'fullscreen' ? 'modal-fullscreen' : ''}" role="document">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button type="button" class="modal-close" aria-label="Закрыть">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer"></div>
    </div>
  `;

  const bodyEl = backdrop.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body) bodyEl.appendChild(body);

  const footerEl = backdrop.querySelector('.modal-footer');
  if (footer) {
    if (typeof footer === 'string') footerEl.innerHTML = footer;
    else footerEl.appendChild(footer);
  } else {
    footerEl.remove();
  }

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);

  document.getElementById('modalsContainer').appendChild(backdrop);

  setTimeout(() => {
    const first = backdrop.querySelector('input:not([type="hidden"]), textarea, select, button');
    first?.focus();
  }, 50);

  return { backdrop, bodyEl, footerEl, close };
}

/* ============================================================
   ConfirmDialog
   ============================================================ */

/**
 * Диалог подтверждения. Возвращает Promise<boolean>.
 * @param {object} opts
 * @param {string} [opts.title]
 * @param {string} [opts.text]
 * @param {string} [opts.actionText]
 * @param {boolean} [opts.danger]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'Подтверждение',
  text = '',
  actionText = 'Удалить',
  danger = true
}) {
  return new Promise((resolve) => {
    let resolved = false;

    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    footer.innerHTML = `
      <button type="button" class="btn btn-ghost" data-action="cancel">Отмена</button>
      <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeHtml(actionText)}</button>
    `;

    const m = modal({
      title,
      body: `<p style="color:var(--text-dim);line-height:1.55;">${escapeHtml(text)}</p>`,
      footer,
      onClose: () => {
        if (!resolved) { resolved = true; resolve(false); }
      }
    });

    footer.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      if (resolved) return;
      resolved = true;
      m.close();
      resolve(false);
    });
    footer.querySelector('[data-action="confirm"]').addEventListener('click', () => {
      if (resolved) return;
      resolved = true;
      m.close();
      resolve(true);
    });
  });
}

/* ============================================================
   EmptyState
   ============================================================ */

/**
 * Универсальный пустой экран с CTA.
 * @param {object} opts
 * @param {string} [opts.icon='fa-inbox'] - FA-класс без префикса
 * @param {string} opts.title
 * @param {string} [opts.text]
 * @param {string} [opts.ctaLabel]
 * @param {string} [opts.ctaAction='create']
 * @param {string} [opts.exampleLabel]
 * @param {string} [opts.exampleAction='example']
 * @returns {string} HTML
 */
export function emptyState({
  icon = 'fa-inbox',
  title,
  text,
  ctaLabel,
  ctaAction = 'create',
  exampleLabel,
  exampleAction = 'example'
}) {
  return `
    <div class="empty-state" role="region" aria-label="${escapeHtml(title || '')}">
      <div class="empty-state-icon"><i class="fa-solid ${icon}"></i></div>
      <h3 class="empty-state-title">${escapeHtml(title || '')}</h3>
      ${text ? `<p class="empty-state-text">${escapeHtml(text)}</p>` : ''}
      <div class="empty-state-actions">
        ${ctaLabel ? `<button type="button" class="btn btn-primary btn-sm" data-${ctaAction}><i class="fa-solid fa-plus"></i> ${escapeHtml(ctaLabel)}</button>` : ''}
        ${exampleLabel ? `<button type="button" class="btn btn-ghost btn-sm" data-${exampleAction}><i class="fa-solid fa-lightbulb"></i> ${escapeHtml(exampleLabel)}</button>` : ''}
      </div>
    </div>
  `;
}

/**
 * Скелетоны для загрузки списка.
 * @param {number} [count=3]
 * @returns {string}
 */
export function skeletonCards(count = 3) {
  return Array.from({ length: count }, () => '<div class="skeleton-card"></div>').join('');
}