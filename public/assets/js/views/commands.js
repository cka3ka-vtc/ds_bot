// public/assets/js/views/commands.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';
import { escapeHtml, WORD } from '../core/utils.js';

export default {
  container: null,
  state: { builtin: [], custom: [], filter: 'all', search: '' },

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    try {
      const data = await api.get(`/api/commands?botId=${botId}&guildId=${guildId}`);
      this.state.builtin = data.builtin || [];
      this.state.custom = data.custom || [];
    } catch {
      this.state.builtin = [];
      this.state.custom = [];
    }

    this._renderUI(container);
  },

  _renderUI(container) {
    const total = this.state.builtin.length + this.state.custom.length;

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Команды</h1>
          <p>Слэш-команды, доступные на этом сервере</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="newCmdBtn">
            <i class="fa-solid fa-plus"></i> Новая команда
          </button>
        </div>
      </div>

      <div class="tabs" role="tablist" style="margin-bottom:16px;">
        <button class="tab active" data-filter="all">Все <span class="count">${total}</span></button>
        <button class="tab" data-filter="builtin">Встроенные <span class="count">${this.state.builtin.length}</span></button>
        <button class="tab" data-filter="custom">Пользовательские <span class="count">${this.state.custom.length}</span></button>
      </div>

      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-input" style="max-width:320px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="cmdSearch" placeholder="Поиск команды...">
          </div>
          <span class="count" id="cmdCount"></span>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Команда</th>
              <th>Категория</th>
              <th>Тип</th>
              <th style="text-align:right;">Действия</th>
            </tr>
          </thead>
          <tbody id="cmdBody"></tbody>
        </table>
        <div class="empty-state" id="cmdEmpty" hidden>
          <i class="fa-solid fa-terminal"></i>
          <strong>Команды не найдены</strong>
        </div>
      </div>
    `;

    this._renderRows();

    container.querySelectorAll('[data-filter]').forEach((tab) => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('[data-filter]').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        this.state.filter = tab.dataset.filter;
        this._renderRows();
      });
    });
    container.querySelector('#cmdSearch').addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this._renderRows();
    });
    container.querySelector('#newCmdBtn').addEventListener('click', () => this._openEditor(null));
  },

  _renderRows() {
    const body = this.container.querySelector('#cmdBody');
    const empty = this.container.querySelector('#cmdEmpty');
    const count = this.container.querySelector('#cmdCount');
    const f = this.state.filter;
    const q = this.state.search;

    const list = [];
    if (f !== 'custom') this.state.builtin.forEach((c) => list.push({ ...c, _src: 'builtin' }));
    if (f !== 'builtin') this.state.custom.forEach((c) => list.push({ ...c, _src: 'custom' }));

    const filtered = list.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q),
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
            ${c._src === 'custom' ? 'Custom' : 'Встроенная'}
          </span>
        </td>
        <td>
          <div class="row-actions">
            ${c._src === 'custom'
              ? `<button class="btn btn-icon btn-ghost" data-edit="${c.id}" title="Редактировать"><i class="fa-solid fa-gear"></i></button>
                 <button class="btn btn-icon btn-ghost" data-delete="${c.id}" title="Удалить"><i class="fa-solid fa-trash"></i></button>
                 <button class="toggle ${c.enabled ? 'on' : ''}" data-toggle="${c.id}" role="switch" aria-checked="${c.enabled}"></button>`
              : `<span class="badge online">Встроенная</span>`
            }
          </div>
        </td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => this._openEditor(b.dataset.edit)));
    body.querySelectorAll('[data-delete]').forEach((b) =>
      b.addEventListener('click', () => this._delete(b.dataset.delete)));
    body.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => this._toggle(b.dataset.toggle, b)));
  },

  _openEditor(id) {
    const editing = id ? this.state.custom.find((c) => c.id === id) : null;

    openModal({
      title: editing ? 'Редактирование команды' : 'Новая команда',
      subtitle: editing ? `/${editing.name}` : 'Слэш-команда с ответом',
      body: `
        <div class="form-row single">
          <div class="form-field">
            <label>Имя команды (без /)</label>
            <input type="text" id="cmdName" value="${editing ? escapeHtml(editing.name) : ''}"
                   placeholder="hello" maxlength="32">
            <span class="hint" id="cmdNameHint">Только буквы, цифры, _ и -</span>
          </div>
        </div>
        <div class="form-row single">
          <div class="form-field">
            <label>Описание</label>
            <input type="text" id="cmdDesc" value="${editing ? escapeHtml(editing.description || '') : ''}"
                   placeholder="Приветствие" maxlength="100">
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
      onOpen: (modal) => {
        const nameEl = modal.querySelector('#cmdName');
        const hint = modal.querySelector('#cmdNameHint');
        const botId = store.get('activeBotId');
        const guildId = store.get('activeGuildId');
        let checkTimer = null;

        nameEl.addEventListener('input', () => {
          clearTimeout(checkTimer);
          const raw = nameEl.value.trim();
          const sanitized = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

          if (raw && sanitized !== raw) {
            hint.textContent = 'Недопустимые символы будут удалены: → "' + sanitized + '"';
            hint.style.color = 'var(--orange)';
          } else {
            hint.textContent = 'Только буквы, цифры, _ и -';
            hint.style.color = 'var(--muted)';
          }

          if (!sanitized) return;
          checkTimer = setTimeout(async () => {
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
      },
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
            await api.put(`/api/commands/${editing.id}`, {
              botId, guildId, name, description, response,
            });
            toast('Сохранено', 'success');
          } else {
            await api.post('/api/commands', {
              botId, guildId, name, description, response,
            });
            toast('Создано', 'success');
          }
          await this.render(this.container);
        } catch (err) {
          const code = err.data?.error;
          const msg = err.data?.message || err.message;
          toast(
            code === 'duplicate_name' ? '⚠ ' + msg
            : code === 'invalid_name' ? '⚠ ' + msg
            : 'Ошибка: ' + msg,
            'error',
          );
          throw err;
        }
      },
    });
  },

  async _delete(id) {
    if (!confirm('Удалить команду?')) return;
    try {
      await api.del(`/api/commands/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
      toast('Удалено', 'success');
      await this.render(this.container);
    } catch (err) {
      toast('Ошибка: ' + (err.data?.error || err.message), 'error');
    }
  },

  async _toggle(id, btn) {
    const enabled = btn.classList.toggle('on');
    btn.setAttribute('aria-checked', String(enabled));
    try {
      await api.post(`/api/commands/${id}/toggle`, {
        botId: store.get('activeBotId'),
        guildId: store.get('activeGuildId'),
        enabled,
      });
    } catch (err) {
      btn.classList.toggle('on');
      toast('Ошибка', 'error');
    }
  },

  _empty(container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-terminal"></i>
        <strong>Выберите сервер</strong>
        <span>Сначала выберите сервер в сайдбаре</span>
      </div>`;
  },
};