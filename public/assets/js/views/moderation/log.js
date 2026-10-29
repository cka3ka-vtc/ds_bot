// public/assets/js/views/moderation/log.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, WORD } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const KIND_LABELS = {
  warn: UI.moderation.kinds.warn,
  mute: UI.moderation.kinds.mute,
  ban: UI.moderation.kinds.ban,
  auto: UI.moderation.kinds.auto,
};

export function renderLogList(view) {
  const el = view.container.querySelector('#logList');
  const q = view.container.querySelector('#modSearch').value.trim().toLowerCase();
  const kind = view.container.querySelector('#modKindFilter').value;

  if (!view.actions.length) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shield-halved"></i>
        <strong>${UI.moderation.log.emptyTitle}</strong>
        <span>${UI.moderation.log.emptyHint}</span>
      </div>`;
    view.container.querySelector('#logCount').textContent = `0 ${WORD.record(0)}`;
    return;
  }

  const filtered = view.actions.filter((a) => {
    const hay = ((a.userId || '') + ' ' + (a.reason || '')).toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (kind && a.kind !== kind) return false;
    return true;
  });

  view.container.querySelector('#logCount').textContent = `${filtered.length} ${WORD.record(filtered.length)}`;

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-filter"></i><strong>${UI.moderation.log.notFoundTitle}</strong></div>`;
    return;
  }

  el.innerHTML = filtered.map((a) => {
    const metaLabel = KIND_LABELS[a.kind] || a.kind;
    const time = new Date(a.createdAt * 1000).toLocaleString('ru-RU');
    const expires = a.expiresAt
      ? `<span>· ${UI.moderation.log.expires} ${new Date(a.expiresAt * 1000).toLocaleString('ru-RU')}</span>`
      : '';
    return `<div class="mod-entry">
      <div class="mod-entry-body">
        <div class="mod-entry-title"><strong>&lt;@${escapeHtml(a.userId)}&gt;</strong> — ${metaLabel.toLowerCase()}</div>
        <div class="mod-entry-meta">
          <span>${escapeHtml(a.reason || UI.moderation.log.noReason)}</span>${expires}
        </div>
      </div>
      <span class="mod-entry-time">${time}</span>
      <button class="btn btn-icon btn-ghost" data-remove="${a.id}" title="${UI.moderation.log.removeLabel}" aria-label="${UI.moderation.log.removeLabel}" style="margin-left:8px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeAction(view, btn.dataset.remove));
  });
}

async function removeAction(view, id) {
  if (!confirm(UI.moderation.log.removeConfirm)) return;
  try {
    await api.del(`/api/moderation/actions/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
    toast(UI.moderation.log.removed, 'success');
    await view.render(view.container);
  } catch (err) {
    toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
  }
}