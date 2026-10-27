// public/assets/js/views/moderation.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';
import { escapeHtml, WORD, timeAgo } from '../core/utils.js';

const KIND_META = {
  warn: { icon: 'fa-triangle-exclamation', label: 'Предупреждение', color: 'orange' },
  mute: { icon: 'fa-microphone-slash',     label: 'Мут',            color: 'purple' },
  ban:  { icon: 'fa-ban',                  label: 'Бан',            color: 'red' },
  auto: { icon: 'fa-shield-halved',        label: 'Авто',           color: 'blue' },
};

export default {
  container: null,
  actions: [],

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    try {
      this.actions = await api.get(`/api/moderation/actions?botId=${botId}&guildId=${guildId}`);
    } catch {
      this.actions = [];
    }

    this._renderUI();
  },

  _renderUI() {
    const counts = { warn: 0, mute: 0, ban: 0, auto: 0 };
    this.actions.forEach((a) => { counts[a.kind] = (counts[a.kind] || 0) + 1; });

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Модерация</h1>
          <p>Журнал действий, наказания и правила</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="punishBtn">
            <i class="fa-solid fa-gavel"></i> Выдать наказание
          </button>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);">
        ${this._kpi('Предупреждения', counts.warn, 'fa-triangle-exclamation', 'orange')}
        ${this._kpi('Муты', counts.mute, 'fa-microphone-slash', 'purple')}
        ${this._kpi('Баны', counts.ban, 'fa-ban', 'red')}
        ${this._kpi('Автодействия', counts.auto, 'fa-shield-halved', 'blue')}
      </div>

      <div class="mod-layout">
        <div class="card">
          <div class="card-head">
            <div>
              <span class="card-title">Журнал действий</span>
              <span class="card-sub" id="logCount">${this.actions.length} ${WORD.record(this.actions.length)}</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <div class="search-input" style="min-width:200px;">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="modSearch" placeholder="Поиск...">
              </div>
              <div class="select-wrap" style="width:150px;">
                <select id="modKindFilter">
                  <option value="">Все типы</option>
                  <option value="warn">Предупреждения</option>
                  <option value="mute">Муты</option>
                  <option value="ban">Баны</option>
                  <option value="auto">Авто</option>
                </select>
              </div>
            </div>
          </div>
          <div class="card-body" style="padding:0;" id="logList"></div>
        </div>
        ${this._renderActive()}
      </div>
    `;

    this._renderList();

    this.container.querySelector('#modSearch').addEventListener('input', () => this._filter());
    this.container.querySelector('#modKindFilter').addEventListener('change', () => this._filter());
    this.container.querySelector('#punishBtn').addEventListener('click', () => this._openPunishModal());
  },

  _kpi(label, value, icon, color) {
    return `
      <div class="kpi-card">
        <div class="kpi-head">
          <span class="kpi-label">${label}</span>
          <span class="kpi-icon ${color}"><i class="fa-solid ${icon}"></i></span>
        </div>
        <div class="kpi-value">${value}</div>
      </div>`;
  },

  _renderActive() {
    const now = Math.floor(Date.now() / 1000);
    const active = this.actions.filter((a) =>
      (!a.expires_at || a.expires_at > now) &&
      ['warn', 'mute', 'ban'].includes(a.kind),
    );

    const mutes = active.filter((a) => a.kind === 'mute');
    const bans  = active.filter((a) => a.kind === 'ban');
    const warns = active.filter((a) => a.kind === 'warn');

    return `
      <div class="card">
        <div class="card-head">
          <div>
            <span class="card-title">Активные сейчас</span>
          </div>
          <button class="btn-link" type="button" data-open-all>
            Все <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
        <div class="active-lists">
          ${this._activeSection('Муты', mutes, 'purple', 'fa-microphone-slash')}
          ${this._activeSection('Баны', bans, 'red', 'fa-ban')}
          ${this._activeSection('Предупреждения', warns, 'orange', 'fa-triangle-exclamation')}
        </div>
      </div>
    `;
  },

  _activeSection(title, items, color, icon) {
    const itemsHtml = items.length
      ? items.slice(0, 4).map((a) => {
          const shortId = (a.user_id || '').slice(-2).toUpperCase();
          const expiresText = a.expires_at
            ? `· до ${new Date(a.expires_at * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
            : '· бессрочно';
          return `
            <div class="active-list-item">
              <div class="active-list-avatar" style="background:var(--${color});">${escapeHtml(shortId)}</div>
              <div class="active-list-info">
                <div class="active-list-name">&lt;@${escapeHtml(a.user_id)}&gt;</div>
                <div class="active-list-meta">${escapeHtml(a.reason || 'без причины')} ${expiresText}</div>
              </div>
            </div>`;
        }).join('')
      : `<div class="active-list-empty">Нет</div>`;

    return `
      <div class="active-list-section">
        <h4>
          <span><i class="fa-solid ${icon}" style="color:var(--${color});margin-right:6px;font-size:11px;"></i>${title}</span>
          <span class="count">${items.length}</span>
        </h4>
        ${itemsHtml}
      </div>`;
  },

  _renderList() {
    const el = this.container.querySelector('#logList');
    if (!this.actions.length) {
      el.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-shield-halved"></i>
          <strong>Журнал пуст</strong>
          <span>Наказания будут появляться здесь</span>
        </div>`;
      return;
    }

    el.innerHTML = this.actions.map((a) => {
      const meta = KIND_META[a.kind] || { icon: 'fa-circle', label: a.kind };
      const time = new Date(a.created_at * 1000).toLocaleString('ru-RU');
      const expires = a.expires_at
        ? `<span>· истекает ${new Date(a.expires_at * 1000).toLocaleString('ru-RU')}</span>`
        : '';
      return `
        <div class="mod-entry" data-kind="${a.kind}" data-searchable="${(a.user_id + ' ' + (a.reason || '')).toLowerCase()}">
          <div class="mod-entry-body">
            <div class="mod-entry-title">
              <strong>&lt;@${a.user_id}&gt;</strong> — ${meta.label.toLowerCase()}
            </div>
            <div class="mod-entry-meta">
              <span>${escapeHtml(a.reason || 'без причины')}</span>
              ${expires}
            </div>
          </div>
          <span class="mod-entry-time">${time}</span>
          <button class="btn btn-icon btn-ghost" data-remove="${a.id}" title="Снять" style="margin-left:8px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>`;
    }).join('');

    el.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => this._remove(btn.dataset.remove));
    });
  },

  _filter() {
    const q = this.container.querySelector('#modSearch').value.trim().toLowerCase();
    const kind = this.container.querySelector('#modKindFilter').value;
    let visible = 0;
    this.container.querySelectorAll('.mod-entry').forEach((row) => {
      const matchQ = !q || row.dataset.searchable.includes(q);
      const matchK = !kind || row.dataset.kind === kind;
      const show = matchQ && matchK;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    this.container.querySelector('#logCount').textContent = `${visible} ${WORD.record(visible)}`;
  },

  async _remove(id) {
    if (!confirm('Снять наказание?')) return;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    try {
      await api.del(`/api/moderation/actions/${id}?botId=${botId}&guildId=${guildId}`);
      toast('Наказание снято', 'success');
      await this.render(this.container);
    } catch (err) {
      toast('Ошибка: ' + (err.data?.error || err.message), 'error');
    }
  },

  _openPunishModal() {
    openModal({
      title: 'Новое наказание',
      subtitle: 'Выдать предупреждение, мут или бан',
      body: `
        <div class="form-row">
          <div class="form-field">
            <label>ID пользователя</label>
            <input type="text" id="pUserId" placeholder="123456789">
          </div>
          <div class="form-field">
            <label>Тип</label>
            <div class="select-wrap">
              <select id="pKind">
                <option value="warn">Предупреждение</option>
                <option value="mute">Мут</option>
                <option value="ban">Бан</option>
              </select>
            </div>
          </div>
        </div>
        <div class="form-row single">
          <div class="form-field">
            <label>Причина</label>
            <input type="text" id="pReason" placeholder="Спам">
          </div>
        </div>
        <div class="form-row single">
          <div class="form-field">
            <label>Длительность (мин, пусто = навсегда)</label>
            <input type="text" id="pDuration" placeholder="60">
          </div>
        </div>
      `,
      ctaLabel: 'Выдать',
      onSubmit: async (modal) => {
        const botId = store.get('activeBotId');
        const guildId = store.get('activeGuildId');
        const userId = modal.querySelector('#pUserId').value.trim();
        const kind = modal.querySelector('#pKind').value;
        const reason = modal.querySelector('#pReason').value.trim();
        const dur = modal.querySelector('#pDuration').value.trim();
        if (!userId) { toast('Введите ID', 'warn'); throw new Error(); }
        try {
          await api.post('/api/moderation/actions', {
            botId, guildId, userId, kind, reason,
            durationMinutes: dur ? parseInt(dur, 10) : null,
          });
          toast('Наказание выдано', 'success');
          await this.render(this.container);
        } catch (err) {
          toast('Ошибка: ' + (err.data?.error || err.message), 'error');
          throw err;
        }
      },
    });
  },

  _empty(container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shield-halved"></i>
        <strong>Выберите сервер</strong>
        <span>Сначала выберите сервер в сайдбаре</span>
      </div>`;
  },
};