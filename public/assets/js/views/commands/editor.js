// public/assets/js/views/commands/editor.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

export function openEditor(view, id) {
  const editing = id ? view.state.custom.find((c) => c.id === id) : null;

  openModal({
    title: editing ? UI.commands.editorEdit : UI.commands.editorCreate,
    subtitle: editing ? `/${editing.name}` : UI.commands.editorSubtitleCreate,
    body: `
      <div class="form-row single">
        <div class="form-field">
          <label>${UI.commands.editorLabelName}</label>
          <input type="text" id="cmdName" value="${editing ? escapeHtml(editing.name) : ''}" placeholder="${UI.commands.editorPlaceholderName}" maxlength="32">
          <span class="hint" id="cmdNameHint">${UI.commands.editorNameHint}</span>
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>${UI.commands.editorLabelDesc}</label>
          <input type="text" id="cmdDesc" value="${editing ? escapeHtml(editing.description || '') : ''}" placeholder="${UI.commands.editorPlaceholderDesc}" maxlength="100">
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>${UI.commands.editorLabelResponse}</label>
          <textarea id="cmdResponse" rows="3" placeholder="${UI.commands.editorPlaceholderResponse}">${editing ? escapeHtml(editing.response || '') : ''}</textarea>
        </div>
      </div>
    `,
    ctaLabel: editing ? UI.common.save : UI.commands.create,
    onOpen: (modal) => bindNameValidation(modal, editing),
    onSubmit: async (modal) => {
      const botId = store.get('activeBotId');
      const guildId = store.get('activeGuildId');
      const name = modal.querySelector('#cmdName').value.trim();
      const description = modal.querySelector('#cmdDesc').value.trim();
      const response = modal.querySelector('#cmdResponse').value;

      if (!name) { toast(UI.commands.editorLabelName, 'warn'); throw new Error(); }
      if (name.length < 2) { toast(UI.commands.minNameLength, 'warn'); throw new Error(); }

      try {
        if (editing) {
          await api.put(`/api/commands/${editing.id}`, { botId, guildId, name, description, response });
          toast(UI.toast.saved, 'success');
        } else {
          await api.post('/api/commands', { botId, guildId, name, description, response });
          toast(UI.commands.created, 'success');
        }
        await view.render(view.container);
      } catch (err) {
        const code = err.data?.error;
        const msg = err.data?.message || err.message;
        const mapped = UI.errors[code] || msg;
        toast(code === 'duplicate_name' || code === 'reserved_name'
          ? '⚠ ' + mapped
          : UI.common.error + ': ' + mapped, 'error');
        throw err;
      }
    },
  });
}

function bindNameValidation(modal, editing) {
  const nameEl = modal.querySelector('#cmdName');
  const hint = modal.querySelector('#cmdNameHint');
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  let t = null;

  nameEl.addEventListener('input', () => {
    clearTimeout(t);
    const raw = nameEl.value.trim();
    const sanitized = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

    if (raw && sanitized !== raw) {
      hint.textContent = UI.commands.editorNameSanitized + '"' + sanitized + '"';
      hint.style.color = 'var(--orange)';
    } else {
      hint.textContent = UI.commands.editorNameHint;
      hint.style.color = 'var(--muted)';
    }
    if (!sanitized) return;

    t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          botId, guildId, name: sanitized,
          ...(editing ? { excludeId: editing.id } : {}),
        });
        const result = await api.get(`/api/commands/check?${params}`);
        if (!result.valid && result.error === 'duplicate_name') {
          hint.textContent = UI.commands.editorNameDuplicate;
          hint.style.color = 'var(--red)';
        } else if (!result.valid && result.error === 'reserved_name') {
          hint.textContent = UI.commands.editorNameReserved;
          hint.style.color = 'var(--red)';
        } else if (result.valid) {
          hint.textContent = UI.commands.editorNameFree;
          hint.style.color = 'var(--green)';
        }
      } catch {}
    }, 400);
  });
}