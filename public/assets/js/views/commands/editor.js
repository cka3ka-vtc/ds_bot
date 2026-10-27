// public/assets/js/views/commands/editor.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml } from '../../core/utils.js';

export function openEditor(view, id) {
  const editing = id ? view.state.custom.find((c) => c.id === id) : null;

  openModal({
    title: editing ? 'Редактирование команды' : 'Новая команда',
    subtitle: editing ? `/${editing.name}` : 'Слэш-команда сервера',
    body: `
      <div class="form-row single">
        <div class="form-field">
          <label>Имя команды (без /)</label>
          <input type="text" id="cmdName" value="${editing ? escapeHtml(editing.name) : ''}" placeholder="hello" maxlength="32">
          <span class="hint" id="cmdNameHint">Только буквы, цифры, _ и -</span>
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>Описание</label>
          <input type="text" id="cmdDesc" value="${editing ? escapeHtml(editing.description || '') : ''}" placeholder="Краткое описание" maxlength="100">
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>Ответ</label>
          <textarea id="cmdResponse" rows="3" placeholder="Привет, {user}!">${editing ? escapeHtml(editing.response || '') : ''}</textarea>
        </div>
      </div>
    `,
    ctaLabel: editing ? 'Сохранить' : 'Создать',
    onOpen: (modal) => bindNameValidation(modal, editing),
    onSubmit: async (modal) => {
      const botId = store.get('activeBotId');
      const guildId = store.get('activeGuildId');
      const name = modal.querySelector('#cmdName').value.trim();
      const description = modal.querySelector('#cmdDesc').value.trim();
      const response = modal.querySelector('#cmdResponse').value;

      if (!name) { toast('Введите имя', 'warn'); throw new Error(); }
      if (name.length < 2) { toast('Минимум 2 символа', 'warn'); throw new Error(); }

      try {
        if (editing) {
          await api.put(`/api/commands/${editing.id}`, { botId, guildId, name, description, response });
          toast('Сохранено', 'success');
        } else {
          await api.post('/api/commands', { botId, guildId, name, description, response });
          toast('Создано', 'success');
        }
        await view.render(view.container);
      } catch (err) {
        const code = err.data?.error;
        const msg = err.data?.message || err.message;
        toast(code === 'duplicate_name' ? '⚠ ' + msg : 'Ошибка: ' + msg, 'error');
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
      hint.textContent = 'Символы будут удалены: → "' + sanitized + '"';
      hint.style.color = 'var(--orange)';
    } else {
      hint.textContent = 'Только буквы, цифры, _ и -';
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
          hint.textContent = '⚠ Команда с таким именем уже существует';
          hint.style.color = 'var(--red)';
        } else if (result.valid) {
          hint.textContent = '✓ Имя свободно';
          hint.style.color = 'var(--green)';
        }
      } catch {}
    }, 400);
  });
}