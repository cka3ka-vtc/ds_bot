// public/assets/js/views/moderation/detailModal.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { FILTER_META } from '/shared/moderation-config.js';

const M = UI.moderation;

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds < 60) return `${seconds} с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч ${Math.floor((seconds % 3600) / 60)} мин`;
  return `${Math.floor(seconds / 86400)} д ${Math.floor((seconds % 86400) / 3600)} ч`;
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
}

function avatar(avatarUrl, name) {
  return avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" alt="" referrerpolicy="no-referrer">`
    : `<span>${escapeHtml(initials(name))}</span>`;
}

function buildText(item) {
  const verb = M.verbs[item.kind] || M.kinds[item.kind] || '';
  const parts = [verb];
  if (item.auto) {
    if (item.filterKey) {
      const name = FILTER_META[item.filterKey]?.name || item.filterKey;
      parts.push(M.list.byRule(name));
    } else if (item.reason) {
      parts.push(M.list.byRule(item.reason));
    }
  } else if (item.reason) {
    parts.push(M.list.byReason(item.reason));
  }
  if (item.auto && item.violation) parts.push(M.list.violation(item.violation));
  return parts.filter(Boolean).join(' · ');
}

export function openDetailModal(view, item) {
  const userLabel = item.displayName || item.username || M.list.unknownUser;
  const modLabel = item.auto
    ? (M.detailModal.auto || 'Автоматически')
    : (item.moderatorDisplayName || item.moderatorName || M.list.unknownModerator);
  const kindLabel = M.kinds[item.kind] || item.kind;
  const statusLabel = M.status[item.status] || item.status;

  const canRemove = item.status === 'active' && item.kind !== 'kick';
  const showStatus = item.kind === 'mute' || item.kind === 'ban';

  let note = '';
  if (item.kind === 'kick') note = M.detailModal.kickNote;
  else if (item.status === 'expired') note = M.detailModal.expiredNote;
  else if (item.status === 'removed') note = M.detailModal.removedNote;

  const now = Math.floor(Date.now() / 1000);
  const progressHTML = item.expiresAt && (item.kind === 'mute' || item.kind === 'ban')
    ? renderProgressBlock(item, now)
    : '';

  const removedByHTML = item.removedAt
    ? (item.removedBy === 'system'
        ? M.detailModal.removedBySystem
        : (item.removedBy ? `ID: ${escapeHtml(item.removedBy)}` : M.detailModal.removedByUnknown))
    : null;

  const filterName = item.filterKey
    ? (FILTER_META[item.filterKey]?.name || item.filterKey)
    : null;

  openModal({
    title: M.detailModal.title,
    subtitle: `#${item.id}`,
    wide: true,
    ctaLabel: canRemove ? M.detailModal.removeAction : M.detailModal.close,
    body: `
      <div class="mod-detail">
        <div class="mod-detail-user">
          <div class="mod-detail-avatar">${avatar(item.avatarUrl, userLabel)}</div>
          <div class="mod-detail-user-info">
            <div class="mod-detail-user-name">${escapeHtml(userLabel)}</div>
            <div class="mod-detail-user-meta">
              ${item.username ? `@${escapeHtml(item.username)} · ` : ''}ID: ${escapeHtml(item.userId)}
            </div>
          </div>
          ${showStatus
            ? `<span class="mod-status mod-status--${item.status}">${escapeHtml(statusLabel)}</span>`
            : ''}
        </div>

        <div class="mod-detail-section">
          <h4>${buildText(item)}</h4>

          <div class="mod-detail-row">
            <span class="mod-detail-label">${M.detailModal.kind}</span>
            <span class="mod-detail-value">
              <span class="mod-kind mod-kind--${item.kind}">${escapeHtml(kindLabel)}</span>
            </span>
          </div>

          ${filterName ? `
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.rule}</span>
              <span class="mod-detail-value">${escapeHtml(filterName)}</span>
            </div>
          ` : ''}

          ${item.auto && item.violation ? `
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.violation}</span>
              <span class="mod-detail-value">№${escapeHtml(item.violation)}</span>
            </div>
          ` : ''}

          <div class="mod-detail-row">
            <span class="mod-detail-label">${M.detailModal.moderator}</span>
            <span class="mod-detail-value">
              ${item.auto
                ? `<span class="mod-row-badge mod-row-badge--auto"><i class="fa-solid fa-shield-halved"></i> ${M.list.auto || 'Авто'}</span>`
                : `${escapeHtml(modLabel)}${item.moderatorId ? ` <span class="mod-detail-hint">· ${escapeHtml(item.moderatorId)}</span>` : ''}`}
            </span>
          </div>

          ${item.reason && !item.auto ? `
            <div class="mod-detail-row mod-detail-row--multiline">
              <span class="mod-detail-label">${M.detailModal.reason}</span>
              <span class="mod-detail-value mod-detail-value--text">${escapeHtml(item.reason)}</span>
            </div>
          ` : ''}
        </div>

        <div class="mod-detail-section">
          <h4>Время</h4>

          <div class="mod-detail-row">
            <span class="mod-detail-label">${M.detailModal.createdAt}</span>
            <span class="mod-detail-value">
              ${fmtDateTime(item.createdAt)}
              <span class="mod-detail-hint">· ${escapeHtml(timeAgo(item.createdAt))}</span>
            </span>
          </div>

          ${item.expiresAt ? `
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.expiresAt}</span>
              <span class="mod-detail-value">${fmtDateTime(item.expiresAt)}</span>
            </div>
          ` : (item.kind === 'mute' || item.kind === 'ban') ? `
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.expiresAt}</span>
              <span class="mod-detail-value">${M.list.forever}</span>
            </div>
          ` : ''}

          ${item.removedAt ? `
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.removedAt}</span>
              <span class="mod-detail-value">
                ${fmtDateTime(item.removedAt)}
                <span class="mod-detail-hint">· ${escapeHtml(timeAgo(item.removedAt))}</span>
              </span>
            </div>
            <div class="mod-detail-row">
              <span class="mod-detail-label">${M.detailModal.removedBy}</span>
              <span class="mod-detail-value">${removedByHTML}</span>
            </div>
          ` : ''}
        </div>

        ${progressHTML}

        ${note ? `
          <div class="mod-detail-note">
            <i class="fa-solid fa-circle-info"></i>
            <span>${escapeHtml(note)}</span>
          </div>
        ` : ''}

        <div class="mod-detail-id">
          <span>${M.detailModal.id}</span>
          <code>${escapeHtml(item.id)}</code>
        </div>
      </div>
    `,
    onSubmit: async (modal) => {
      if (!canRemove) return true;
      if (!confirm(M.actions.removeConfirm(kindLabel, userLabel))) return false;
      return await removeFromModal(view, item);
    },
  });
}

