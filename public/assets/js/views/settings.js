// public/assets/js/views/settings.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';
import { escapeHtml, WORD } from '../core/utils.js';

export default {
  container: null,
  settings: null,
  roles: [],

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    const [settingsRes, rolesRes] = await Promise.allSettled([
      api.get(`/api/guild-settings?botId=${botId}&guildId=${guildId}`),
      api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`),
    ]);

    this.settings = settingsRes.status === 'fulfilled'
      ? settingsRes.value
      : { language: 'ru', welcome_channel: '', log_channel: '', excluded_roles: [] };

    this.roles = rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value)
      ? rolesRes.value
      : [];

    this._renderUI();
  },

  _renderUI() {
    const s = this.settings;
    const bots = store.get('bots');
    const activeBot = bots.find((b) => b.id === store.get('activeBotId'));
    const rolesMap = new Map(this.roles.map((r) => [r.id, r]));
    const excludedIds = Array.isArray(s.excluded_roles) ? s.excluded_roles : [];
    const rolesWord = WORD.role(this.roles.length);

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Настройки</h1>
          <p>Бот и параметры сервера</p>
        </div>
      </div>

      <div class="settings-wrap" style="max-width:100%;">
        <div class="settings-section">
          <h3>Активный бот</h3>
          <p class="section-desc">Чей бот используется для управления сервером</p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px;">
              <div style="width:40px;height:40px;border-radius:10px;overflow:hidden;flex-shrink:0;
                          display:grid;place-items:center;background:var(--accent-gradient);color:#fff;
                          font-weight:700;font-size:14px;position:relative;">
                ${activeBot?.avatarUrl
                  ? `<img src="${activeBot.avatarUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">`
                  : escapeHtml(activeBot?.name?.[0] || 'B')}
              </div>
              <div style="min-width:0;">
                <div style="font-size:14px;font-weight:700;color:var(--text);display:flex;gap:6px;align-items:center;">
                  ${escapeHtml(activeBot?.name || '—')}
                  ${activeBot?.isMain ? '<span class="badge-main">MAIN</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--muted);">ID: ${activeBot?.id || '—'}</div>
              </div>
            </div>
            <a href="#bots" class="btn btn-ghost">
              <i class="fa-solid fa-arrows-rotate"></i> Сменить бота
            </a>
          </div>
        </div>
      </div>

      <form class="settings-wrap" id="guildSettingsForm">
        <div class="settings-section">
          <h3>Основные</h3>
          <p class="section-desc">Работаем только со слэш-командами (префикс не используется)</p>
          <div class="form-row single">
            <div class="form-field">
              <label>Язык бота</label>
              <div class="select-wrap">
                <select name="language">
                  <option value="ru" ${s.language === 'ru' ? 'selected' : ''}>Русский</option>
                  <option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Каналы</h3>
          <p class="section-desc">ID каналов (числом из Discord)</p>
          <div class="form-row">
            <div class="form-field">
              <label>Канал приветствий</label>
              <input type="text" name="welcomeChannel" value="${escapeHtml(s.welcome_channel || '')}" placeholder="123456789">
            </div>
            <div class="form-field">
              <label>Канал логов</label>
              <input type="text" name="logChannel" value="${escapeHtml(s.log_channel || '')}" placeholder="987654321">
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Исключения из статистики</h3>
          <p class="section-desc">
            Роли, которые бот не учитывает в статистике и не отображает в «Участниках».
            ${this.roles.length === 0
              ? '<br><strong style="color:var(--orange);">⚠ Бот офлайн — список ролей недоступен</strong>'
              : `Доступно ${this.roles.length} ${rolesWord} на сервере.`}
          </p>
          <div class="exclusion-list" id="exclusionList">
            ${excludedIds.length === 0
              ? '<span class="exclusion-empty">Пока нет исключений</span>'
              : excludedIds.map((id) => this._chipHtml(id, rolesMap.get(id))).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="addRoleBtn" ${this.roles.length === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-plus"></i> Добавить роль
          </button>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-check"></i> Сохранить
          </button>
        </div>
      </form>
    `;

    this._bindChips();
    const addBtn = this.container.querySelector('#addRoleBtn');
    if (addBtn && this.roles.length > 0) {
      addBtn.addEventListener('click', () => this._openRolePicker());
    }
    this.container.querySelector('#guildSettingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this._save();
    });
  },

  _chipHtml(roleId, role) {
    const color = role?.color || '#5b6373';
    const name = role?.name || roleId;
    return `
      <span class="exclusion-chip" data-role-id="${roleId}">
        <span class="role-color-dot" style="background:${color};"></span>
        ${escapeHtml(name)}
        <button type="button" data-remove="${roleId}" aria-label="Удалить">×</button>
      </span>`;
  },

  _bindChips() {
    this.container.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.closest('.exclusion-chip').remove();
        this._updateEmptyState();
      });
    });
  },

  _updateEmptyState() {
    const list = this.container.querySelector('#exclusionList');
    if (!list) return;
    const hasChips = list.querySelectorAll('.exclusion-chip').length > 0;
    const empty = list.querySelector('.exclusion-empty');
    if (hasChips && empty) empty.remove();
    if (!hasChips && !empty) {
      list.insertAdjacentHTML('beforeend', '<span class="exclusion-empty">Пока нет исключений</span>');
    }
  },

  _openRolePicker() {
    const currentIds = new Set(
      [...this.container.querySelectorAll('.exclusion-chip')].map((c) => c.dataset.roleId),
    );
    const available = this.roles.filter((r) => !currentIds.has(r.id));

    if (available.length === 0) {
      openModal({
        title: 'Все роли уже исключены',
        subtitle: `${this.roles.length} ${WORD.role(this.roles.length)} на сервере, все добавлены`,
        body: `<div class="empty-state" style="padding:24px;">
                 <i class="fa-solid fa-check" style="color:var(--green);"></i>
                 <strong>Нечего добавлять</strong>
               </div>`,
        ctaLabel: 'Понятно',
      });
      return;
    }

    openModal({
      title: 'Добавить роль в исключения',
      subtitle: `Выберите из ${available.length} ${WORD.role(available.length)}`,
      body: `
        <div class="role-picker">
          ${available.map((r) => `
            <button type="button" class="role-picker-item" data-role-id="${r.id}">
              <span class="role-color-dot" style="background:${r.color || '#5b6373'};"></span>
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                ${escapeHtml(r.name)}
              </span>
              <span style="font-size:11px;color:var(--muted);">${r.memberCount} уч.</span>
            </button>`).join('')}
        </div>
      `,
      ctaLabel: 'Отмена',
      onOpen: (modal) => {
        modal.querySelectorAll('[data-role-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.roleId;
            const role = this.roles.find((r) => r.id === id);
            this._addChip(id, role);
            modal.remove();
          });
        });
      },
    });
  },

  _addChip(roleId, role) {
    const list = this.container.querySelector('#exclusionList');
    if (!list) return;
    const empty = list.querySelector('.exclusion-empty');
    if (empty) empty.remove();
    if (list.querySelector(`[data-role-id="${roleId}"]`)) return;
    list.insertAdjacentHTML('beforeend', this._chipHtml(roleId, role));
    this._bindChips();
  },

  async _save() {
    const form = this.container.querySelector('#guildSettingsForm');
    const fd = new FormData(form);
    const excludedRoles = [...this.container.querySelectorAll('.exclusion-chip')]
      .map((c) => c.dataset.roleId)
      .filter(Boolean);

    const payload = {
      botId: store.get('activeBotId'),
      guildId: store.get('activeGuildId'),
      language: fd.get('language')?.toString() || 'ru',
      welcomeChannel: fd.get('welcomeChannel')?.toString().trim() || null,
      logChannel: fd.get('logChannel')?.toString().trim() || null,
      excludedRoles,
    };

    const btn = form.querySelector('button[type="submit"]');
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Сохранение...';

    try {
      await api.put('/api/guild-settings', payload);
      toast('Настройки сохранены', 'success');
      this.settings = await api.get(`/api/guild-settings?botId=${payload.botId}&guildId=${payload.guildId}`);
    } catch (err) {
      toast('Ошибка: ' + (err.data?.error || err.message), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = html;
    }
  },

  _empty(container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-gear"></i>
        <strong>Выберите сервер</strong>
        <span>Сначала выберите сервер в сайдбаре</span>
      </div>`;
  },
};