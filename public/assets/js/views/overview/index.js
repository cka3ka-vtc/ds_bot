// public/assets/js/views/overview/index.js
import { store } from '../../core/store.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { escapeHtml } from '../../core/utils.js';
import { renderKpiGrid, animateKpiCounters } from './kpi.js';
import { renderChartSection, renderChart, hasAnyActivity } from './chart.js';
import { renderTopCommands, renderTopChannels, renderRecentEvents } from './lists.js';
import { openJoinedModal, openLeftModal, openActiveModal } from './userModals.js';

export default {
  container: null,
  data: null,
  chartFilter: 'all',
  channelFilter: 'text',
  _tooltipEl: null,
  _onScroll: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');

    if (!botId || !guildId) {
      return this._empty(container, 'Выберите сервер', 'Сначала выберите сервер в сайдбаре');
    }

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    try {
      this.data = await this._fetch(botId, guildId);
    } catch (err) {
      if (err.data?.error === 'bot_offline') {
        return this._empty(container, 'Бот офлайн', 'Дождитесь запуска бота или выберите другого');
      }
      return this._empty(container, 'Не удалось загрузить статистику', err.message);
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

  _renderUI() {
    const d = this.data;
    const hasActivity = hasAnyActivity(d);
    const cf = this.channelFilter;
    const hasChannelStats = (d.topChannels?.text?.length || 0) + (d.topChannels?.voice?.length || 0) > 0;

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Дашборд</h1>
          <p>Ключевые метрики сервера, топ команд и последние события</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost" data-refresh>
            <i class="fa-solid fa-rotate"></i> Обновить
          </button>
        </div>
      </div>

      ${renderKpiGrid(d)}

      <div class="overview-grid">
        ${renderChartSection(d, this.chartFilter)}
        <div class="card">
          <div class="card-head">
            <div>
              <div class="kpi-label-group">
                <span class="card-title">Топ команд</span>
                <button class="kpi-hint" type="button"
                        data-tooltip="Суммарное количество использований каждой команды.">?</button>
              </div>
              <span class="card-sub">за 7 дней</span>
            </div>
          </div>
          <div class="card-body" style="padding:12px;">
            ${renderTopCommands(d.topCommands)}
          </div>
        </div>
      </div>

      <div class="overview-grid channels-events">
        <div class="card">
          <div class="card-head">
            <div><span class="card-title">Последние события</span></div>
            <a href="#moderation" class="btn-link" data-nav="moderation">Все <i class="fa-solid fa-arrow-right"></i></a>
          </div>
          <div class="card-body" style="padding:8px;">
            ${renderRecentEvents(d.recentEvents)}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <div class="kpi-label-group">
                <span class="card-title">Популярные каналы</span>
                <button class="kpi-hint" type="button"
                        data-tooltip="Количество уникальных пользователей, активных в канале.">?</button>
              </div>
              <span class="card-sub">за 7 дней</span>
            </div>
            ${hasChannelStats ? `
              <div class="chart-filters" role="tablist">
                <button class="chart-filter ${cf === 'text' ? 'active' : ''}" data-channel-filter="text">Текстовые</button>
                <button class="chart-filter ${cf === 'voice' ? 'active' : ''}" data-channel-filter="voice">Голосовые</button>
              </div>
            ` : ''}
          </div>
          <div class="card-body" style="padding:12px;" id="topChannelsBody">
            <div data-channel-list="text" ${cf !== 'text' ? 'hidden' : ''}>
              ${renderTopChannels(d.topChannels.text, 'text')}
            </div>
            <div data-channel-list="voice" ${cf !== 'voice' ? 'hidden' : ''}>
              ${renderTopChannels(d.topChannels.voice, 'voice')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('[data-refresh]').addEventListener('click', async () => {
      try {
        this.data = await this._fetch(store.get('activeBotId'), store.get('activeGuildId'));
        this._renderUI();
        toast('Обновлено', 'success');
      } catch {}
    });

    this.container.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); location.hash = el.dataset.nav; });
    });

    this.container.querySelectorAll('.chart-filter[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.chart-filter[data-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartFilter = btn.dataset.filter;
        renderChart(this, this.container);
      });
    });

    this.container.querySelectorAll('[data-channel-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('[data-channel-filter]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.channelFilter = btn.dataset.channelFilter;
        this.container.querySelectorAll('[data-channel-list]').forEach((el) => {
          el.hidden = el.dataset.channelList !== this.channelFilter;
        });
      });
    });

    // ── Клики по кликабельным KPI-карточкам ──
    // data-kpi-action → модалка; data-kpi-nav → переход в раздел.
    this.container.querySelectorAll('[data-kpi-action], [data-kpi-nav]').forEach((card) => {
      const action = card.dataset.kpiAction;
      const nav = card.dataset.kpiNav;
      const run = () => {
        if (action === 'joined') openJoinedModal();
        else if (action === 'left') openLeftModal();
        else if (action === 'active') openActiveModal();
        else if (nav) location.hash = nav;
      };
      card.addEventListener('click', (e) => {
        // Клик по подсказке — только тултип, карточку не открываем
        if (e.target.closest('.kpi-hint')) return;
        run();
      });
      card.addEventListener('keydown', (e) => {
        if (e.target !== card) return;   // Enter/Space на вложенной кнопке-подсказке не перехватываем
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          run();
        }
      });
    });

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