// public/assets/js/views/overview/lists.js
import { escapeHtml, fmtNum, timeAgo } from '../../core/utils.js';

export function renderTopCommands(commands) {
  if (!commands || !commands.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-terminal"></i>
      <strong>Пока нет данных</strong>
      <span>Команды появятся здесь, когда ими начнут пользоваться</span>
    </div>`;
  }
  return `<div class="top-list">
    ${commands.map((c, i) => {
      const rankClass = ['gold', 'silver', 'bronze'][i] || '';
      return `<div class="top-item">
        <span class="top-rank ${rankClass}">${i + 1}</span>
        <span class="top-cmd">/${escapeHtml(c.cmd || 'неизвестно')}</span>
        <span class="top-count">${fmtNum(c.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

/**
 * channels = [{ name, count }] — count = уникальные пользователи
 * filter   = 'text' | 'voice'
 */
export function renderTopChannels(channels, filter = 'text') {
  if (!channels || !channels.length) {
    return `<div class="empty-state" style="padding:28px 16px;">
      <i class="fa-solid fa-${filter === 'voice' ? 'microphone' : 'hashtag'}"></i>
      <strong>Пока нет данных</strong>
      <span>Статистика появится после активности в ${filter === 'voice' ? 'голосовых' : 'текстовых'} каналах</span>
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
          ${escapeHtml(ch.name || 'unknown')}
        </span>
        <span class="top-count">${fmtNum(ch.count)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

export function renderRecentEvents(events) {
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