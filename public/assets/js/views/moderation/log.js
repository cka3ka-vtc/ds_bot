// public/assets/js/views/moderation/log.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, WORD } from '../../core/utils.js';
import { KIND_META } from './index.js';

export function renderLogList(view) {
  const el = view.container.querySelector('#logList');
  const q = view.container.querySelector('#modSearch').value.trim().toLowerCase();
  const kind = view.container.querySelector('#modKindFilter').value;

  if (!view.actions.length) {
    el.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shield-halved"></i>
        <strong>Журнал пуст</strong>
        <span>Наказания будут появляться здесь</span>
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
    el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-filter"></i><strong>Ничего не найдено</strong></div>`;
    return;
  }

  el.innerHTML = filtered.map((a) => {
    const meta = KIND_META[a.kind] || { label: a.kind };
    const time = new Date(a.createdAt * 1000).toLocaleString('ru-RU');
    const expires = a.expiresAt ? `<span>· истекает ${new Date(a.expiresAt * 1000).toLocaleString('ru-RU')}</span>` : '';
    return `<div class="mod-entry">
      <div class="mod-entry-body">
        <div class="mod-entry-title"><strong>&lt;@${escapeHtml(a.userId)}&gt;</strong> — ${meta.label.toLowerCase()}</div>
        <div class="mod-entry-meta">
          <span>${escapeHtml(a.reason || 'без причины')}</span>${expires}
        </div>
      </div>
      <span class="mod-entry-time">${time}</span>
      <button class="btn btn-icon btn-ghost" data-remove="${a.id}" title="Снять" style="margin-left:8px;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
  }).join('');

  el.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => removeAction(view, btn.dataset.remove));
  });
}

async function removeAction(view, id) {
  if (!confirm('Снять наказание?')) return;
  try {
    await api.del(`/api/moderation/actions/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
    toast('Наказание снято', 'success');
    await view.render(view.container);
  } catch (err) {
    toast('Ошибка: ' + (err.data?.error || err.message), 'error');
  }
}