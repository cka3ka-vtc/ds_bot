// public/assets/js/views/overview/chart.js
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const WEEKDAYS_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function sum(arr) { return (arr || []).reduce((s, x) => s + (x.count || 0), 0); }

export function hasAnyActivity(d) {
  const c = d?.chart || {};
  return sum(c.messagesByDay) + sum(c.commandsByDay) + sum(c.voiceByDay) > 0;
}

export function renderChartSection(d, filter) {
  if (!hasAnyActivity(d)) {
    return `
      <div class="card">
        <div class="card-head">
          <div>
            <span class="card-title">${UI.overview.chart.title}</span>
            <span class="card-sub">${UI.overview.chart.subtitle}</span>
          </div>
        </div>
        <div class="chart-wrap">
          <div class="empty-state" style="padding:32px 16px;">
            <i class="fa-solid fa-chart-line"></i>
            <strong>${UI.overview.chart.emptyTitle}</strong>
            <span>${UI.overview.chart.emptyHint}</span>
          </div>
        </div>
      </div>`;
  }

  const activeAll = filter === 'all' ? 'active' : '';
  const activeMsg = filter === 'messages' ? 'active' : '';
  const activeCmd = filter === 'commands' ? 'active' : '';
  const activeVoice = filter === 'voice' ? 'active' : '';
  const hideLegend = filter !== 'all';

  return `
    <div class="card">
      <div class="card-head">
        <div>
          <span class="card-title">${UI.overview.chart.title}</span>
          <span class="card-sub">${UI.overview.chart.subtitle}</span>
        </div>
        <div class="chart-filters" role="tablist">
          <button class="chart-filter ${activeAll}" data-filter="all">${UI.overview.chart.filterAll}</button>
          <button class="chart-filter ${activeMsg}" data-filter="messages">${UI.overview.chart.filterMessages}</button>
          <button class="chart-filter ${activeCmd}" data-filter="commands">${UI.overview.chart.filterCommands}</button>
          <button class="chart-filter ${activeVoice}" data-filter="voice">${UI.overview.chart.filterVoice}</button>
        </div>
      </div>
      <div class="chart-wrap">
        ${hideLegend ? '' : `
          <div class="chart-legend">
            <span><span class="dot blue"></span> ${UI.overview.chart.legendMessages}</span>
            <span><span class="dot purple"></span> ${UI.overview.chart.legendCommands}</span>
            <span><span class="dot pink"></span> ${UI.overview.chart.legendVoice}</span>
          </div>
        `}
        <div class="chart" id="activityChart"></div>
      </div>
    </div>`;
}

export function renderChart(view, container) {
  const chartEl = container.querySelector('#activityChart');
  if (!chartEl) return;

  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - i);
    days.push({
      key: toYmd(dt),
      dayLabel: `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`,
      tooltipLabel: `${WEEKDAYS_RU[dt.getDay()]}, ${dt.getDate()} ${MONTHS_FULL[dt.getMonth()]}`,
    });
  }

  const mapByDay = (arr) => Object.fromEntries((arr || []).map((x) => [x.day, x.count]));
  const messages = mapByDay(view.data.chart.messagesByDay);
  const commands = mapByDay(view.data.chart.commandsByDay);
  const voice = mapByDay(view.data.chart.voiceByDay);

  const values = days.map((d) => ({
    dayLabel: d.dayLabel,
    tooltipLabel: d.tooltipLabel,
    messages: messages[d.key] || 0,
    commands: commands[d.key] || 0,
    voice: voice[d.key] || 0,
  }));

  const filter = view.chartFilter;
  let max = 1;
  values.forEach((v) => {
    const s = filter === 'all' ? v.messages + v.commands + v.voice : v[filter];
    if (s > max) max = s;
  });

  chartEl.innerHTML = values.map((v) => {
    const total = v.messages + v.commands + v.voice;
    const emptyClass = total === 0 ? ' is-empty' : '';
    const common = `data-msg="${v.messages}" data-cmd="${v.commands}" data-voice="${v.voice}" data-date="${escapeHtml(v.tooltipLabel)}"`;

    if (filter === 'all') {
      const m = ((v.messages / max) * 100).toFixed(2);
      const c = ((v.commands / max) * 100).toFixed(2);
      const vo = ((v.voice / max) * 100).toFixed(2);
      return `<div class="chart-col${emptyClass}" ${common}>
        <div class="chart-stack">
          <div class="chart-seg messages" data-h="${m}%"></div>
          <div class="chart-seg commands" data-h="${c}%"></div>
          <div class="chart-seg voice" data-h="${vo}%"></div>
        </div>
        <div class="chart-label">${v.dayLabel}</div>
      </div>`;
    }
    const h = ((v[filter] / max) * 100).toFixed(2);
    return `<div class="chart-col${emptyClass}" ${common}>
      <div class="chart-bar" data-h="${h}%"></div>
      <div class="chart-label">${v.dayLabel}</div>
    </div>`;
  }).join('');

  requestAnimationFrame(() => {
    chartEl.querySelectorAll('.chart-seg, .chart-bar').forEach((el) => { el.style.height = el.dataset.h; });
  });

  if (!view._tooltipEl) {
    view._tooltipEl = document.createElement('div');
    view._tooltipEl.className = 'chart-tooltip';
    document.body.appendChild(view._tooltipEl);
  }
  chartEl.querySelectorAll('.chart-col').forEach((col) => {
    const m = parseInt(col.dataset.msg, 10) || 0;
    const c = parseInt(col.dataset.cmd, 10) || 0;
    const v = parseInt(col.dataset.voice, 10) || 0;
    if (m + c + v === 0) return;
    col.addEventListener('mouseenter', () => showTip(view, col));
    col.addEventListener('mouseleave', () => hideTip(view));
  });
}

function showTip(view, col) {
  const tip = view._tooltipEl;
  if (!tip) return;
  const filter = view.chartFilter;
  const m = parseInt(col.dataset.msg, 10) || 0;
  const c = parseInt(col.dataset.cmd, 10) || 0;
  const v = parseInt(col.dataset.voice, 10) || 0;

  let html = `<div class="chart-tooltip-title">${escapeHtml(col.dataset.date)}</div>`;
  const rows = [];
  if (filter === 'all' || filter === 'messages') rows.push({ cls: 'blue', label: UI.overview.tooltip.messages, val: m });
  if (filter === 'all' || filter === 'commands') rows.push({ cls: 'purple', label: UI.overview.tooltip.commands, val: c });
  if (filter === 'all' || filter === 'voice') rows.push({ cls: 'pink', label: UI.overview.tooltip.voice, val: v });
  html += rows.map((r) => `<div class="chart-tooltip-row">
    <span class="chart-tooltip-dot ${r.cls}"></span> ${r.label}
    <span class="chart-tooltip-val">${r.val}</span>
  </div>`).join('');

  tip.innerHTML = html;
  const rect = col.getBoundingClientRect();
  tip.style.left = (rect.left + rect.width / 2) + 'px';
  tip.style.top = rect.top + 'px';
  tip.classList.add('show');
}

function hideTip(view) {
  if (view._tooltipEl) view._tooltipEl.classList.remove('show');
}

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}