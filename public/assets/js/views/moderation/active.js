// public/assets/js/views/moderation/active.js
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

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
      <div class="active-lists">
        ${section(UI.moderation.active.mutes, mutes, 'purple', 'fa-microphone-slash')}
        ${section(UI.moderation.active.bans, bans, 'red', 'fa-ban')}
        ${section(UI.moderation.active.warns, warns, 'orange', 'fa-triangle-exclamation')}
      </div>
    </div>`;
}

function section(title, items, color, icon) {
  const html = items.length
    ? items.slice(0, 4).map((a) => {
        const shortId = (a.userId || '').slice(-2).toUpperCase();
        const expires = a.expiresAt
          ? `· ${UI.moderation.active.until} ${new Date(a.expiresAt * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : `· ${UI.moderation.active.forever}`;
        return `<div class="active-list-item">
          <div class="active-list-avatar" style="background:var(--${color});">${escapeHtml(shortId)}</div>
          <div class="active-list-info">
            <div class="active-list-name">&lt;@${escapeHtml(a.userId)}&gt;</div>
            <div class="active-list-meta">${escapeHtml(a.reason || UI.moderation.active.noReason)} ${expires}</div>
          </div>
        </div>`;
      }).join('')
    : `<div class="active-list-empty">${UI.moderation.active.empty}</div>`;

  return `<div class="active-list-section">
    <h4>
      <span><i class="fa-solid ${icon}" style="color:var(--${color});margin-right:6px;font-size:11px;"></i>${title}</span>
      <span class="count">${items.length}</span>
    </h4>
    ${html}
  </div>`;
}