// public/assets/js/views/overview.js
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { escapeHtml, fmtNum, fmtUptime, timeAgo } from '../core/utils.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export default {
  container: null,
  data: null,
  chartFilter: 'all',
  _tooltipEl: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');

    if (!botId || !guildId) {
      return this._empty(container, 'Выберите сервер', 'Сначала выберите сервер в сайдбаре');
    }

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    try {
      this.data = await api.get(`/api/stats?botId=${botId}&guildId=${guildId}`);
    } catch (err) {
      if (err.data?.error === 'bot_offline') {
        return this._empty(container, 'Бот офлайн', 'Запустите бота или выберите другого');
      }
      return this._empty(container, 'Не удалось загрузить статистику', err.message);
    }

    this._renderUI();
  },

  destroy() {
    if (this._tooltipEl) {
      this._tooltipEl.remove();
      this._tooltipEl = null;
    }
  },

  async _refresh() {
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return;
    try {
      this.data = await api.get(`/api/stats?botId=${botId}&guildId=${guildId}`);
      this._renderUI();
    } catch {}
  },

  _hasAnyActivity() {
    const c = this.data?.chart || {};
    const sum = (arr) => (arr || []).reduce((s, x) => s + (x.count || 0), 0);
    return sum(c.messagesByDay) + sum(c.commandsByDay) + sum(c.voiceByDay) > 0;
  },

  _renderUI() {
    const d = this.data;
    const guild = store.get('guilds').find((g) => g.id === store.get('activeGuildId'));
    const bot = store.get('bots').find((b) => b.id === store.get('activeBotId'));
    const hasActivity = this._hasAnyActivity();

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Обзор сервера</h1>
          <p>${escapeHtml(bot?.name || '')} · ${escapeHtml(guild?.name || '')}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-ghost" data-refresh>
            <i class="fa-solid fa-rotate"></i> Обновить
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        ${this._kpi('Всего участников', fmtNum(d.totalMembers), 'fa-users', 'blue',
          'Общее число участников на сервере сейчас.')}
        ${this._kpi('Новые', `+${d.newMembers}`, 'fa-user-plus', 'green',
          'Присоединилось за последние 7 дней.')}
        ${this._kpi('Покинули', `${d.leftMembers}`, 'fa-user-minus', 'red',
          'Покинуло за последние 7 дней.')}
        ${this._kpi('Активные', fmtNum(d.activeUsers), 'fa-bolt', 'orange',
          'Уникальные авторы сообщений/команд за 7 дней.')}
      </div>

      <div class="overview-grid">
        <div class="card">
          <div class="card-head">
            <div>
              <span class="card-title">Активность</span>
              <span class="card-sub">за 14 дней</span>
            </div>
            ${hasActivity ? `
              <div class="chart-filters" role="tablist">
                <button class="chart-filter active" data-filter="all">Всё</button>
                <button class="chart-filter" data-filter="messages">Сообщения</button>
                <button class="chart-filter" data-filter="commands">Команды</button>
                <button class="chart-filter" data-filter="voice">Голос</button>
              </div>
            ` : ''}
          </div>
          <div class="chart-wrap">
            ${hasActivity ? `
              <div class="chart-legend" id="chartLegend">
                <span><span class="dot blue"></span> Сообщения</span>
                <span><span class="dot purple"></span> Команды</span>
                <span><span class="dot pink"></span> Голос</span>
              </div>
              <div class="chart" id="activityChart"></div>
            ` : `
              <div class="empty-state" style="padding:32px 16px;">
                <i class="fa-solid fa-chart-line"></i>
                <strong>Пока нет данных</strong>
                <span>Активность появится, когда участники начнут писать сообщения и использовать команды</span>
              </div>
            `}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div>
              <span class="card-title">Топ команд</span>
              <span class="card-sub">за 7 дней</span>
            </div>
            <a href="#commands" class="btn-link" data-nav="commands">
              Все <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
          <div class="card-body" style="padding:12px;">
            ${this._renderTopCommands(d.topCommands)}
          </div>
        </div>
      </div>

      <div class="overview-grid">
        <div class="card">
          <div class="card-head">
            <div><span class="card-title">Последние события</span></div>
            <a href="#moderation" class="btn-link" data-nav="moderation">
              Все <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
          <div class="card-body" style="padding:8px;">
            ${this._renderRecentEvents(d.recentEvents)}
          </div>
        </div>

        <div class="card">
          <div class="card-head">
            <div><span class="card-title">Здоровье сервера</span></div>
          </div>
          <div class="card-body" style="padding:8px 18px;">
            ${this._healthRow('Задержка API', 'good', Math.max(5, 100 - d.health.latency), `${d.health.latency} ms`)}
            ${this._healthRow('Аптайм', 'good', 100, fmtUptime(d.health.uptimeSeconds))}
            ${this._healthRow(
              'Ошибки',
              d.health.errors24h > 5 ? 'warn' : 'good',
              Math.max(2, 100 - d.health.errors24h * 5),
              `${d.health.errors24h} / 24ч`,
            )}
            ${this._healthRow(
              'Память',
              d.health.memoryPct > 80 ? 'warn' : 'good',
              d.health.memoryPct,
              `${d.health.memoryPct}% · ${d.health.memoryUsedMB}/${d.health.memoryTotalMB} MB`,
            )}
            ${this._healthRow(
              'Discord API',
              d.health.discordApiPct > 90 ? 'good' : 'warn',
              d.health.discordApiPct,
              `${d.health.discordApiPct}%`,
            )}
            ${this._healthRow(
              'Rate Limit Hits',
              d.health.rateLimitHits > 0 ? 'warn' : 'good',
              d.health.rateLimitHits > 0 ? Math.max(10, 100 - d.health.rateLimitHits * 5) : 100,
              `${d.health.rateLimitHits}`,
            )}
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('[data-refresh]').addEventListener('click', async () => {
      await this._refresh();
      toast('Обновлено', 'success');
    });
    this.container.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        location.hash = el.dataset.nav;
      });
    });
    this.container.querySelectorAll('.chart-filter').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.chart-filter').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.chartFilter = btn.dataset.filter;
        this._renderChart();
      });
    });

    if (hasActivity) this._renderChart();
    this._animateHealth();
  },

  _kpi(label, value, icon, color, tooltip) {
    return `
      <div class="kpi-card">
        <div class="kpi-head">
          <div class="kpi-label-group">
            <span class="kpi-label">${label}</span>
            <button class="kpi-hint" type="button" data-tooltip="${escapeHtml(tooltip)}">?</button>
          </div>
          <span class="kpi-icon ${color}"><i class="fa-solid ${icon}"></i></span>
        </div>
        <div class="kpi-value">${value}</div>
      </div>`;
  },

  _renderTopCommands(commands) {
    if (!commands || !commands.length) {
      return `<div class="empty-state" style="padding:32px 16px;">
                <i class="fa-solid fa-terminal"></i>
                <strong>Пока нет данных</strong>
                <span>Команды появятся здесь, когда их начнут использовать</span>
              </div>`;
    }
    return `<div class="top-list">
      ${commands.map((c, i) => {
        const rankClass = ['gold', 'silver', 'bronze'][i] || '';
        const name = c.cmd || 'неизвестно';
        return `
          <div class="top-item">
            <span class="top-rank ${rankClass}">${i + 1}</span>
            <span class="top-cmd">/${escapeHtml(name)}</span>
            <span class="top-count">${fmtNum(c.count)}</span>
          </div>`;
      }).join('')}
    </div>`;
  },

  _renderRecentEvents(events) {
    if (!events || !events.length) {
      return `<div class="empty-state" style="padding:32px 16px;">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <strong>Пока нет событий</strong>
                <span>Здесь появятся действия модерации и логи</span>
              </div>`;
    }
    return `<div class="activity-list">
      ${events.map((e) => {
        const color = {
          warn: 'orange', mute: 'blue', ban: 'red',
          moderation: 'red', greetings: 'green',
        }[e.type] || 'blue';
        const text = e.source === 'mod'
          ? `<strong>&lt;@${escapeHtml(e.user_id || '?')}&gt;</strong> — ${escapeHtml(e.type)}${e.message ? ': ' + escapeHtml(e.message) : ''}`
          : escapeHtml(e.message || '');
        return `
          <div class="activity-item">
            <span class="activity-dot ${color}"></span>
            <div class="activity-body">
              <div class="activity-text">${text}</div>
              <div class="activity-time">${timeAgo(e.created_at)}</div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
  },

  _healthRow(label, status, width, value) {
    return `
      <div class="health-row">
        <span class="health-label">${label}</span>
        <div class="health-bar"><span class="${status}" data-width="${Math.min(100, Math.max(0, width))}%"></span></div>
        <span class="health-value">${value}</span>
      </div>`;
  },

  _renderChart() {
    const chartEl = this.container?.querySelector('#activityChart');
    if (!chartEl) return;

    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - i);
      const key = toYmd(dt);
      days.push({
        key,
        dayLabel: String(dt.getDate()),
        tooltipLabel: `${WEEKDAYS_RU[dt.getDay()]}, ${dt.getDate()} ${MONTHS_RU[dt.getMonth()]}`,
      });
    }

    const mapByDay = (arr) => Object.fromEntries((arr || []).map((x) => [x.day, x.count]));
    const messages = mapByDay(this.data.chart.messagesByDay);
    const commands = mapByDay(this.data.chart.commandsByDay);
    const voice    = mapByDay(this.data.chart.voiceByDay);

    const values = days.map((d) => ({
      dayLabel: d.dayLabel,
      tooltipLabel: d.tooltipLabel,
      messages: messages[d.key] || 0,
      commands: commands[d.key] || 0,
      voice: voice[d.key] || 0,
    }));

    const filter = this.chartFilter;
    let max = 1;
    if (filter === 'all') {
      values.forEach((v) => { const s = v.messages + v.commands + v.voice; if (s > max) max = s; });
    } else {
      values.forEach((v) => { if (v[filter] > max) max = v[filter]; });
    }

    let html = '';
    values.forEach((v) => {
      const total = v.messages + v.commands + v.voice;
      const isEmpty = total === 0;
      const emptyClass = isEmpty ? ' is-empty' : '';

      if (filter === 'all') {
        const m = ((v.messages / max) * 100).toFixed(2);
        const c = ((v.commands / max) * 100).toFixed(2);
        const vo = ((v.voice / max) * 100).toFixed(2);
        html += `
          <div class="chart-col${emptyClass}"
               data-msg="${v.messages}"
               data-cmd="${v.commands}"
               data-voice="${v.voice}"
               data-date="${escapeHtml(v.tooltipLabel)}">
            <div class="chart-stack">
              <div class="chart-seg messages" data-h="${m}%"></div>
              <div class="chart-seg commands" data-h="${c}%"></div>
              <div class="chart-seg voice" data-h="${vo}%"></div>
            </div>
            <div class="chart-label">${v.dayLabel}</div>
          </div>`;
      } else {
        const h = ((v[filter] / max) * 100).toFixed(2);
        html += `
          <div class="chart-col${emptyClass}"
               data-msg="${v.messages}"
               data-cmd="${v.commands}"
               data-voice="${v.voice}"
               data-date="${escapeHtml(v.tooltipLabel)}">
            <div class="chart-bar" data-h="${h}%"></div>
            <div class="chart-label">${v.dayLabel}</div>
          </div>`;
      }
    });

    chartEl.innerHTML = html;
    requestAnimationFrame(() => {
      chartEl.querySelectorAll('.chart-seg, .chart-bar').forEach((el) => {
        el.style.height = el.dataset.h;
      });
    });

    if (!this._tooltipEl) {
      this._tooltipEl = document.createElement('div');
      this._tooltipEl.className = 'chart-tooltip';
      document.body.appendChild(this._tooltipEl);
    }

    // ⚡ ФИКС #1: пустым колонкам НЕ вешаем обработчик
    chartEl.querySelectorAll('.chart-col').forEach((col) => {
      const m = parseInt(col.dataset.msg, 10) || 0;
      const c = parseInt(col.dataset.cmd, 10) || 0;
      const v = parseInt(col.dataset.voice, 10) || 0;
      if (m + c + v === 0) return;

      col.addEventListener('mouseenter', () => this._showChartTooltip(col));
      col.addEventListener('mouseleave', () => this._hideChartTooltip());
    });
  },

  _showChartTooltip(col) {
    if (!this._tooltipEl) return;
    const filter = this.chartFilter;
    const m = parseInt(col.dataset.msg, 10) || 0;
    const c = parseInt(col.dataset.cmd, 10) || 0;
    const v = parseInt(col.dataset.voice, 10) || 0;

    let html = `<div class="chart-tooltip-title">${escapeHtml(col.dataset.date)}</div>`;
    if (filter === 'all' || filter === 'messages') {
      html += `<div class="chart-tooltip-row">
                 <span class="chart-tooltip-dot blue"></span> Сообщения
                 <span class="chart-tooltip-val">${m}</span>
               </div>`;
    }
    if (filter === 'all' || filter === 'commands') {
      html += `<div class="chart-tooltip-row">
                 <span class="chart-tooltip-dot purple"></span> Команды
                 <span class="chart-tooltip-val">${c}</span>
               </div>`;
    }
    if (filter === 'all' || filter === 'voice') {
      html += `<div class="chart-tooltip-row">
                 <span class="chart-tooltip-dot pink"></span> Голос
                 <span class="chart-tooltip-val">${v}</span>
               </div>`;
    }

    this._tooltipEl.innerHTML = html;

    const rect = col.getBoundingClientRect();
    this._tooltipEl.style.left = (rect.left + rect.width / 2) + 'px';
    this._tooltipEl.style.top = rect.top + 'px';
    this._tooltipEl.classList.add('show');
  },

  _hideChartTooltip() {
    if (this._tooltipEl) this._tooltipEl.classList.remove('show');
  },

  _animateHealth() {
    document.querySelectorAll('.health-bar span').forEach((s) => {
      const w = s.dataset.width;
      s.style.width = '0%';
      if (reducedMotion) { s.style.width = w; return; }
      setTimeout(() => { s.style.width = w; }, 150);
    });
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

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}