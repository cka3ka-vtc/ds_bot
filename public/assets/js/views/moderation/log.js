// public/assets/js/views/moderation/log.js
// Журнал действий — единый компонент renderLogEntry.

import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, WORD } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { renderLogEntry } from '../../components/logEntry.js';

const KIND_LABELS = {
  warn: UI.moderation.kinds.warn,
  mute: UI.moderation.kinds.mute,
  ban:  UI.moderation.kinds.ban,
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
    const hay = ((a.userId || '') + ' ' + (a.username || '') + ' ' + (a.reason || '')).toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (kind && a.kind !== kind) return false;
    return true;
  });

  view.container.querySelector('#logCount').textContent = `${filtered.length} ${WORD.record(filtered.length)}`;

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-filter"></i>
      <strong>${UI.moderation.log.notFoundTitle}</strong>
    </div>`;
    return;
  }

  const entries = filtered.map((a) => {
    const label = KIND_LABELS[a.kind] || a.kind;

    // Мета-строка: срок + модератор
    const metaParts = [];
    if (a.expiresAt) {
      const dt = new Date(a.expiresAt * 1000).toLocaleString('ru-RU');
      metaParts.push(`${UI.moderation.log.expires} ${escapeHtml(dt)}`);
    }
    if (a.moderatorId) {
      metaParts.push(`модератор: @${escapeHtml(String(a.moderatorId))}`);
    } else {
      metaParts.push('автоматически');
    }

    return {
      tone: a.kind,
      label,
      userId: a.userId,
      username: a.username || null,
      displayName: a.displayName || null,
      avatarUrl: a.avatarUrl || null,
      text: escapeHtml(a.reason || UI.moderation.log.noReason),
      meta: metaParts.join(' · '),
      timestamp: a.createdAt,
      actions: `<button type="button"
                class="btn btn-icon btn-ghost log-remove-btn"
                data-remove="${escapeHtml(a.id)}"
                title="${UI.moderation.log.removeLabel}"
                aria-label="${UI.moderation.log.removeLabel}">
                <i class="fa-solid fa-xmark"></i>
              </button>`,
    };
  });

  el.innerHTML = `<div class="log-list">${entries.map(renderLogEntry).join('')}</div>`;

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