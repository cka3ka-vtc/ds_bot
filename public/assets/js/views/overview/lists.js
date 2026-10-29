// public/assets/js/views/overview/lists.js
import { escapeHtml, fmtNum, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

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

export function renderRecentEvents(events) {
  if (!events || !events.length) {
    return `<div class="empty-state" style="padding:32px 16px;">
      <i class="fa-solid fa-clock-rotate-left"></i>
      <strong>${UI.overview.recentEvents.emptyTitle}</strong>
      <span>${UI.overview.recentEvents.emptyHint}</span>
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