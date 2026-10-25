/* ============================================================
   Дашборд: чек-лист, компактные stat-карточки, ближайшие ДР,
   последние действия, график активности за 7 дней.
   ============================================================ */

import { state } from '../state.js';
import { escapeHtml, formatNumber, pluralize } from '../utils.js';
import { buildOnboardingChecklist, bindChecklist } from '../onboarding-checklist.js';

/* Сколько ДР показывать в блоке */
const UPCOMING_LIMIT = 8;

/* ============================================================
   Рендер
   ============================================================ */

export function renderDashboard() {
  const root = document.getElementById('view-dashboard');
  if (!root) return;

  const guild = state.guild || {};
  const announcements = state.announcements || [];
  const delayed = state.delayed || [];
  const birthdays = state.birthdays || { users: [] };
  const logs = state.logs || [];

  /* Метрики */
  const activeAnn = announcements.filter(a => a.enabled).length;
  const pendingDelayed = delayed.filter(d => d.publishAt && !d.lastSentAt).length;
  const users = Array.isArray(birthdays.users) ? birthdays.users : [];

  const bdaysUpcoming = users
    .filter(u => u.day && u.month && u.enabled !== false)
    .map(u => ({ ...u, _days: daysUntil(u.day, u.month) }))
    .sort((a, b) => a._days - b._days)
    .slice(0, UPCOMING_LIMIT);

  const upcoming7 = users.filter(u => {
    if (!u.day || !u.month || u.enabled === false) return false;
    return daysUntil(u.day, u.month) <= 7;
  }).length;

  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  root.innerHTML = `
    <div class="dashboard-grid">
      ${buildOnboardingChecklist()}

      <div class="dash-stats">
        <button class="dash-stat" data-goto="dashboard">
          <div class="dash-stat-icon"><i class="fa-solid fa-users"></i></div>
          <div class="dash-stat-body">
            <span class="dash-stat-label">Участники</span>
            <span class="dash-stat-value">${formatNumber(guild.memberCount || 0)}</span>
          </div>
        </button>
        <button class="dash-stat" data-goto="announcements">
          <div class="dash-stat-icon accent"><i class="fa-solid fa-bullhorn"></i></div>
          <div class="dash-stat-body">
            <span class="dash-stat-label">Активных объявлений</span>
            <span class="dash-stat-value">${activeAnn}</span>
          </div>
        </button>
        <button class="dash-stat" data-goto="delayed">
          <div class="dash-stat-icon warning"><i class="fa-solid fa-clock"></i></div>
          <div class="dash-stat-body">
            <span class="dash-stat-label">Отложек в ожидании</span>
            <span class="dash-stat-value">${pendingDelayed}</span>
          </div>
        </button>
        <button class="dash-stat" data-goto="birthdays">
          <div class="dash-stat-icon success"><i class="fa-solid fa-cake-candles"></i></div>
          <div class="dash-stat-body">
            <span class="dash-stat-label">ДР за 7 дней</span>
            <span class="dash-stat-value">${upcoming7}</span>
          </div>
        </button>
      </div>

      <div class="dash-row">
        <div class="dash-card">
          <div class="dash-card-header">
            <h3><i class="fa-solid fa-cake-candles"></i> Ближайшие дни рождения</h3>
            <a href="#" data-goto="birthdays">Все →</a>
          </div>
          <div class="dash-card-body">${renderUpcomingBirthdays(bdaysUpcoming)}</div>
        </div>

        <div class="dash-card">
          <div class="dash-card-header">
            <h3><i class="fa-solid fa-list"></i> Последние действия</h3>
            <a href="#" data-goto="logs">Все →</a>
          </div>
          <div class="dash-card-body">${renderRecentLogs(recentLogs)}</div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-header">
          <h3><i class="fa-solid fa-chart-line"></i> Активность за 7 дней ${renderTodayBadge(logs)}</h3>
        </div>
        <div class="dash-card-body">${renderDetailedChart(logs)}</div>
      </div>
    </div>
  `;

  /* Чек-лист — вешаем обработчики после вставки HTML */
  bindChecklist(root);

  /* Клики по карточкам и «Все →» */
  root.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      const { navigate } = await import('../router.js');
      navigate(state.guildId, el.dataset.goto);
    });
  });
}

/* ============================================================
   Блок «Ближайшие ДР»
   ============================================================ */

function renderUpcomingBirthdays(items) {
  if (!items.length) {
    return `<div class="dash-empty"><i class="fa-solid fa-cake-candles"></i><p>Нет ближайших ДР</p></div>`;
  }

  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  return `<div class="dash-bday-list">${items.map(u => {
    const member = (state.members || []).find(m => m.id === u.userId);
    const name = member?.displayName || member?.username || `ID: ${u.userId}`;
    const initial = name.charAt(0).toUpperCase();
    const avatarInner = member?.avatar ? `<img src="${member.avatar}" alt="">` : initial;

    let badgeClass = '';
    let badgeText = '';
    if (u._days === 0)      { badgeClass = 'today'; badgeText = 'Сегодня'; }
    else if (u._days === 1) { badgeClass = 'soon';  badgeText = 'Завтра'; }
    else if (u._days <= 7)  { badgeClass = 'soon';  badgeText = `${u._days} дн`; }
    else                    {                     badgeText = `${u._days} дн`; }

    return `
      <div class="dash-bday">
        <div class="dash-bday-avatar">${avatarInner}</div>
        <div class="dash-bday-info">
          <div class="dash-bday-name">${escapeHtml(name)}</div>
          <div class="dash-bday-date">${u.day} ${MONTHS[u.month - 1]}</div>
        </div>
        <span class="dash-bday-badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      </div>
    `;
  }).join('')}</div>`;
}