function renderProgressBlock(item, now) {
  const total = item.expiresAt - item.createdAt;
  const elapsed = now - item.createdAt;
  const remaining = Math.max(0, item.expiresAt - now);
  const percent = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;

  const remainingText = item.status === 'active'
    ? `${M.detailModal.remaining}: ${fmtDuration(remaining)}`
    : M.detailModal.expiredNote;

  return `
    <div class="mod-detail-section">
      <h4>${M.detailModal.progress}</h4>
      <div class="mod-progress mod-progress--lg">
        <div class="mod-progress-bar" style="width:${percent}%"></div>
        <span class="mod-progress-label">${percent}%</span>
      </div>
      <div class="mod-detail-hint" style="margin-top:6px;">${escapeHtml(remainingText)}</div>
    </div>
  `;
}

async function removeFromModal(view, item) {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');

  try {
    await api.del(`/api/moderation/actions/${item.id}?botId=${botId}&guildId=${guildId}`);
    toast(M.actions.removed, 'success');
    setTimeout(() => { view?._refresh?.(); }, 100);
    return true;
  } catch (err) {
    const code = err.data?.error;
    const msg = code === 'already_removed' ? M.actions.alreadyRemoved
      : code === 'cannot_revert_kick' ? M.actions.cannotRevert
      : (err.data?.details || err.message);
    toast(`${M.actions.removeFailed}: ${msg}`, 'error');
    return false;
  }
}