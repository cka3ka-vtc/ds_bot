// public/assets/js/views/moderation/active.js
// Активные наказания — единый вид через logEntry (компактная версия).

import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { renderLogEntry } from '../../components/logEntry.js';

export function renderActiveSections(actions) {
  const now = Math.floor(Date.now() / 1000);
  const active = actions.filter((a) =>
    (!a.expiresAt || a.expiresAt > now) && ['warn', 'mute', 'ban'].includes(a.kind));

  const mutes = active.filter((a) => a.kind === 'mute');
  const bans = active.filter((a) => a.kind === 'ban');
  const warns = active.filter((a) => a.kind === 'warn');

  return `
    <div class="card">
      <div class="card-head">
        <div><span class="card-title">${UI.moderation.active.title}</span></div>
      </div>
      <div class="card-body" style="padding:8px 12px;">
        ${section(UI.moderation.active.mutes, mutes)}
        ${section(UI.moderation.active.bans, bans)}
        ${section(UI.moderation.active.warns, warns)}
      </div>
    </div>`;
}

function section(title, items) {
  const count = items.length;
  if (!count) {
    return `<div class="active-list-section">
      <h4>
        <span>${escapeHtml(title)}</span>
        <span class="count">0</span>
      </h4>
      <div class="active-list-empty">${UI.moderation.active.empty}</div>
    </div>`;
  }

  const entries = items.slice(0, 4).map((a) => {
    const metaParts = [];
    if (a.expiresAt) {
      const dt = new Date(a.expiresAt * 1000).toLocaleTimeString('ru-RU', {
        hour: '2-digit', minute: '2-digit',
      });
      metaParts.push(`${UI.moderation.active.until} ${dt}`);
    } else {
      metaParts.push(UI.moderation.active.forever);
    }
    if (!a.moderatorId) metaParts.push('автоматически');

    return {
      tone: a.kind,
      label: UI.moderation.kinds[a.kind] || a.kind,
      userId: a.userId,
      username: a.username || null,
      displayName: a.displayName || null,
      avatarUrl: a.avatarUrl || null,
      text: escapeHtml(a.reason || UI.moderation.active.noReason),
      meta: metaParts.join(' · '),
      timestamp: a.createdAt,
    };
  });

  const preview = `<div class="log-list">${entries.map(renderLogEntry).join('')}</div>`;

  return `<div class="active-list-section">
    <h4>
      <span>${escapeHtml(title)}</span>
      <span class="count">${count}</span>
    </h4>
    ${preview}
    ${count > 4 ? `<div class="active-list-more">+${count - 4} ещё</div>` : ''}
  </div>`;
}