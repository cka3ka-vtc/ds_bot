// public/assets/js/views/members/cards.js
import { escapeHtml, fmtDate } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const C = UI.members.card;

export function renderMemberCard(m) {
  const initial = (m.displayName || m.username || '?').trim()[0]?.toUpperCase() || '?';
  const avatarInner = m.avatar
    ? `<img src="${escapeHtml(m.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span>${escapeHtml(initial)}</span>`;

  const roleBadges = (m.roles || []).slice(0, 2).map((r) => {
    const color = r.color && r.color !== '#000000' ? r.color : null;
    const style = color ? `background:${color}22;color:${color};border:1px solid ${color}33;` : '';
    return `<span class="member-role-badge" style="${style}">${escapeHtml(r.name)}</span>`;
  }).join('');
  const moreRoles = (m.roles || []).length > 2
    ? `<span class="member-role-badge more">+${(m.roles || []).length - 2}</span>` : '';

  const percent = Math.max(0, Math.min(100, m.progressPercent || 0));
  const progressCurrent = m.progressCurrent || 0;
  const progressTotal = m.progressTotal || 0;

  return `
    <div class="member-card ${m.left ? 'is-left' : ''}" data-open="${m.id}">
      <button class="member-settings-btn" type="button" data-edit="${m.id}" aria-label="${C.openLabel}">
        <i class="fa-solid fa-arrow-right"></i>
      </button>

      <div class="member-top">
        <div class="member-avatar-lg">${avatarInner}</div>
        <div class="member-main">
          <div class="member-display-name">${escapeHtml(m.displayName || m.username || C.userFallback)}</div>
          <div class="member-username">@${escapeHtml(m.username || C.unknown)}</div>
        </div>
      </div>

      ${m.left ? `
        <div class="member-left-chip">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>${C.leftLabel}${m.leftAt ? ' · ' + fmtDate(m.leftAt / 1000) : ''}</span>
        </div>
      ` : ''}

      <div class="member-level-row">
        <span class="member-level-badge"><i class="fa-solid fa-star"></i> ${m.level} ${C.levelSuffix}</span>
        ${m.title ? `<span class="member-title-badge">${escapeHtml(m.title)}</span>` : ''}
        ${m.rank ? `<span class="member-rank-badge" title="${C.rankTitle}">#${m.rank}</span>` : ''}
      </div>

      <div class="member-progress">
        <div class="member-progress-fill" style="width: ${percent}%"></div>
        <div class="member-progress-label">
          ${progressCurrent.toLocaleString('ru-RU')} / ${progressTotal.toLocaleString('ru-RU')} XP
        </div>
      </div>

      <div class="member-activity">
        <span class="member-activity-item" title="${C.statMessages}">
          <i class="fa-solid fa-message"></i> ${m.messages || 0}
        </span>
        <span class="member-activity-item" title="${C.statVoice}">
          <i class="fa-solid fa-volume-high"></i> ${m.voice || 0}
        </span>
        <span class="member-activity-item" title="${C.statCommands}">
          <i class="fa-solid fa-terminal"></i> ${m.commands || 0}
        </span>
        ${m.warnings > 0 ? `
          <span class="member-activity-item warn" title="${C.statWarnings}">
            <i class="fa-solid fa-triangle-exclamation"></i> ${m.warnings}
          </span>
        ` : ''}
        ${m.birthday ? `
          <span class="member-meta-item" title="${C.statBirthday}">
            <i class="fa-solid fa-cake-candles"></i> ${escapeHtml(m.birthday)}
          </span>
        ` : ''}
      </div>

      ${(m.roles || []).length ? `
        <div class="member-roles">
          ${roleBadges}${moreRoles}
        </div>
      ` : ''}
    </div>
  `;
}

export function renderGrid(grid, items) {
  if (!grid) return;
  grid.innerHTML = (items || []).map(renderMemberCard).join('');
}