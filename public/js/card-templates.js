/* ============================================================
   Шаблоны карточек списков и общие иконки.

   Здесь:
   - renderMessageCard() — карточка для messages/announcements/delayed/autodelete
   - actionsDropdown()   — кнопка «...» с выпадающим меню
   - actionButton()      — иконка-кнопка
   - bindActionsDropdown() — закрытие меню по клику вне
   - ICONS               — общий набор FA-иконок
   ============================================================ */

import { state } from './state.js';
import { escapeHtml } from './utils.js';
import { channelIcon } from './pickers.js';

/* ============================================================
   Карточка списка
   ============================================================ */

/**
 * Рендерит карточку сообщения/объявления/отложки.
 * @param {object} opts
 * @param {object} opts.item - объект с id
 * @param {string} opts.icon - HTML иконки (i-тег)
 * @param {string} opts.title
 * @param {string} [opts.subtitle]
 * @param {string} opts.actions - HTML блока действий
 * @param {string} [opts.metaLeft] - HTML футера слева
 * @param {string} [opts.metaRight] - HTML футера справа
 * @param {string} [opts.statusClass] - 'active'/'sent'/'scheduled'/'deleted'
 * @param {boolean} [opts.selectable=false] - показывать чекбокс
 * @returns {string}
 */
export function renderMessageCard({
  item, icon, title, subtitle, actions, metaLeft, metaRight,
  statusClass, selectable = false
}) {
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
   Общие иконки (FA)
   ============================================================ */

export const ICONS = {
  edit:     '<i class="fa-solid fa-pen"></i>',
  send:     '<i class="fa-solid fa-paper-plane"></i>',
  copy:     '<i class="fa-solid fa-copy"></i>',
  export:   '<i class="fa-solid fa-download"></i>',
  delete:   '<i class="fa-solid fa-trash"></i>',
  more:     '<i class="fa-solid fa-ellipsis-vertical"></i>',
  calendar: '<i class="fa-solid fa-calendar"></i>',
  clock:    '<i class="fa-solid fa-clock"></i>'
};

/* ============================================================
   Утилитарные мета-блоки
   ============================================================ */

/**
 * Бейдж с иконкой канала и названием.
 * @param {object|null} channel
 * @param {string} [fallbackName]
 * @returns {string}
 */
export function channelMeta(channel, fallbackName = '—') {
  const name = channel?.name || fallbackName;
  return `<span class="channel-badge">${channelIcon(channel?.type ?? 0)} ${escapeHtml(name)}</span>`;
}

/**
 * «Отправлено: дд.мм чч:мм» или «Ещё не отправлено».
 * @param {object} item
 * @returns {string}
 */
export function lastSentMeta(item) {
  return item.lastSentAt
    ? `Отправлено: ${new Date(item.lastSentAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Ещё не отправлено';
}

/**
 * Ищет канал в state.channels по id.
 * @param {string} channelId
 * @returns {object|undefined}
 */
export function findChannel(channelId) {
  return state.channels.find(c => c.id === channelId);
}

/* ============================================================
   Кнопки действий
   ============================================================ */

/**
 * Иконка-кнопка.
 * @param {string} action - имя действия (data-<attr>="<action>")
 * @param {string} icon - HTML иконки
 * @param {string} label - aria-label и title
 * @param {string} dataAttr - например 'data-msg-action'
 * @param {string} id - id объекта
 * @param {boolean} [danger]
 * @returns {string}
 */
export function actionButton(action, icon, label, dataAttr, id, danger = false) {
  return `<button type="button" class="icon-btn${danger ? ' danger' : ''}" ${dataAttr}="${action}" data-id="${id}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</button>`;
}

/**
 * Разделитель между группами кнопок.
 * @returns {string}
 */
export function actionsDivider() {
  return '<span class="actions-divider" aria-hidden="true"></span>';
}

/**
 * Кнопка «Отправить».
 * @param {string} id
 * @param {string} dataAttr
 * @returns {string}
 */
export function sendButton(id, dataAttr) {
  return `
    <button type="button" class="btn btn-primary btn-sm" ${dataAttr}="send" data-id="${id}" aria-label="Отправить">
      ${ICONS.send}<span>Отправить</span>
    </button>
  `;
}

/**
 * Кнопка «...» с dropdown-меню.
 * @param {string} id
 * @param {string} dataAttr
 * @param {Array<{action,icon,label,danger?,disabled?}>} items
 * @returns {string}
 */
export function actionsDropdown(id, dataAttr, items) {
  return `
    <div class="actions-dropdown">
      <button type="button" class="icon-btn" data-menu-toggle aria-label="Ещё" title="Ещё">${ICONS.more}</button>
      <div class="actions-dropdown-menu" hidden>
        ${items.map(it => `
          <button type="button" ${dataAttr}="${it.action}" data-id="${id}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}>
            ${it.icon}<span>${escapeHtml(it.label)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Открытие/закрытие dropdown-меню.
 * @param {HTMLElement} container
 */
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