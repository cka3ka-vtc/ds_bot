// public/assets/js/views/module-settings/pickers/channel.js
import { escapeHtml } from '../../../core/utils.js';
import { openPickerPopup } from './popup.js';
import { CLEAR_ICON } from './_icons.js';

/**
 * Иконка по типу канала.
 *   0  — текстовый (решётка)
 *   2  — голосовой (динамик)
 *   13 — stage (сцена)
 */
export function channelIcon(type = 0) {
  if (type === 2) {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  }
  if (type === 13) {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
}

export function channelPickerHTML({ id, hintId, value = '', placeholder = 'Выберите канал...' } = {}) {
  return `
    <div class="channel-picker" data-channel-picker="${escapeHtml(id)}" data-hint-id="${escapeHtml(hintId || '')}">
      <div class="channel-input-wrap">
        <span class="channel-input-icon" aria-hidden="true">${channelIcon(0)}</span>
        <input type="text" class="input channel-search" placeholder="${escapeHtml(placeholder)}" readonly value="">
        <button type="button" class="picker-clear-btn hidden" data-channel-clear aria-label="Очистить" tabindex="-1">
          ${CLEAR_ICON}
        </button>
      </div>
      ${hintId ? `<div class="hint" id="${escapeHtml(hintId)}">${value ? '' : 'Канал не выбран'}</div>` : ''}
    </div>
  `;
}

export function bindChannelPicker(container, { id, channels, onSelect, multiSelect = false, filterList = null }) {
  const root = container.querySelector(`[data-channel-picker="${id}"]`);
  if (!root) return;

  const wrap = root.querySelector('.channel-input-wrap');
  const input = root.querySelector('.channel-search');
  const iconEl = root.querySelector('.channel-input-icon');
  const clearBtn = root.querySelector('[data-channel-clear]');
  const hint = root.dataset.hintId ? document.getElementById(root.dataset.hintId) : null;

  const setValue = (ch) => {
    if (multiSelect) {
      input.value = '';
      clearBtn.classList.add('hidden');
      if (hint) hint.textContent = '';
    } else if (ch) {
      input.value = ch.name;
      if (iconEl) iconEl.innerHTML = channelIcon(ch.type);
      clearBtn.classList.remove('hidden');
      if (hint) hint.textContent = `Выбран: ${ch.name} · ${ch.id}`;
    } else {
      input.value = '';
      if (iconEl) iconEl.innerHTML = channelIcon(0);
      clearBtn.classList.add('hidden');
      if (hint) hint.textContent = 'Канал не выбран';
    }
    onSelect?.(ch || null);
  };

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue(null);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-channel-clear]')) return;
    e.stopPropagation();
    if (root.dataset.open === '1') return;
    root.dataset.open = '1';

    const list = filterList ? filterList(channels) : channels;

    const listHTML = (items) => items.length
      ? items.map((c) => `
          <button type="button" class="channel-option" data-channel-id="${escapeHtml(c.id)}">
            <span class="channel-option-icon">${channelIcon(c.type)}</span>
            <span class="channel-option-name">${escapeHtml(c.name)}</span>
            ${c.parentName ? `<span class="channel-option-id">${escapeHtml(c.parentName)}</span>` : ''}
          </button>
        `).join('')
      : '<div class="channel-empty">Ничего не найдено</div>';

    const popup = openPickerPopup(wrap, `
      <div class="picker-search">
        <input type="text" class="input picker-search-input" placeholder="Поиск...">
      </div>
      <div class="picker-list">${listHTML(list)}</div>
    `, { minWidth: 320 });

    const search = popup.querySelector('.picker-search-input');
    const listEl = popup.querySelector('.picker-list');
    search.focus();

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      listEl.innerHTML = listHTML(list.filter((c) => !q || c.name.toLowerCase().includes(q)));
    });

    popup.addEventListener('click', (ev) => {
      const opt = ev.target.closest('[data-channel-id]');
      if (!opt) return;
      const ch = list.find((c) => c.id === opt.dataset.channelId);
      if (!ch) return;
      setValue(ch);
      root.dataset.open = '';
      popup.remove();
    });

    const observer = new MutationObserver(() => {
      if (!document.body.contains(popup)) { root.dataset.open = ''; observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  });

  return { setValue };
}