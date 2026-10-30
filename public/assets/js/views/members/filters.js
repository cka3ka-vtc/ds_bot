// public/assets/js/views/members/filters.js
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const M = UI.members;

export function bindFilters(view) {
  const container = view.container;
  if (!container) return;

  // КРИТИЧНО: bindFilters вызывается при каждом _renderUI (пере-рендер
  // всего контейнера). Старый mousedown-listener остаётся привязанным
  // к document и ссылается на отвязанный DOM — утечка. Снимаем его.
  if (view._outsideClick) {
    document.removeEventListener('mousedown', view._outsideClick);
    view._outsideClick = null;
  }

  const filter = container.querySelector('#memRoleFilter');
  if (!filter) return;

  const trigger = filter.querySelector('[data-role-filter-trigger]');
  const popup = filter.querySelector('[data-role-filter-popup]');
  const search = filter.querySelector('[data-role-filter-search]');
  const list = filter.querySelector('[data-role-filter-list]');

  const renderOptions = (q) => {
    const query = (q || '').trim().toLowerCase();
    const roles = view.state.roles.filter((r) => {
      if (!query) return true;
      return r.name.toLowerCase().includes(query) || String(r.id).includes(query);
    });

    const allActive = !view.state.roleFilter ? 'selected' : '';
    let html = `
      <button type="button" class="role-filter-option ${allActive}" data-role-id="">
        <i class="fa-solid fa-users" style="width:10px;font-size:10px;color:var(--muted);flex-shrink:0;"></i>
        <span class="role-filter-option-name">${M.roleFilterAll}</span>
      </button>
    `;

    if (!roles.length) {
      html += `<div class="role-filter-empty">${view.state.roles.length ? M.roleFilterEmpty : M.roleFilterUnavailable}</div>`;
    } else {
      html += roles.map((r) => {
        const isSel = view.state.roleFilter === r.id;
        const color = r.color && r.color !== '#000000' ? r.color : 'var(--border-strong)';
        return `
          <button type="button" class="role-filter-option ${isSel ? 'selected' : ''}" data-role-id="${escapeHtml(r.id)}">
            <span class="role-filter-option-dot" style="background:${escapeHtml(color)};"></span>
            <span class="role-filter-option-name">${escapeHtml(r.name)}</span>
            <span class="role-filter-option-id">${escapeHtml(r.id)}</span>
          </button>
        `;
      }).join('');
    }
    list.innerHTML = html;
  };

  const closePopup = () => {
    popup.hidden = true;
    search.value = '';
    if (view._outsideClick) {
      document.removeEventListener('mousedown', view._outsideClick);
      view._outsideClick = null;
    }
  };

  const openPopup = () => {
    popup.hidden = false;
    renderOptions('');
    setTimeout(() => search.focus(), 0);
    view._outsideClick = (ev) => { if (!filter.contains(ev.target)) closePopup(); };
    setTimeout(() => document.addEventListener('mousedown', view._outsideClick), 0);
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (popup.hidden) openPopup(); else closePopup();
  });

  search.addEventListener('input', (e) => renderOptions(e.target.value));

  list.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-role-id]');
    if (!opt) return;
    view.state.roleFilter = opt.dataset.roleId || null;

    const label = filter.querySelector('[data-role-filter-label]');
    if (view.state.roleFilter) {
      const role = view.state.roles.find((r) => r.id === view.state.roleFilter);
      label.textContent = role ? role.name : view.state.roleFilter;
      label.classList.remove('empty');
    } else {
      label.textContent = M.roleFilterAll;
      label.classList.add('empty');
    }
    closePopup();
    view._reload(1);
  });
}