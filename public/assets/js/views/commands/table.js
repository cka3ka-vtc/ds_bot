// public/assets/js/views/commands/table.js
import { escapeHtml, WORD } from '../../core/utils.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { store } from '../../core/store.js';
import { UI } from '/shared/ui-strings.js';
import { openEditor } from './editor.js';

export function renderTable(view) {
  const { container, state } = view;
  const body = container.querySelector('#cmdBody');
  const empty = container.querySelector('#cmdEmpty');
  const count = container.querySelector('#cmdCount');

  const list = [];
  if (state.filter !== 'custom') state.builtin.forEach((c) => list.push({ ...c, _src: 'builtin' }));
  if (state.filter !== 'builtin') state.custom.forEach((c) => list.push({ ...c, _src: 'custom' }));

  const filtered = list.filter((c) =>
    !state.search || c.name.toLowerCase().includes(state.search) || (c.description || '').toLowerCase().includes(state.search),
  );

  if (!filtered.length) {
    body.innerHTML = '';
    empty.hidden = false;
    count.textContent = `0 ${WORD.command(0)}`;
    return;
  }
  empty.hidden = true;
  count.textContent = `${filtered.length} ${WORD.command(filtered.length)}`;

  body.innerHTML = filtered.map((c) => `
    <tr data-id="${c.id}" data-source="${c._src}">
      <td>
        <div class="cmd-cell">
          <span class="cmd-icon ${c._src === 'custom' ? 'custom' : ''}">
            <i class="fa-solid ${c._src === 'custom' ? 'fa-message' : 'fa-bolt'}"></i>
          </span>
          <div>
            <div class="cmd-name">/${escapeHtml(c.name)}</div>
            <div class="cmd-desc">${escapeHtml(c.description || '—')}</div>
          </div>
        </div>
      </td>
      <td><span class="cat-pill util">${escapeHtml(c.category || 'Custom')}</span></td>
      <td>
        <span class="type-badge ${c._src === 'custom' ? 'custom' : 'functional'}">
          ${c._src === 'custom' ? UI.commands.typeCustom : UI.commands.typeBuiltin}
        </span>
      </td>
      <td>
        <div class="row-actions">
          ${c._src === 'custom'
            ? `<button class="btn btn-icon btn-ghost" data-edit="${c.id}" title="${UI.common.edit}" aria-label="${UI.common.edit}"><i class="fa-solid fa-gear"></i></button>
               <button class="btn btn-icon btn-ghost" data-delete="${c.id}" title="${UI.common.delete}" aria-label="${UI.common.delete}"><i class="fa-solid fa-trash"></i></button>
               <button class="toggle ${c.enabled ? 'on' : ''}" data-toggle="${c.id}" role="switch" aria-checked="${c.enabled}" aria-label="/${escapeHtml(c.name)}"></button>`
            : `<span class="badge online">${UI.commands.badgeBuiltin}</span>`}
        </div>
      </td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openEditor(view, b.dataset.edit)));
  body.querySelectorAll('[data-delete]').forEach((b) =>
    b.addEventListener('click', () => removeCommand(view, b.dataset.delete)));
  body.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => toggleCommand(b.dataset.toggle, b)));
}

async function removeCommand(view, id) {
  if (!confirm(UI.commands.confirmDelete)) return;
  try {
    await api.del(`/api/commands/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
    toast(UI.toast.deleted, 'success');
    await view.render(view.container);
  } catch (err) {
    toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
  }
}

async function toggleCommand(id, btn) {
  const enabled = btn.classList.toggle('on');
  btn.setAttribute('aria-checked', String(enabled));
  try {
    await api.post(`/api/commands/${id}/toggle`, {
      botId: store.get('activeBotId'),
      guildId: store.get('activeGuildId'),
      enabled,
    });
  } catch {
    btn.classList.toggle('on');
    toast(UI.common.error, 'error');
  }
}