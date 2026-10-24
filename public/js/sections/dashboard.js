import { state } from '../state.js';
import { escapeHtml, formatNumber, pluralize } from '../utils.js';

const UPCOMING_BIRTHDAYS_LIMIT = 8;

/* ============================================================
   Дашборд: статистика, ближайшие ДР, последние логи, график.
   ============================================================ */
export function renderDashboard() {
  const root = document.getElementById('view-dashboard');
  if (!root) return;

  const guild = state.guild || {};
  const announcements = state.announcements || [];
  const delayed = state.delayed || [];
  const birthdays = state.birthdays || { users: [] };
  const logs = state.logs || [];

  const activeAnn = announcements.filter(a => a.enabled).length;
  const pendingDelayed = delayed.filter(d => d.publishAt && !d.lastSentAt).length;
  const users = Array.isArray(birthdays.users) ? birthdays.users : [];

  const bdaysUpcoming = users
    .filter(u => u.day && u.month && u.enabled !== false)
    .map(u => ({ ...u, _days: daysUntil(u.day, u.month) }))
    .sort((a, b) => a._days - b._days)
    .slice(0, UPCOMING_BIRTHDAYS_LIMIT);

  const upcoming7 = users.filter(u => {
    if (!u.day || !u.month || u.enabled === false) return false;
    return daysUntil(u.day, u.month) <= 7;
  }).length;

  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  root.innerHTML = `
    <div class="dashboard-grid">
      <div class="dash-stats">
        <button class="dash-stat clickable" data-goto="dashboard">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div class="dash-stat-label">Участники</div>
          <div class="dash-stat-value">${formatNumber(guild.memberCount || 0)}</div>
          <div class="dash-stat-hint">${formatNumber(guild.onlineCount || 0)} онлайн</div>
        </button>

        <button class="dash-stat clickable" data-goto="announcements">
          <div class="dash-stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8v18l-18-8z"/><line x1="11.6" y1="11.6" x2="8" y2="18"/></svg>
          </div>
          <div class="dash-stat-label">Анонсы</div>
          <div class="dash-stat-value">${activeAnn}</div>
          <div class="dash-stat-hint">из ${announcements.length} активных</div>
        </button>

        <button class="dash-stat clickable" data-goto="delayed">
          <div class="dash-stat-icon warning">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="dash-stat-label">Отложенные</div>
          <div class="dash-stat-value">${pendingDelayed}</div>
          <div class="dash-stat-hint">ожидают отправки</div>
        </button>

        <button class="dash-stat clickable" data-goto="birthdays">
          <div class="dash-stat-icon success">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/></svg>
          </div>
          <div class="dash-stat-label">Дни рождения</div>
          <div class="dash-stat-value">${upcoming7}</div>
          <div class="dash-stat-hint">в ближайшие 7 дней</div>
        </button>
      </div>

      <div class="dash-row">
        <div class="dash-card">
          <div class="dash-card-header">
            <h3>Ближайшие дни рождения</h3>
            <a href="#" data-goto="birthdays">Все →</a>
          </div>
          <div class="dash-card-body">
            ${renderUpcomingBirthdays(bdaysUpcoming)}
          </div>
        </div>

        <div class="dash-card">
          <div class="dash-card-header">
            <h3>Последние события</h3>
            <a href="#" data-goto="logs">Все →</a>
          </div>
          <div class="dash-card-body">
            ${renderRecentLogs(recentLogs)}
          </div>
        </div>
      </div>

      <div class="dash-card">
        <div class="dash-card-header">
          <h3>Отправки за последние 7 дней ${renderTodayBadge(logs)}</h3>
        </div>
        <div class="dash-card-body">
          ${renderDetailedChart(logs)}
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      goTo(el.dataset.goto);
    });
  });
}

/* ============================================================
   Ближайшие ДР
   ============================================================ */
function renderUpcomingBirthdays(items) {
  if (!items.length) {
    return `<div class="dash-empty">Пока нет записей с датой рождения</div>`;
  }
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  return `<div class="dash-bday-list">${items.map(u => {
    const member = (state.members || []).find(m => m.id === u.userId);
    const name = member?.displayName || member?.username || `ID: ${u.userId}`;
    const initial = name.charAt(0).toUpperCase();
    const avatarInner = member?.avatar ? `<img src="${member.avatar}" alt="">` : initial;

    let badgeClass = '';
    let badgeText = '';
    if (u._days === 0) { badgeClass = 'today'; badgeText = 'Сегодня'; }
    else if (u._days === 1) { badgeClass = 'soon'; badgeText = 'Завтра'; }
    else if (u._days <= 7) { badgeClass = 'soon'; badgeText = `Через ${u._days} дн.`; }
    else { badgeText = `Через ${u._days} дн.`; }

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
   Последние события
   ============================================================ */
function renderRecentLogs(items) {
  if (!items.length) {
    return `<div class="dash-empty">Пока нет событий</div>`;
  }
  return `<div class="dash-logs">${items.map(l => `
    <div class="dash-log-item">
      <div class="dash-log-level ${escapeHtml(l.level)}"></div>
      <div class="dash-log-body">
        <div class="dash-log-msg">${escapeHtml(l.message)}</div>
        <div class="dash-log-time">${new Date(l.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</div>
      </div>
    </div>
  `).join('')}</div>`;
}

/* ============================================================
   Детальная статистика отправок
   ============================================================ */
const CHART_CATEGORIES = [
  { key: 'messages',      label: 'Сообщения',    types: ['message_send'],                       color: 'var(--accent)' },
  { key: 'announcements', label: 'Анонсы',       types: ['announcement_send', 'autopost_send'], color: 'var(--accent-2)' },
  { key: 'delayed',       label: 'Отложенные',   types: ['delayed_send'],                       color: '#f59e0b' },
  { key: 'birthdays',     label: 'Дни рождения', types: ['birthday_send'],                      color: '#22c55e' },
  { key: 'rules',         label: 'Правила',      types: ['rules_send'],                         color: '#06b6d4' }
];

function renderTodayBadge(logs) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();

  const sendTypes = new Set(CHART_CATEGORIES.flatMap(c => c.types));
  const todayCount = logs.filter(l => {
    if (!sendTypes.has(l.type)) return false;
    return new Date(l.timestamp).getTime() >= todayMs;
  }).length;

  return `<span class="dash-chart-today">Сегодня: ${todayCount}</span>`;
}

function renderDetailedChart(logs) {
  const sendTypes = new Set(CHART_CATEGORIES.flatMap(c => c.types));
  const hasAnyData = logs.some(l => sendTypes.has(l.type));

  if (!hasAnyData) {
    return `<div class="dash-empty">Пока нет отправок. Данные появятся после первой публикации.</div>`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = d.getTime();
    const dayEnd = dayStart + 86400000;

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

  /* Суммы за неделю по категориям */
  const weekTotals = {};
  for (const cat of CHART_CATEGORIES) {
    weekTotals[cat.key] = days.reduce((s, d) => s + d.counts[cat.key], 0);
  }
  const weekTotal = Object.values(weekTotals).reduce((s, n) => s + n, 0);

  return `
    <div class="dash-chart-legend">
      ${CHART_CATEGORIES.map(c => `
        <span class="dash-legend-item">
          <span class="dash-legend-dot" style="background:${c.color}"></span>
          ${c.label}
        </span>
      `).join('')}
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
                const pct = (n / d.total) * 100;
                return `<div class="dash-chart-seg" style="height:${pct}%;background:${c.color}" title="${c.label}: ${n}"></div>`;
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
        ${CHART_CATEGORIES.map(c => `
          <div class="dash-summary-row">
            <span class="dash-summary-dot" style="background:${c.color}"></span>
            <span class="dash-summary-name">${c.label}</span>
            <span class="dash-summary-value">${weekTotals[c.key]}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/* ============================================================
   Утилиты
   ============================================================ */
function daysUntil(day, month) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86400000);
}

async function goTo(view) {
  const { switchView } = await import('../main.js');
  switchView(view);
}