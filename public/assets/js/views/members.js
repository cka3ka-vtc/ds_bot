// public/assets/js/views/members.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';
import { escapeHtml, WORD, fmtNum } from '../core/utils.js';

export default {
  container: null,
  state: { members: [], search: '', roleFilter: '' },

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container, 'Выберите сервер');

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка участников...</span></div>';

    try {
      this.state.members = await api.get(`/api/members?botId=${botId}&guildId=${guildId}`);
    } catch (err) {
      this.state.members = [];
      if (err.data?.error === 'bot_offline') {
        return this._empty(container, 'Бот офлайн', 'Запустите бота или выберите другого');
      }
    }

    this._renderUI(container);
  },

  _renderUI(container) {
    const total = this.state.members.length;

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Участники</h1>
          <p>${total} ${WORD.member(total)} на сервере</p>
        </div>
      </div>
      <div class="members-toolbar">
        <div class="search-input" style="max-width:340px;flex:1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="memSearch" placeholder="Поиск по имени...">
        </div>
        <div class="select-wrap" style="width:180px;">
          <select id="memRoleFilter">
            <option value="">Все роли</option>
            <option value="admin">Администраторы</option>
            <option value="mod">Модераторы</option>
          </select>
        </div>
        <span class="count" id="memCount"></span>
      </div>
      <div class="members-grid" id="memGrid"></div>
      <div class="empty-state" id="memEmpty" hidden>
        <i class="fa-solid fa-user-slash"></i>
        <strong>Никого не найдено</strong>
      </div>
    `;

    this._renderGrid();

    container.querySelector('#memSearch').addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this._renderGrid();
    });
    container.querySelector('#memRoleFilter').addEventListener('change', (e) => {
      this.state.roleFilter = e.target.value;
      this._renderGrid();
    });
  },

  _renderGrid() {
    const grid = this.container.querySelector('#memGrid');
    const empty = this.container.querySelector('#memEmpty');
    const count = this.container.querySelector('#memCount');
    const q = this.state.search;
    const filter = this.state.roleFilter;

    const isAdmin = (m) => m.roles.some((r) => /admin|админ/i.test(r.name));
    const isMod = (m) => m.roles.some((r) => /mod|модер/i.test(r.name));

    const filtered = this.state.members.filter((m) => {
      const matchQ = !q ||
        m.username.toLowerCase().includes(q) ||
        (m.displayName || '').toLowerCase().includes(q);
      if (!matchQ) return false;
      if (filter === 'admin') return isAdmin(m);
      if (filter === 'mod') return isMod(m) && !isAdmin(m);
      return true;
    });

    if (!filtered.length) {
      grid.innerHTML = '';
      empty.hidden = false;
      count.textContent = `0 ${WORD.member(0)}`;
      return;
    }
    empty.hidden = true;
    count.textContent = `${filtered.length} из ${this.state.members.length}`;

    grid.innerHTML = filtered.slice(0, 200).map((m) => {
      const roleBadges = m.roles.slice(0, 2).map((r) => {
        const color = r.color && r.color !== '#000000' ? r.color : null;
        const style = color
          ? `background:${color}22;color:${color};`
          : 'background:var(--surface-3);color:var(--muted);';
        return `<span class="role-badge member" style="${style}">${escapeHtml(r.name)}</span>`;
      }).join('');
      return `
        <div class="member-card" data-user="${m.id}">
          <button class="member-settings-btn" type="button" data-edit="${m.id}">
            <i class="fa-solid fa-gear"></i>
          </button>
          <div class="member-head">
            <div class="member-avatar">
              <img src="${m.avatar}" alt="" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <div class="member-info">
              <div class="member-name">${escapeHtml(m.displayName || m.username)}</div>
              <div class="member-tag">@${escapeHtml(m.username)}</div>
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;min-height:20px;">
            ${roleBadges || '<span style="color:var(--muted);font-size:11px;">без ролей</span>'}
          </div>
          <div class="member-meta">
            <span>Ур. ${m.level}</span>
            <span>${m.warnings} ${WORD.record(m.warnings)}</span>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openEdit(btn.dataset.edit);
      }),
    );
  },

  _openEdit(userId) {
    const m = this.state.members.find((x) => x.id === userId);
    if (!m) return;
    openModal({
      title: 'Участник',
      subtitle: '@' + m.username,
      body: `
        <div class="form-row">
          <div class="form-field">
            <label>Уровень</label>
            <input type="text" id="mLevel" value="${m.level}">
          </div>
          <div class="form-field">
            <label>Предупреждения</label>
            <input type="text" id="mWarnings" value="${m.warnings}">
          </div>
        </div>
      `,
      ctaLabel: 'Сохранить',
      onSubmit: async (modal) => {
        const level = parseInt(modal.querySelector('#mLevel').value, 10) || 0;
        const warnings = parseInt(modal.querySelector('#mWarnings').value, 10) || 0;
        try {
          await api.put(`/api/members/${userId}`, {
            botId: store.get('activeBotId'),
            guildId: store.get('activeGuildId'),
            level, warnings,
          });
          toast('Сохранено', 'success');
          await this.render(this.container);
        } catch (err) {
          toast('Ошибка', 'error');
          throw err;
        }
      },
    });
  },

  _empty(container, title, text = 'Сначала выберите сервер в сайдбаре') {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-user-group"></i>
        <strong>${title}</strong>
        <span>${text}</span>
      </div>`;
  },
};