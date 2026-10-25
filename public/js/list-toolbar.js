/* ============================================================
   Тулбар списка: поиск + фильтры + bulk-панель.

   Используется в messages, announcements, delayed, autodelete,
   birthdays, profiles. Создаёт панель сверху списка и bulk-панель
   под ним; перерисовывает содержимое через renderList(filtered).

   Автоматически управляет чекбоксами на карточках (класс .selected).
   ============================================================ */

import { escapeHtml, debounce } from './utils.js';

/**
 * Создаёт тулбар и bulk-панель над списком.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.listEl          - контейнер списка
 * @param {Function} opts.getAllItems        - () => массив всех элементов
 * @param {Function} opts.renderList         - (filtered) => void, перерисовка
 * @param {string} [opts.searchPlaceholder]
 * @param {Function} [opts.searchKeyFn]      - (item) => строка для поиска
 * @param {Array<{id,label,fn}>} [opts.filters]
 * @param {Array<{id,label,handler,danger?}>} [opts.actions] - bulk-действия
 * @param {string} [opts.selectableSelector='.list-card']
 * @param {Function} [opts.onFilterChange]
 * @returns {{ el: HTMLElement, refresh: Function, clearSelection: Function, destroy: Function }}
 */
export function createListToolbar({
  listEl,
  getAllItems,
  renderList,
  searchPlaceholder = 'Поиск…',
  searchKeyFn = (it) => it.name || it.title || '',
  filters = [],
  actions = [],
  selectableSelector = '.list-card',
  onFilterChange = null
}) {
  const selected = new Set();
  const parent = listEl.parentNode;

  /* ===== Toolbar (search + filters) ===== */
  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';
  toolbar.innerHTML = `
    <div class="list-search">
      <span class="list-search-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
      <input type="search" placeholder="${escapeHtml(searchPlaceholder)}" data-search>
    </div>
    ${filters.map(f => `
      <button type="button" class="list-filter-btn" data-filter="${f.id}">${escapeHtml(f.label)}</button>
    `).join('')}
  `;

  /* ===== Bulk-panel ===== */
  const bulk = document.createElement('div');
  bulk.className = 'bulk-panel';
  bulk.innerHTML = `
    <span class="bulk-count" data-bulk-count>0 выбрано</span>
    <div class="bulk-actions">
      <button type="button" class="btn btn-ghost" data-bulk-clear>Снять</button>
      ${actions.map(a => `
        <button type="button" class="btn ${a.danger ? 'btn-danger' : 'btn-ghost'}" data-bulk-action="${a.id}">${escapeHtml(a.label)}</button>
      `).join('')}
    </div>
  `;

  parent.insertBefore(toolbar, listEl);
  parent.insertBefore(bulk, listEl);

  const searchInput = toolbar.querySelector('[data-search]');
  const filterBtns = toolbar.querySelectorAll('[data-filter]');
  const bulkCountEl = bulk.querySelector('[data-bulk-count]');

  let searchVal = '';
  let filterId = null;

  const fireFilterChange = () => {
    if (typeof onFilterChange === 'function') {
      try { onFilterChange(); }
      catch (e) { console.error('[toolbar] onFilterChange error:', e); }
    }
  };

  /* ===== Фильтрация ===== */
  function applyFilters(items) {
    let r = items;
    const q = searchVal.trim().toLowerCase();
    if (q) r = r.filter(it => (searchKeyFn(it) || '').toLowerCase().includes(q));
    if (filterId) {
      const f = filters.find(x => x.id === filterId);
      if (f) r = r.filter(f.fn);
    }
    return r;
  }

  /* ===== Чекбоксы ===== */
  function bindCheckboxes() {
    const visibleIds = new Set();

    listEl.querySelectorAll('[data-select-id]').forEach(cb => {
      const id = cb.dataset.selectId;
      visibleIds.add(id);
      const card = cb.closest(selectableSelector);

      cb.checked = selected.has(id);
      if (card) card.classList.toggle('selected', cb.checked);

      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(id);
        else selected.delete(id);
        if (card) card.classList.toggle('selected', cb.checked);
        updateBulk();
      });
    });

    /* Снимаем выделение с тех, кого нет в текущей выборке */
    for (const id of [...selected]) {
      if (!visibleIds.has(id)) selected.delete(id);
    }
    updateBulk();
  }

  function updateBulk() {
    const n = selected.size;
    bulk.classList.toggle('show', n > 0);
    bulkCountEl.textContent = `${n} ${n === 1 ? 'выбран' : 'выбрано'}`;
  }

  /* ===== Ре-рендер ===== */
  function rerender() {
    const all = getAllItems();
    const filtered = applyFilters(all);
    renderList(filtered);
    bindCheckboxes();
  }

  /* ===== Обработчики ===== */
  searchInput.addEventListener('input', debounce((e) => {
    searchVal = e.target.value;
    fireFilterChange();
    rerender();
  }, 200));

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.filter;
      if (filterId === id) {
        filterId = null;
        btn.classList.remove('active');
      } else {
        filterId = id;
        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
      }
      fireFilterChange();
      rerender();
    });
  });

  bulk.querySelector('[data-bulk-clear]').addEventListener('click', () => {
    selected.clear();
    rerender();
  });

  bulk.querySelectorAll('[data-bulk-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!selected.size) return;
      const a = actions.find(x => x.id === btn.dataset.bulkAction);
      if (!a) return;

      const ids = [...selected];
      btn.disabled = true;
      try {
        await a.handler(ids);
        selected.clear();
        rerender();
      } catch (e) {
        console.error('[bulk] action failed:', e);
      } finally {
        btn.disabled = false;
      }
    });
  });

  return {
    el: toolbar,
    refresh: rerender,
    clearSelection: () => { selected.clear(); rerender(); },
    destroy: () => { toolbar.remove(); bulk.remove(); }
  };
}

/**
 * HTML «Ничего не найдено».
 * @returns {string}
 */
export function noResultsHTML() {
  return `<div class="list-no-results">Ничего не найдено</div>`;
}