/* ============================================================
   Блок «Последние действия»
   ============================================================ */

function renderRecentLogs(items) {
  if (!items.length) {
    return `<div class="dash-empty"><i class="fa-solid fa-list"></i><p>Нет событий</p></div>`;
  }

  return `<div class="dash-logs">${items.map(l => `
    <div class="dash-log-item">
      <div class="dash-log-level ${l.level}"></div>
      <div class="dash-log-body">
        <div class="dash-log-msg">${escapeHtml(l.message)}</div>
        <div class="dash-log-time">${new Date(l.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</div>
      </div>
    </div>
  `).join('')}</div>`;
}

/* ============================================================
   График за 7 дней
   ============================================================ */

const CHART_CATEGORIES = [
  { key: 'messages',      label: 'Сообщения',    types: ['message_send'],                       color: 'var(--accent)' },
  { key: 'announcements', label: 'Объявления',   types: ['announcement_send', 'autopost_send'], color: 'var(--accent-2)' },
  { key: 'delayed',       label: 'Отложенные',   types: ['delayed_send'],                       color: '#f59e0b' },
  { key: 'birthdays',     label: 'Дни рождения', types: ['birthday_send'],                     color: '#22c55e' },
  { key: 'rules',         label: 'Правила',      types: ['rules_send'],                         color: '#06b6d4' }
];

function renderTodayBadge(logs) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const sendTypes = new Set(CHART_CATEGORIES.flatMap(c => c.types));
  const todayCount = logs.filter(l =>
    sendTypes.has(l.type) && new Date(l.timestamp).getTime() >= todayMs
  ).length;
  return `<span class="dash-chart-today">Сегодня: ${todayCount}</span>`;
}

function renderDetailedChart(logs) {
  const sendTypes = new Set(CHART_CATEGORIES.flatMap(c => c.types));
  const hasAnyData = logs.some(l => sendTypes.has(l.type));

  if (!hasAnyData) {
    return `<div class="dash-empty"><i class="fa-solid fa-chart-line"></i><p>Пока нет данных. График появится после первой отправки.</p></div>`;
  }

  /* Собираем статистику по 7 дням */
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86_400_000;

    const counts = {};
    let total = 0;
    for (const cat of CHART_CATEGORIES) {
      counts[cat.key] = logs.filter(l =>
        cat.types.includes(l.type) &&
        new Date(l.timestamp).getTime() >= dayStart &&
        new Date(l.timestamp).getTime() < dayEnd
      ).length;
      total += counts[cat.key];
    }
    days.push({ date: d, counts, total });
  }

  const maxTotal = Math.max(1, ...days.map(d => d.total));
  const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  /* Суммы за неделю для сводки */
  const weekTotals = {};
  for (const cat of CHART_CATEGORIES) {
    weekTotals[cat.key] = days.reduce((s, d) => s + d.counts[cat.key], 0);
  }
  const weekTotal = Object.values(weekTotals).reduce((s, n) => s + n, 0);

  return `
    <div class="dash-chart-legend">
      ${CHART_CATEGORIES.map(c => `<span class="dash-legend-item"><span class="dash-legend-dot" style="background:${c.color}"></span>${c.label}</span>`).join('')}
    </div>
    <div class="dash-chart dash-chart-stacked">
      ${days.map(d => {
        const h = d.total === 0 ? 0 : Math.max(15, (d.total / maxTotal) * 100);
        return `
          <div class="dash-chart-col" title="${d.total} отправок">
            <div class="dash-chart-value">${d.total > 0 ? d.total : ''}</div>
            <div class="dash-chart-stack" style="height:${h}%">
              ${CHART_CATEGORIES.map(c => {
                const n = d.counts[c.key];
                if (!n) return '';
                return `<div class="dash-chart-seg" style="height:${(n / d.total) * 100}%;background:${c.color}" title="${c.label}: ${n}"></div>`;
              }).join('')}
            </div>
            <div class="dash-chart-label">${DAY_LABELS[d.date.getDay()]}<br><span style="opacity:.6">${String(d.date.getDate()).padStart(2, '0')}</span></div>
          </div>
        `;
      }).join('')}
    </div>
    <div class="dash-chart-summary">
      <div class="dash-summary-title">За неделю: <strong>${weekTotal}</strong> ${pluralize(weekTotal, ['отправка', 'отправки', 'отправок'])}</div>
      <div class="dash-summary-table">
        ${CHART_CATEGORIES.map(c => `<div class="dash-summary-row"><span class="dash-summary-dot" style="background:${c.color}"></span><span class="dash-summary-name">${c.label}</span><span class="dash-summary-value">${weekTotals[c.key]}</span></div>`).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   Утилита: сколько дней до ДР
   ============================================================ */

function daysUntil(day, month) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86_400_000);
}