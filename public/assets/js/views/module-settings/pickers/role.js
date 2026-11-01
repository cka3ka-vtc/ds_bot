// public/assets/js/views/module-settings/pickers/role.js
import { escapeHtml } from '../../../core/utils.js';
import { openPickerPopup } from './popup.js';
import { ROLE_SHIELD, CLEAR_ICON } from './_icons.js';

export function rolePickerHTML({ id, value = '', roles = [], placeholder = 'Выберите роль...' } = {}) {
  const selected = roles.find((r) => r.id === value);
  const label = selected ? selected.name : '';
  const iconHTML = selected
    ? `<span class="role-color-dot" style="background:${escapeHtml(selected.color || '#5b6373')};"></span>`
    : ROLE_SHIELD;
  return `
    <div class="role-picker" data-role-picker="${escapeHtml(id)}">
      <div class="role-input-wrap">
        <span class="role-input-icon" aria-hidden="true">${iconHTML}</span>
        <input type="text" class="input role-search" placeholder="${escapeHtml(placeholder)}" readonly value="${escapeHtml(label)}">
        <button type="button" class="picker-clear-btn ${label ? '' : 'hidden'}" data-role-clear aria-label="Очистить" tabindex="-1">
          ${CLEAR_ICON}
        </button>
      </div>
    </div>
  `;
}

export function bindRolePicker(container, { id, roles, onSelect, multiSelect = false, filterList = null }) {
  const root = container.querySelector(`[data-role-picker="${id}"]`);
  if (!root) return;
  const wrap = root.querySelector('.role-input-wrap');
  const input = root.querySelector('.role-search');
  const iconEl = root.querySelector('.role-input-icon');
  const clearBtn = root.querySelector('[data-role-clear]');

  const setValue = (role) => {
    if (multiSelect) {
      input.value = '';
      iconEl.innerHTML = ROLE_SHIELD;
      clearBtn.classList.add('hidden');
    } else if (role) {
      input.value = role.name;
      iconEl.innerHTML = `<span class="role-color-dot" style="background:${escapeHtml(role.color || '#5b6373')};"></span>`;
      clearBtn.classList.remove('hidden');
    } else {
      input.value = '';
      iconEl.innerHTML = ROLE_SHIELD;
      clearBtn.classList.add('hidden');
    }
    onSelect?.(role || null);
  };

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue(null);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-role-clear]')) return;
    e.stopPropagation();
    if (root.dataset.open === '1') return;
    root.dataset.open = '1';

    const list = filterList ? filterList(roles) : roles;

    const listHTML = (items) => items.length
      ? items.map((r) => `
          <button type="button" class="role-option" data-role-id="${escapeHtml(r.id)}">
            <span class="role-option-dot" style="background:${escapeHtml(r.color || '#5b6373')};"></span>
            <span class="role-option-name">${escapeHtml(r.name)}</span>
            <span class="role-option-id">${r.memberCount || 0} уч.</span>
          </button>
        `).join('')
      : '<div class="role-empty">Ничего не найдено</div>';

    const popup = openPickerPopup(wrap, `
      <div class="picker-search">
        <input type="text" class="input picker-search-input" placeholder="Поиск...">
      </div>
      <div class="picker-list">${listHTML(list)}</div>
    `, { minWidth: 280 });

    const search = popup.querySelector('.picker-search-input');
    const listEl = popup.querySelector('.picker-list');
    search.focus();

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      listEl.innerHTML = listHTML(list.filter((r) => !q || r.name.toLowerCase().includes(q)));
    });

    popup.addEventListener('click', (ev) => {
      const opt = ev.target.closest('[data-role-id]');
      if (!opt) return;
      const role = list.find((r) => r.id === opt.dataset.roleId);
      if (!role) return;
      setValue(role);
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