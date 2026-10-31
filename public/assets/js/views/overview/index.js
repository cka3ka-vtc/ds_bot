// public/assets/js/views/overview/index.js
import { store } from '../../core/store.js';
import { api } from '../../core/api.js';
import { UI } from '/shared/ui-strings.js';
import { renderChart, hasAnyActivity } from './chart.js';
import { animateKpiCounters } from './kpi.js';

import { renderLayout } from './layout.js';
import {
  renderEventsFilters,
  renderEventsBody,
  bindChartFilters,
  bindChannelFilters,
  bindEventFilters,
} from './filters.js';
import { setupMobileFilters } from './mobile-filters.js';
import { bindRefresh, bindNavLinks, bindKpiCards } from './kpi-bind.js';

/**
 * Дашборд overview.
 *  - render: fetch + _renderUI.
 *  - _renderUI: собирает HTML через layout.js, вешает все обработчики.
 *
 *  Состояние фильтров хранится на объекте view и передаётся в layout/filters
 *  при каждом перерисовывании. При изменении фильтров вызывается
 *  частичный ре-рендер (только затронутая зона), без перезагрузки данных.
 */
export default {
  container: null,
  data: null,
  chartFilter: 'all',
  channelFilter: 'text',
  eventFilter: 'all',
  _tooltipEl: null,
  _onScroll: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');

    if (!botId || !guildId) {
      return this._empty(container, UI.common.selectServer, UI.common.selectServerHint);
    }

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    try {
      this.data = await this._fetch(botId, guildId);
    } catch (err) {
      if (err.data?.error === 'bot_offline') {
        return this._empty(container, UI.common.botOffline, UI.common.botOfflineHint);
      }
      return this._empty(container, UI.common.errorLoad, err.message);
    }

    this._renderUI();
    this._bindScrollClose();
  },

  async _fetch(botId, guildId) {
    const tz = -new Date().getTimezoneOffset();
    return api.get(`/api/stats?botId=${botId}&guildId=${guildId}&tz=${tz}`);
  },

  destroy() {
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
    if (this._onScroll) { window.removeEventListener('scroll', this._onScroll); this._onScroll = null; }
  },

  _bindScrollClose() {
    if (this._onScroll) return;
    this._onScroll = () => {
      if (this._tooltipEl) this._tooltipEl.classList.remove('show');
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
  },

  /**
   * Полный ре-рендер страницы. Также вызывается из bindRefresh после
   * повторного fetch'а. При смене фильтра — не перерисовываем всё,
   * а точечно (см. bindChartFilters / bindChannelFilters / bindEventFilters).
   */
  _renderUI() {
    const d = this.data;
    const hasActivity = hasAnyActivity(d);

    this.container.innerHTML = renderLayout(this, {
      eventsFiltersHTML: renderEventsFilters(this),
      eventsBodyHTML: renderEventsBody(this),
    });

    // ─── Мобильные обёртки фильтров (после рендера HTML) ───
    setupMobileFilters(this);

    // ─── Привязки ───
    bindRefresh(this);
    bindNavLinks(this);
    bindChartFilters(this);
    bindChannelFilters(this);
    bindEventFilters(this);
    bindKpiCards(this);

    animateKpiCounters(this.container);

    if (hasActivity) renderChart(this, this.container);
  },

  _empty(container, title, text) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-chart-pie"></i>
        <strong>${title}</strong>
        <span>${text}</span>
      </div>`;
  },
};