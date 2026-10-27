// public/assets/js/views/moderation/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { escapeHtml, WORD } from '../../core/utils.js';
import { renderLogList } from './log.js';
import { renderActiveSections } from './active.js';
import { openPunishModal } from './punishModal.js';

const KIND_META = {
  warn: { icon: 'fa-triangle-exclamation', label: 'Предупреждение', color: 'orange' },
  mute: { icon: 'fa-microphone-slash', label: 'Мут', color: 'purple' },
  ban:  { icon: 'fa-ban', label: 'Бан', color: 'red' },
  auto: { icon: 'fa-shield-halved', label: 'Авто', color: 'blue' },
};

export { KIND_META };

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
    } catch { this.actions = []; }

    this._renderUI();
  },

  _renderUI() {
    const counts = { warn: 0, mute: 0, ban: 0, auto: 0 };
    this.actions.forEach((a) => { counts[a.kind] = (counts[a.kind] || 0) + 1; });

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Модерация</h1>
          <p>Журнал действий, наказания и права</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="punishBtn">
            <i class="fa-solid fa-gavel"></i> Выдать наказание
          </button>
        </div>
      </div>
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);">
        ${kpi('Предупреждения', counts.warn, 'fa-triangle-exclamation', 'orange')}
        ${kpi('Муты', counts.mute, 'fa-microphone-slash', 'purple')}
        ${kpi('Баны', counts.ban, 'fa-ban', 'red')}
        ${kpi('Автодействия', counts.auto, 'fa-shield-halved', 'blue')}
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
        ${renderActiveSections(this.actions)}
      </div>
    `;

    renderLogList(this);

    this.container.querySelector('#modSearch').addEventListener('input', () => renderLogList(this));
    this.container.querySelector('#modKindFilter').addEventListener('change', () => renderLogList(this));
    this.container.querySelector('#punishBtn').addEventListener('click', () => openPunishModal(this));
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

function kpi(label, value, icon, color) {
  return `<div class="kpi-card">
    <div class="kpi-head">
      <span class="kpi-label">${label}</span>
      <span class="kpi-icon ${color}"><i class="fa-solid ${icon}"></i></span>
    </div>
    <div class="kpi-value">${value}</div>
  </div>`;
}