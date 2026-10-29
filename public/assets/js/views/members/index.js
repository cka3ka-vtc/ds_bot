// public/assets/js/views/members/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { WORD } from '../../core/utils.js';
import { renderGrid } from './cards.js';
import { bindFilters } from './filters.js';

export default {
  container: null,
  state: { members: [], roles: [], search: '', roleFilter: null, statusFilter: 'all' },
  _outsideClick: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container, 'Выберите сервер');

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка участников...</span></div>';

    const [membersRes, rolesRes] = await Promise.allSettled([
      api.get(`/api/members?botId=${botId}&guildId=${guildId}`),
      api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`),
    ]);

    if (membersRes.status === 'fulfilled') {
      this.state.members = membersRes.value || [];
    } else {
      this.state.members = [];
      if (membersRes.reason?.data?.error === 'bot_offline') {
        return this._empty(container, 'Бот офлайн', 'Запустите бота или выберите другого');
      }
    }

    this.state.roles = (rolesRes.status === 'fulfilled' && Array.isArray(rolesRes.value))
      ? rolesRes.value : [];

    this._renderUI(container);
  },

  destroy() {
    if (this._outsideClick) {
      document.removeEventListener('mousedown', this._outsideClick);
      this._outsideClick = null;
    }
    this.container = null;
  },

  _renderUI(container) {
    const total = this.state.members.length;
    const activeCount = this.state.members.filter((m) => !m.left).length;
    const leftCount = total - activeCount;

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Участники</h1>
          <p>${activeCount} ${WORD.member(activeCount)} на сервере${leftCount ? ` · ${leftCount} покинули` : ''}</p>
        </div>
      </div>
      <div class="members-toolbar">
        <div class="search-input" style="max-width:340px;flex:1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="memSearch" placeholder="Поиск по имени...">
        </div>
        <div class="select-wrap" style="width:180px;">
          <select id="memStatusFilter" class="custom-select">
            <option value="all">Все</option>
            <option value="active">На сервере</option>
            <option value="left">Покинули</option>
          </select>
        </div>
        <div class="role-filter" id="memRoleFilter">
          <button type="button" class="role-filter-trigger" data-role-filter-trigger>
            <span class="role-filter-label empty" data-role-filter-label>Все роли</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="role-filter-popup" data-role-filter-popup hidden>
            <div class="role-filter-search">
              <input type="text" data-role-filter-search placeholder="Поиск по названию или ID...">
            </div>
            <div class="role-filter-list" data-role-filter-list></div>
          </div>
        </div>
        <span class="count" id="memCount"></span>
      </div>
      <div class="members-grid" id="memGrid"></div>
      <div class="empty-state" id="memEmpty" hidden>
        <i class="fa-solid fa-user-slash"></i>
        <strong>Никого не найдено</strong>
      </div>
    `;

    renderGrid(this);
    bindFilters(this);
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