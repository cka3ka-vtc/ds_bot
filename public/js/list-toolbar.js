import { escapeHtml, debounce } from './utils.js';

/* ============================================================
   Универсальный тулбар (поиск + фильтры + bulk-панель).
   Используется во всех секциях со списками карточек:
   messages / announcements / delayed / autodelete / birthdays.

   onFilterChange — вызывается при смене поиска или фильтра,
   ДО ре-рендера. Удобно для сброса пагинации на 1-ю страницу.
   ============================================================ */
export function createListToolbar({
  listEl,
  getAllItems,
  renderList,
  searchPlaceholder = 'Поиск по названию…',
  searchKeyFn = (it) => it.name || it.title || '',
  filters = [],
  actions = [],
  selectableSelector = '.list-card',
  onFilterChange = null
}) {
  const selected = new Set();
  const parent = listEl.parentNode;

  /* === Тулбар === */
  const toolbar = document.createElement('div');
  toolbar.className = 'list-toolbar';
  toolbar.innerHTML = `
    <div class="list-search">
      <span class="list-search-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input type="search" placeholder="${escapeHtml(searchPlaceholder)}" data-search>
    </div>
    ${filters.map(f => `
      <button type="button" class="list-filter-btn" data-filter="${f.id}">${escapeHtml(f.label)}</button>
    `).join('')}
  `;

  /* === Bulk-панель === */
  const bulk = document.createElement('div');
  bulk.className = 'bulk-panel';
  bulk.innerHTML = `
    <span class="bulk-count" data-bulk-count>0 выбрано</span>
    <div class="bulk-actions">
      <button type="button" class="btn btn-ghost" data-bulk-clear>Отмена</button>
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

  /* === Фильтрация === */
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

  /* === Привязка чекбоксов и подсветки === */
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

    /* Убираем из selected те, что пропали из фильтра/страницы */
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

  /* === Полный ре-рендер === */
  function rerender() {
    const all = getAllItems();
    const filtered = applyFilters(all);
    renderList(filtered);
    bindCheckboxes();
  }

  /* === События === */
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

/* ============================================================
   Хелпер для рендера «Ничего не найдено»
   ============================================================ */
export function noResultsHTML() {
  return `<div class="list-no-results">Ничего не найдено</div>`;
}