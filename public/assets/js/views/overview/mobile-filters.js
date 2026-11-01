// public/assets/js/views/overview/mobile-filters.js

/**
 * Один глобальный обработчик «клик вне» для всех мобильных фильтров.
 * Устанавливается один раз за жизнь модуля.
 */
let _outsideHandlerInstalled = false;

function installOutsideClickHandler() {
  if (_outsideHandlerInstalled) return;
  _outsideHandlerInstalled = true;

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.chart-filters-wrap.is-open').forEach((w) => {
      if (!w.contains(e.target)) w.classList.remove('is-open');
    });
  });
}

/**
 * Оборачивает .chart-filters в .chart-filters-wrap с мобильным toggle.
 * На десктопе toggle скрыт (display: none), фильтры работают как раньше.
 * На мобильных (<640px) фильтры сворачиваются в выпадающий список.
 *
 * Вызывается после каждого рендера разметки (idempotent — повторный
 * обёртывание не делается благодаря проверке parentElement).
 */
function makeCollapsibleFilters(filtersEl) {
  if (!filtersEl) return;
  if (filtersEl.parentElement?.classList.contains('chart-filters-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'chart-filters-wrap';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'chart-filters-mobile-toggle';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.innerHTML = `
    <i class="fa-solid fa-filter"></i>
    <span class="chart-filters-mobile-label"></span>
    <i class="fa-solid fa-chevron-down chart-filters-mobile-arrow"></i>
  `;

  const labelEl = toggle.querySelector('.chart-filters-mobile-label');

  const updateLabel = () => {
    const active = filtersEl.querySelector('.chart-filter.active');
    labelEl.textContent = active?.textContent?.trim() || 'Фильтр';
  };
  updateLabel();

  filtersEl.parentNode.insertBefore(wrap, filtersEl);
  wrap.appendChild(toggle);
  wrap.appendChild(filtersEl);

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    wrap.classList.toggle('is-open');
  });

  // Клик по фильтру — закрываем и обновляем лейбл.
  // setTimeout(0) — даём синхронным обработчикам фильтров поменять .active.
  filtersEl.addEventListener('click', () => {
    setTimeout(() => {
      updateLabel();
      wrap.classList.remove('is-open');
    }, 0);
  });

  installOutsideClickHandler();
}

/**
 * Точка входа: вызывается из index.js после рендера разметки.
 * Оборачивает каждый .chart-filters на странице.
 */
export function setupMobileFilters(view) {
  view.container.querySelectorAll('.chart-filters').forEach((filtersEl) => {
    makeCollapsibleFilters(filtersEl);
  });
}