// public/assets/js/views/overview/lists.js
import { escapeHtml, fmtNum, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

/* ─────────── Top commands ─────────── */

export function renderTopCommands(commands) {
  if (!commands || !commands.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-terminal"></i>
      <strong>${UI.overview.topCommands.emptyTitle}</strong>
      <span>${UI.overview.topCommands.emptyHint}</span>
    </div>`;
  }
  return `<div class="top-list">
    ${commands.map((c, i) => {
      const rankClass = ['gold', 'silver', 'bronze'][i] || '';
      return `<div class="top-item">
        <span class="top-rank ${rankClass}">${i + 1}</span>
        <span class="top-cmd">/${escapeHtml(c.cmd || UI.overview.topCommands.unknown)}</span>
        <span class="top-count">${fmtNum(c.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ─────────── Top channels ─────────── */

export function renderTopChannels(channels, filter = 'text') {
  if (!channels || !channels.length) {
    const isEmptyText = filter !== 'voice';
    return `<div class="empty-state" style="padding:28px 16px;">
      <i class="fa-solid fa-${filter === 'voice' ? 'microphone' : 'hashtag'}"></i>
      <strong>${isEmptyText ? UI.overview.topChannels.emptyTextTitle : UI.overview.topChannels.emptyVoiceTitle}</strong>
      <span>${isEmptyText ? UI.overview.topChannels.emptyTextHint : UI.overview.topChannels.emptyVoiceHint}</span>
    </div>`;
  }
  const icon = filter === 'voice' ? 'fa-volume-high' : 'fa-hashtag';
  return `<div class="top-list">
    ${channels.map((ch, i) => {
      const rankClass = ['gold', 'silver', 'bronze'][i] || '';
      return `<div class="top-item">
        <span class="top-rank ${rankClass}">${i + 1}</span>
        <span class="top-cmd channel">
          <i class="fa-solid ${icon}"></i>
          ${escapeHtml(ch.name || UI.overview.topChannels.unknown)}
        </span>
        <span class="top-count">${fmtNum(ch.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/* ─────────── Recent events ─────────── */

const SOURCE_COLORS = {
  mod:   { warn: 'orange', mute: 'blue', ban: 'red', auto: 'purple' },
  log:   { levels: 'green', birthdays: 'pink', greetings: 'green', moderation: 'red' },
  event: { command: 'blue', member_join: 'green', member_leave: 'red' },
};

function pickColor(e) {
  const map = SOURCE_COLORS[e.source];
  if (!map) return 'blue';
  return map[e.type] || 'blue';
}

export function classifyEvent(e) {
  if (!e) return 'other';
  if (e.source === 'mod') return 'moderation';
  if (e.source === 'log') {
    if (e.type === 'levels') return 'levels';
    if (e.type === 'birthdays') return 'birthdays';
    if (e.type === 'moderation') return 'moderation';
    if (e.type === 'greetings') return 'members';
    return 'other';
  }
  if (e.source === 'event') {
    if (e.type === 'command') return 'commands';
    if (e.type === 'member_join' || e.type === 'member_leave') return 'members';
  }
  return 'other';
}

export function filterEvents(events, filter) {
  if (!events || !events.length) return [];
  if (!filter || filter === 'all') return events;
  return events.filter((e) => classifyEvent(e) === filter);
}

function renderEventBody(e) {
  if (e.source === 'mod') {
    const labels = { warn: 'предупреждение', mute: 'мут', ban: 'бан', auto: 'автодействие' };
    const label = labels[e.type] || e.type;
    const reason = e.message ? `: ${escapeHtml(e.message)}` : '';
    return `<strong>&lt;@${escapeHtml(e.user_id || '?')}&gt;</strong> — ${label}${reason}`;
  }

  if (e.source === 'log') {
    return escapeHtml(e.message || '');
  }

  if (e.source === 'event') {
    const meta = e.meta || {};
    const name = meta.displayName || meta.username || '?';

    if (e.type === 'command') {
      const cmd = meta.command ? `/${meta.command}` : '/?';
      return `<strong>${escapeHtml(name)}</strong> использовал <code>${escapeHtml(cmd)}</code>`;
    }
    if (e.type === 'member_join') {
      return `<strong>${escapeHtml(name)}</strong> присоединился к серверу`;
    }
    if (e.type === 'member_leave') {
      return `<strong>${escapeHtml(name)}</strong> покинул сервер`;
    }
  }

  return escapeHtml(e.message || '—');
}

export function renderRecentEventsBody(events, opts = {}) {
  const emptyTitle = opts.emptyTitle || 'Пока нет событий';
  const emptyHint = opts.emptyHint
    || 'Здесь появятся команды, повышения уровня, вход/выход участников и действия модерации';

  if (!events || !events.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-clock-rotate-left"></i>
      <strong>${emptyTitle}</strong>
      <span>${emptyHint}</span>
    </div>`;
  }

  return `<div class="activity-list">
    ${events.map((e) => {
      const color = pickColor(e);
      const text = renderEventBody(e);
      return `<div class="activity-item">
        <span class="activity-dot ${color}"></span>
        <div class="activity-body">
          <div class="activity-text">${text}</div>
          <div class="activity-time">${timeAgo(e.created_at)}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

/* ─────────── Upcoming birthdays panel ─────────── */

function formatDaysLeft(n) {
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n >= 2 && n <= 4) return `через ${n} дня`;
  return `через ${n} дней`;
}

function birthdayWhenClass(n) {
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  return '';
}

function fullBirthday(ddmm, year) {
  return year ? `${ddmm}.${year}` : ddmm;
}

function ageFromYear(year) {
  if (!year) return null;
  const age = new Date().getFullYear() - Number(year);
  return age >= 0 && age < 200 ? age : null;
}

function initialsOf(name) {
  return String(name || '?').trim()
    .split(/\s+/).map((w) => w[0]).filter(Boolean)
    .join('').slice(0, 2).toUpperCase() || '?';
}

export function renderUpcomingBirthdays(list, moduleEnabled) {
  if (!moduleEnabled) {
    return `<div class="empty-state" style="padding:36px 24px;">
      <i class="fa-solid fa-cake-candles"></i>
      <strong>Модуль «Дни рождения» отключён</strong>
      <span>Для отображения панели необходимо включить модуль</span>
      <a href="#modules?sub=birthdays" class="btn btn-ghost btn-sm">Открыть модуль</a>
    </div>`;
  }

  if (!list || !list.length) {
    return `<div class="empty-state" style="padding:36px 24px;">
      <i class="fa-solid fa-cake-candles"></i>
      <strong>Пока никто не указал день рождения</strong>
      <span>Участники могут установить дату командой /birthday_set</span>
    </div>`;
  }

  return `<div class="birthday-list">
    ${list.map((b) => {
      const name = b.displayName || b.username || 'Участник';
      const initial = initialsOf(name);
      const age = ageFromYear(b.birthdayYear);
      const dateText = fullBirthday(b.birthday, b.birthdayYear) + (age != null ? ` · ${age} лет` : '');
      const whenClass = birthdayWhenClass(b.daysLeft);
      const isOff = b.birthdayPublic === false;

      const avatarInner = b.avatarUrl
        ? `<img src="${escapeHtml(b.avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
        : escapeHtml(initial);

      const offBadge = isOff
        ? `<span class="birthday-off-badge" title="Поздравления отключены">
             <i class="fa-solid fa-bell-slash"></i>
           </span>`
        : '';

      return `<div class="birthday-item ${isOff ? 'is-off' : ''}">
        <div class="birthday-avatar">${avatarInner}</div>
        <div class="birthday-info">
          <div class="birthday-name">
            <span class="birthday-name-text">${escapeHtml(name)}</span>${offBadge}
          </div>
          <div class="birthday-date">${escapeHtml(dateText)}</div>
        </div>
        <span class="birthday-when ${whenClass}">${formatDaysLeft(b.daysLeft)}</span>
      </div>`;
    }).join('')}
  </div>`;
}