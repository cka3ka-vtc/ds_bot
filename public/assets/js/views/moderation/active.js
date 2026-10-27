// public/assets/js/views/moderation/active.js
import { escapeHtml } from '../../core/utils.js';

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
        <div><span class="card-title">Активные санкции</span></div>
      </div>
      <div class="active-lists">
        ${section('Муты', mutes, 'purple', 'fa-microphone-slash')}
        ${section('Баны', bans, 'red', 'fa-ban')}
        ${section('Предупреждения', warns, 'orange', 'fa-triangle-exclamation')}
      </div>
    </div>`;
}

function section(title, items, color, icon) {
  const html = items.length
    ? items.slice(0, 4).map((a) => {
        const shortId = (a.userId || '').slice(-2).toUpperCase();
        const expires = a.expiresAt
          ? `· до ${new Date(a.expiresAt * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : '· бессрочно';
        return `<div class="active-list-item">
          <div class="active-list-avatar" style="background:var(--${color});">${escapeHtml(shortId)}</div>
          <div class="active-list-info">
            <div class="active-list-name">&lt;@${escapeHtml(a.userId)}&gt;</div>
            <div class="active-list-meta">${escapeHtml(a.reason || 'без причины')} ${expires}</div>
          </div>
        </div>`;
      }).join('')
    : `<div class="active-list-empty">Нет</div>`;

  return `<div class="active-list-section">
    <h4>
      <span><i class="fa-solid ${icon}" style="color:var(--${color});margin-right:6px;font-size:11px;"></i>${title}</span>
      <span class="count">${items.length}</span>
    </h4>
    ${html}
  </div>`;
}