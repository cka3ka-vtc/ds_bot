import { escapeHtml } from './utils.js';

/* ============================================================
   Toast
   ============================================================ */
export function toast(message, opts = {}) {
  const container = document.getElementById('toastContainer');
  if (!container) return { close: () => {} };
  const el = document.createElement('div');
  el.className = 'toast' + (opts.type === 'error' ? ' error' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      ${opts.type === 'error'
        ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
        : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}
    </svg>
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
      try { opts.action.onClick?.(); } finally { close(); }
    });
  }

  setTimeout(close, opts.duration || 3500);
  return { close };
}

/* ============================================================
   Modal (идемпотентное закрытие)
   ============================================================ */
const openModals = [];

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
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
    const idx = openModals.indexOf(backdrop);
    if (idx !== -1) openModals.splice(idx, 1);
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') trapFocus(e, backdrop);
  };

  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', onKey);

  document.getElementById('modalsContainer').appendChild(backdrop);
  openModals.push(backdrop);

  setTimeout(() => {
    const first = backdrop.querySelector('input:not([type="hidden"]), textarea, select, button');
    first?.focus();
  }, 50);

  return { backdrop, bodyEl, footerEl, close };
}

function trapFocus(e, container) {
  const focusable = container.querySelectorAll('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ============================================================
   Confirm (исправлено: правильный resolve)
   ============================================================ */
export function confirmDialog({ title = 'Подтверждение', text, actionText = 'Удалить', danger = true }) {
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
      body: `<p style="color:var(--text-dim);line-height:1.55;">${escapeHtml(text || '')}</p>`,
      footer,
      onClose: () => { if (!resolved) { resolved = true; resolve(false); } }
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
   Skeleton / Empty
   ============================================================ */
export function skeletonCards(count = 2) {
  return Array.from({ length: count }, () => '<div class="skeleton-card"></div>').join('');
}

export function emptyState(icon, title, subtitle) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div>
      <p>${escapeHtml(title)}</p>
      <span>${escapeHtml(subtitle)}</span>
    </div>
  `;
}