// public/assets/js/views/settings/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, WORD } from '../../core/utils.js';
import { openRolePicker } from './rolePicker.js';
import { openChannelPicker } from './channelPicker.js';
import { chipHtml, bindChipRemove } from './chips.js';

export default {
  container: null,
  settings: null,
  roles: [],
  channels: [],

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    const [s, r, c] = await Promise.allSettled([
      api.get(`/api/guild-settings?botId=${botId}&guildId=${guildId}`),
      api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`),
      api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`),
    ]);

    this.settings = s.status === 'fulfilled'
      ? s.value
      : { logChannel: '', excludedRoles: [] };
    this.roles = (r.status === 'fulfilled' && Array.isArray(r.value)) ? r.value : [];
    this.channels = (c.status === 'fulfilled' && Array.isArray(c.value)) ? c.value : [];

    this._renderUI();
  },

  _renderUI() {
    const s = this.settings;
    const rolesMap = new Map(this.roles.map((r) => [r.id, r]));
    const excluded = Array.isArray(s.excludedRoles) ? s.excludedRoles : [];
    const logChannelName = this._channelName(s.logChannel);

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Настройки</h1>
          <p>Общие параметры сервера</p>
        </div>
      </div>

      <form class="settings-wrap" id="guildSettingsForm" style="max-width:100%;">
        <div class="settings-section">
          <h3>Каналы</h3>
          <p class="section-desc">Куда отправлять события и логи модерации</p>

          <div class="form-row single">
            <div class="form-field">
              <label>Канал логов</label>
              <input type="hidden" name="logChannel" value="${escapeHtml(s.logChannel || '')}">
              <button type="button" class="channel-picker-trigger ${s.logChannel ? '' : 'is-empty'}" id="logChannelTrigger">
                <i class="fa-solid fa-hashtag"></i>
                <span id="logChannelLabel">${escapeHtml(logChannelName || 'Не выбран')}</span>
                <i class="fa-solid fa-chevron-down" style="margin-left:auto;opacity:.5;"></i>
              </button>
              <span class="hint">Канал для логов модерации и событий</span>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Исключения из статистики</h3>
          <p class="section-desc">
            Роли, которые не учитываются в статистике и не попадают в «Участники».
            ${this.roles.length === 0
              ? '<br><strong style="color:var(--orange);">⚠ Бот офлайн — список ролей недоступен</strong>'
              : `Всего ${this.roles.length} ${WORD.role(this.roles.length)}.`}
          </p>
          <div class="exclusion-list" id="exclusionList">
            ${excluded.length === 0
              ? '<span class="exclusion-empty">Пока нет исключений</span>'
              : excluded.map((id) => chipHtml(id, rolesMap.get(id))).join('')}
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

    bindChipRemove(this);

    const addBtn = this.container.querySelector('#addRoleBtn');
    if (addBtn && this.roles.length > 0) {
      addBtn.addEventListener('click', () => openRolePicker(this));
    }

    const logTrigger = this.container.querySelector('#logChannelTrigger');
    logTrigger.addEventListener('click', () => openChannelPicker(this));

    this.container.querySelector('#guildSettingsForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this._save();
    });
  },

  /** Используется из rolePicker.js */
  addChip(roleId, role) {
    const list = this.container.querySelector('#exclusionList');
    if (!list) return;
    const empty = list.querySelector('.exclusion-empty');
    if (empty) empty.remove();
    if (list.querySelector(`[data-role-id="${roleId}"]`)) return;
    list.insertAdjacentHTML('beforeend', chipHtml(roleId, role));
    bindChipRemove(this);
  },

  /** Используется из channelPicker.js */
  setLogChannel(channelId, channelName) {
    const hidden = this.container.querySelector('input[name="logChannel"]');
    const label = this.container.querySelector('#logChannelLabel');
    const trigger = this.container.querySelector('#logChannelTrigger');
    if (hidden) hidden.value = channelId || '';
    if (label) label.textContent = channelName || 'Не выбран';
    if (trigger) trigger.classList.toggle('is-empty', !channelId);
  },

  _channelName(channelId) {
    if (!channelId) return null;
    const ch = this.channels.find((c) => c.id === channelId);
    return ch ? ch.name : channelId;
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