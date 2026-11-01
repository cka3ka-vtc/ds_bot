// public/assets/js/views/overview/filters.js
import { UI } from '/shared/ui-strings.js';
import { renderChart } from './chart.js';
import { renderRecentEventsBody, filterEvents } from './lists.js';

const EVENT_FILTERS = [
  { key: 'all',        label: 'Все' },
  { key: 'commands',   label: 'Команды' },
  { key: 'levels',     label: 'Уровни' },
  { key: 'members',    label: 'Участники' },
  { key: 'moderation', label: 'Модерация' },
  { key: 'birthdays',  label: 'Дни рождения' },
];

const EVENTS_LIMIT = 5;

/**
 * HTML фильтров «Последних событий».
 * Рендерится в layout.js в card-head карточки событий.
 */
export function renderEventsFilters(view) {
  return `<div class="chart-filters" role="tablist">
    ${EVENT_FILTERS.map((f) => `
      <button class="chart-filter ${view.eventFilter === f.key ? 'active' : ''}"
              data-event-filter="${f.key}">${f.label}</button>
    `).join('')}
  </div>`;
}

/**
 * HTML списка «Последних событий» (уже отфильтрованного и обрезанного до 5).
 * При смене фильтра вызывается заново и заменяет содержимое #eventsBody.
 */
export function renderEventsBody(view) {
  const d = view.data;
  const filtered = filterEvents(d.recentEvents, view.eventFilter).slice(0, EVENTS_LIMIT);

  const opts = view.eventFilter === 'all'
    ? {}
    : {
        emptyTitle: 'Нет событий этого типа',
        emptyHint: 'Попробуйте выбрать другой фильтр или подождите новых событий',
      };

  return renderRecentEventsBody(filtered, opts);
}

/**
 * Фильтр графика «Активность» (Все/Сообщения/Команды/Голос).
 * При смене — перерисовывается только график, не вся страница.
 */
export function bindChartFilters(view) {
  view.container.querySelectorAll('.chart-filter[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.container.querySelectorAll('.chart-filter[data-filter]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      view.chartFilter = btn.dataset.filter;
      renderChart(view, view.container);
    });
  });
}

/**
 * Фильтр каналов (Текстовые/Голосовые) в блоке «Популярные каналы».
 * Скрывает/показывает data-channel-list.
 */
export function bindChannelFilters(view) {
  view.container.querySelectorAll('[data-channel-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.container.querySelectorAll('[data-channel-filter]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      view.channelFilter = btn.dataset.channelFilter;

      view.container.querySelectorAll('[data-channel-list]').forEach((el) => {
        el.hidden = el.dataset.channelList !== view.channelFilter;
      });
    });
  });
}

/**
 * Фильтр «Последних событий» (Все/Команды/Уровни/...).
 * При смене — перерисовывается только #eventsBody.
 */
export function bindEventFilters(view) {
  view.container.querySelectorAll('.chart-filter[data-event-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      view.container.querySelectorAll('.chart-filter[data-event-filter]')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      view.eventFilter = btn.dataset.eventFilter;

      const body = view.container.querySelector('#eventsBody');
      if (body) body.innerHTML = renderEventsBody(view);
    });
  });
}