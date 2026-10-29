// public/assets/js/views/members/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { renderGrid } from './cards.js';
import { bindFilters } from './filters.js';
import { UI } from '/shared/ui-strings.js';

const M = UI.members;

export default {
  container: null,
  state: {
    items: [], total: 0, page: 1, limit: 24, pages: 1,
    counts: { active: 0, left: 0, all: 0 },
    search: '', roleFilter: null, statusFilter: 'all',
    roles: [],
  },
  _outsideClick: null,
  _searchTimer: null,
  _loading: false,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container, M.selectServerTitle, M.selectServerHint);

    this.state.page = 1;
    this.state.search = '';
    this.state.roleFilter = null;
    this.state.statusFilter = 'all';

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    const rolesP = api
      .get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`)
      .then((r) => (Array.isArray(r) ? r : []))
      .catch(() => []);

    try {
      await Promise.all([
        this._load(1),
        rolesP.then((roles) => { this.state.roles = roles; }),
      ]);
    } catch (err) {
      if (err?.data?.error === 'bot_offline') {
        return this._empty(container, M.botOfflineTitle, M.botOfflineHint);
      }
      return this._empty(container, M.loadFailedTitle, err.message);
    }

    this._renderUI(container);
  },

  destroy() {
    if (this._outsideClick) {
      document.removeEventListener('mousedown', this._outsideClick);
      this._outsideClick = null;
    }
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.container = null;
  },

  async _load(page) {
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return;
    if (this._loading) return;

    this._loading = true;
    try {
      const params = new URLSearchParams({
        botId, guildId,
        page: String(page),
        limit: String(this.state.limit),
        status: this.state.statusFilter,
      });
      if (this.state.search) params.set('search', this.state.search);
      if (this.state.roleFilter) params.set('roleId', this.state.roleFilter);

      const data = await api.get(`/api/members?${params}`);
      this.state.items = data.items || [];
      this.state.total = data.total || 0;
      this.state.page = data.page || 1;
      this.state.pages = data.pages || 1;
      this.state.counts = data.counts || { active: 0, left: 0, all: 0 };
    } finally {
      this._loading = false;
    }
  },

  async _reload(page = 1) {
    if (!this.container) return;
    const grid = this.container.querySelector('#memGrid');
    if (grid) { grid.style.opacity = '0.5'; grid.style.pointerEvents = 'none'; }
    try {
      await this._load(page);
      this._renderGridAndCount();
    } catch (err) {
      toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
    } finally {
      if (grid) { grid.style.opacity = ''; grid.style.pointerEvents = ''; }
    }
  },

  _renderGridAndCount() {
    if (!this.container) return;
    const grid = this.container.querySelector('#memGrid');
    const empty = this.container.querySelector('#memEmpty');
    const count = this.container.querySelector('#memCount');

    if (!this.state.items.length) {
      if (grid) grid.innerHTML = '';
      if (empty) empty.hidden = false;
      if (count) count.textContent = `0 ${UI.words.member(0)}`;
      this._renderPagination();
      return;
    }
    if (empty) empty.hidden = true;
    renderGrid(grid, this.state.items);
    this._bindCards();

    if (count) count.textContent = `${this.state.total} ${UI.words.member(this.state.total)}`;
    this._renderPagination();
  },

  _renderPagination() {
    const pagination = this.container?.querySelector('#memPagination');
    if (!pagination) return;
    if (this.state.pages <= 1) { pagination.hidden = true; return; }
    pagination.hidden = false;
    pagination.innerHTML = `
      <button type="button" class="btn btn-ghost btn-sm" data-page="prev" ${this.state.page <= 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i> ${M.pagination.prev}
      </button>
      <span class="page-info">${M.pagination.pageInfo(this.state.page, this.state.pages)}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-page="next" ${this.state.page >= this.state.pages ? 'disabled' : ''}>
        ${M.pagination.next} <i class="fa-solid fa-chevron-right"></i>
      </button>
    `;
    pagination.querySelector('[data-page="prev"]')?.addEventListener('click', () => {
      if (this.state.page > 1) this._reload(this.state.page - 1);
    });
    pagination.querySelector('[data-page="next"]')?.addEventListener('click', () => {
      if (this.state.page < this.state.pages) this._reload(this.state.page + 1);
    });
  },

  _bindCards() {
    const grid = this.container?.querySelector('#memGrid');
    if (!grid) return;
    grid.querySelectorAll('[data-open]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-edit]')) return;
        this._openDetail(card.dataset.open);
      });
    });
    grid.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._openDetail(btn.dataset.edit);
      });
    });
  },

  async _openDetail(userId) {
    const { openMemberDetail } = await import('./detail.js');
    await openMemberDetail(this, userId);
  },

  _renderUI(container) {
    const { counts } = this.state;

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>${M.title}</h1>
          <p>${M.pageSubtitle(counts.active, counts.left)}</p>
        </div>
      </div>
      <div class="members-toolbar">
        <div class="search-input" style="max-width:340px;flex:1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="memSearch" placeholder="${M.searchPlaceholder}" value="${escapeAttr(this.state.search)}">
        </div>
        <div class="select-wrap" style="width:180px;">
          <select id="memStatusFilter" class="custom-select">
            <option value="all" ${this.state.statusFilter === 'all' ? 'selected' : ''}>${M.statusAll}</option>
            <option value="active" ${this.state.statusFilter === 'active' ? 'selected' : ''}>${M.statusActive}</option>
            <option value="left" ${this.state.statusFilter === 'left' ? 'selected' : ''}>${M.statusLeft}</option>
          </select>
        </div>
        <div class="role-filter" id="memRoleFilter">
          <button type="button" class="role-filter-trigger" data-role-filter-trigger>
            <span class="role-filter-label ${this.state.roleFilter ? '' : 'empty'}" data-role-filter-label>
              ${this.state.roleFilter ? escapeText(this._roleName(this.state.roleFilter)) : M.roleFilterAll}
            </span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="role-filter-popup" data-role-filter-popup hidden>
            <div class="role-filter-search">
              <input type="text" data-role-filter-search placeholder="${M.roleFilterPlaceholder}">
            </div>
            <div class="role-filter-list" data-role-filter-list></div>
          </div>
        </div>
        <span class="count" id="memCount"></span>
      </div>
      <div class="members-grid" id="memGrid"></div>
      <div class="empty-state" id="memEmpty" hidden>
        <i class="fa-solid fa-user-slash"></i>
        <strong>${M.emptyTitle}</strong>
      </div>
      <div class="members-pagination" id="memPagination" hidden></div>
    `;

    this._renderGridAndCount();
    bindFilters(this);

    const searchEl = container.querySelector('#memSearch');
    searchEl.addEventListener('input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.state.search = searchEl.value.trim().toLowerCase();
        this._reload(1);
      }, 350);
    });

    container.querySelector('#memStatusFilter').addEventListener('change', (e) => {
      this.state.statusFilter = e.target.value;
      this._reload(1);
    });
  },

  _roleName(roleId) {
    const r = this.state.roles.find((x) => x.id === roleId);
    return r ? r.name : roleId;
  },

  _empty(container, title, text = M.selectServerHint) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-user-group"></i>
        <strong>${title}</strong>
        <span>${text}</span>
      </div>`;
  },
};

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function escapeText(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
  }[c]));
}