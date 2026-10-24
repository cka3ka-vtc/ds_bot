import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { channelIcon } from './pickers.js';

/* ============================================================
   Карточка
   selectable: true → добавляет чекбокс для массовых операций
   ============================================================ */
export function renderMessageCard({ item, icon, title, subtitle, actions, metaLeft, metaRight, statusClass, selectable = false }) {
  const cls = ['list-card'];
  if (statusClass) cls.push(statusClass);
  const showFooter = metaLeft || metaRight;
  return `
    <div class="${cls.join(' ')}" data-id="${item.id}">
      <div class="list-card-head">
        ${selectable ? `<input type="checkbox" class="card-checkbox" data-select-id="${item.id}" aria-label="Выбрать">` : ''}
        <div class="list-card-icon">${icon}</div>
        <div class="list-card-title-block">
          <div class="list-card-title">${escapeHtml(title || 'Без названия')}</div>
          ${subtitle ? `<div class="list-card-sub">${escapeHtml(subtitle)}</div>` : ''}
        </div>
        <div class="list-card-actions">${actions}</div>
      </div>
      ${showFooter ? `
        <div class="list-card-footer">
          ${metaLeft ? `<div class="list-card-info-left">${metaLeft}</div>` : ''}
          ${metaRight ? `<div class="list-card-info-right">${metaRight}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

/* ============================================================
   Метаданные
   ============================================================ */
export function channelMeta(channel, fallbackName = '—') {
  const name = channel?.name || fallbackName;
  return `
    <span class="channel-badge">
      ${channelIcon(channel?.type ?? 0)}
      ${escapeHtml(name)}
    </span>
  `;
}

export function lastSentMeta(item) {
  return item.lastSentAt
    ? `Последняя отправка: ${new Date(item.lastSentAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Ещё не отправлялось';
}

export function findChannel(channelId) {
  return state.channels.find(c => c.id === channelId);
}

/* ============================================================
   Иконки
   ============================================================ */
export const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  delete: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
};

/* ============================================================
   Кнопки
   ============================================================ */
export function actionButton(action, icon, label, dataAttr, id, danger = false) {
  return `<button type="button" class="icon-btn${danger ? ' danger' : ''}" ${dataAttr}="${action}" data-id="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</button>`;
}

export function actionsDivider() {
  return '<span class="actions-divider" aria-hidden="true"></span>';
}

export function sendButton(id, dataAttr) {
  return `
    <button type="button" class="btn btn-primary btn-sm" ${dataAttr}="send" data-id="${id}" aria-label="Отправить">
      ${ICONS.send}
      <span>Отправить</span>
    </button>
  `;
}

export function actionsDropdown(id, dataAttr, items) {
  return `
    <div class="actions-dropdown">
      <button type="button" class="icon-btn" data-menu-toggle aria-label="Дополнительные действия" title="Дополнительные действия">
        ${ICONS.more}
      </button>
      <div class="actions-dropdown-menu" hidden>
        ${items.map(it => `
          <button type="button" ${dataAttr}="${it.action}" data-id="${id}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>
            ${it.icon}
            <span>${escapeHtml(it.label)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

export function bindActionsDropdown(container) {
  container.querySelectorAll('[data-menu-toggle]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = btn.nextElementSibling;
      const wasHidden = menu.hasAttribute('hidden');
      document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
      if (wasHidden) menu.removeAttribute('hidden');
    });
  });
  container.querySelectorAll('.actions-dropdown-menu button').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
    });
  });
}