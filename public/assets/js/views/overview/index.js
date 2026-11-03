// public/assets/js/views/overview/index.js
import { store } from '../../core/store.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { UI } from '/shared/ui-strings.js';
import { renderChart, hasAnyActivity } from './chart.js';
import { animateKpiCounters } from './kpi.js';
import { renderUpcomingBirthdays, renderTopCommands } from './lists.js';

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

const AUTO_REFRESH_MS = 30_000;

export default {
  container: null,
  data: null,
  chartFilter: 'all',
  channelFilter: 'text',
  eventFilter: 'all',
  _tooltipEl: null,
  _onScroll: null,
  _refreshTimer: null,

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
    this._startAutoRefresh();
  },

  async _fetch(botId, guildId) {
    const tz = -new Date().getTimezoneOffset();
    return api.get(`/api/stats?botId=${botId}&guildId=${guildId}&tz=${tz}`);
  },

  /* ─── Авто-обновление ─── */

  _startAutoRefresh() {
    this._stopAutoRefresh();
    this._refreshTimer = setInterval(() => {
      // Не дёргаем сервер, когда вкладка неактивна
      if (document.hidden) return;
      this._autoRefresh(true).catch(() => {});
    }, AUTO_REFRESH_MS);
  },

  _stopAutoRefresh() {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  },

  /**
   * Точечное обновление данных. Не перерисовывает всю страницу:
   *   - KPI значения (все 4)
   *   - Список событий
   *   - Блок ДР
   *   - Топ-команды
   * Top-каналы не трогаем — там переключение text/voice, сложнее без перерисовки.
   * Chart не трогаем — там свой фильтр и анимация.
   *
   * @param {boolean} silent — если true, не показывать тост «Обновлено».
   */
  async _autoRefresh(silent = true) {
    if (!this.container || !document.body.contains(this.container)) return;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return;

    try {
      const data = await this._fetch(botId, guildId);
      this.data = data;
      this._updateKpiValues();
      this._updateEvents();
      this._updateBirthdays();
      this._updateTopCommands();
      if (!silent) toast(UI.common.updated, 'success');
    } catch (err) {
      if (!silent) throw err;
      // silent: тихо проглатываем (например, bot_offline — покажется при ручном клике)
    }
  },

  _updateKpiValues() {
    this.container.querySelectorAll('.kpi-value[data-count-key]').forEach((el) => {
      const v = Number(this.data[el.dataset.countKey]) || 0;
      el.textContent = v.toLocaleString('ru-RU');
      el.dataset.count = String(v);
    });
  },

  _updateEvents() {
    const el = this.container.querySelector('#eventsBody');
    if (el) el.innerHTML = renderEventsBody(this);
  },

  _updateBirthdays() {
    const el = this.container.querySelector('#birthdaysBody');
    if (el) {
      el.innerHTML = renderUpcomingBirthdays(
        this.data.upcomingBirthdays,
        this.data.modulesEnabled?.birthdays,
      );
    }
  },

  _updateTopCommands() {
    const el = this.container.querySelector('#topCommandsBody');
    if (el) el.innerHTML = renderTopCommands(this.data.topCommands);
  },

  /* ─── Lifecycle ─── */

  _bindScrollClose() {
    if (this._onScroll) return;
    this._onScroll = () => {
      if (this._tooltipEl) this._tooltipEl.classList.remove('show');
    };
    window.addEventListener('scroll', this._onScroll, { passive: true });
  },

  destroy() {
    this._stopAutoRefresh();
    if (this._tooltipEl) { this._tooltipEl.remove(); this._tooltipEl = null; }
    if (this._onScroll) { window.removeEventListener('scroll', this._onScroll); this._onScroll = null; }
    this.container = null;
  },

  _renderUI() {
    const d = this.data;
    const hasActivity = hasAnyActivity(d);

    this.container.innerHTML = renderLayout(this, {
      eventsFiltersHTML: renderEventsFilters(this),
      eventsBodyHTML: renderEventsBody(this),
    });

    setupMobileFilters(this);

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