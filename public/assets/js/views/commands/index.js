// public/assets/js/views/commands/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { UI } from '/shared/ui-strings.js';
import { renderTable } from './table.js';
import { openEditor } from './editor.js';

export default {
  container: null,
  state: {
    builtin: [],
    custom: [],
    channels: [],
    roles: [],
    filter: 'all',
    search: '',
    showDisabled: true,
  },

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    try {
      const [data, channels, roles] = await Promise.all([
        api.get(`/api/commands?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
      ]);
      this.state.builtin = data.builtin || [];
      this.state.custom = data.custom || [];
      this.state.channels = channels || [];
      this.state.roles = roles || [];
    } catch (err) {
      const code = err.data?.error;
      const msg = UI.errors[code] || err.data?.message || err.message || '';
      toast(UI.common.error + ': ' + msg, 'error');
      this.state.builtin = [];
      this.state.custom = [];
      this.state.channels = [];
      this.state.roles = [];
    }
    this._renderUI();
  },

  _renderUI() {
    const total = this.state.builtin.length + this.state.custom.length;

    this.container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>${UI.pages.commands.title}</h1>
          <p>${UI.pages.commands.subtitle}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="newCmdBtn">
            <i class="fa-solid fa-plus"></i> ${UI.commands.new}
          </button>
        </div>
      </div>
      <div class="tabs" role="tablist" style="margin-bottom:16px;">
        <button class="tab ${this.state.filter === 'all' ? 'active' : ''}" data-filter="all">${UI.commands.tabAll} <span class="count">${total}</span></button>
        <button class="tab ${this.state.filter === 'builtin' ? 'active' : ''}" data-filter="builtin">${UI.commands.tabBuiltin} <span class="count">${this.state.builtin.length}</span></button>
        <button class="tab ${this.state.filter === 'custom' ? 'active' : ''}" data-filter="custom">${UI.commands.tabCustom} <span class="count">${this.state.custom.length}</span></button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-input" style="max-width:320px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="cmdSearch" placeholder="${UI.commands.searchPlaceholder}" value="${this.state.search}">
          </div>
          <label class="cmd-show-disabled">
            <input type="checkbox" id="cmdShowDisabled" ${this.state.showDisabled ? 'checked' : ''}>
            <span>Показывать выключенные</span>
          </label>
          <span class="count" id="cmdCount"></span>
        </div>
        <table class="tbl">
          <thead><tr>
            <th>${UI.commands.tableCommand}</th>
            <th>${UI.commands.tableCategory}</th>
            <th>${UI.commands.tableType}</th>
            <th style="text-align:right;">${UI.commands.tableActions}</th>
          </tr></thead>
          <tbody id="cmdBody"></tbody>
        </table>
        <div class="empty-state" id="cmdEmpty" hidden>
          <i class="fa-solid fa-terminal"></i>
          <strong>${UI.commands.emptyTitle}</strong>
          <span>${UI.commands.emptyHint}</span>
        </div>
      </div>
    `;

    renderTable(this);

    this.container.querySelectorAll('[data-filter]').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.state.filter = tab.dataset.filter;
        this._renderUI();
      });
    });

    const searchEl = this.container.querySelector('#cmdSearch');
    searchEl.addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      renderTable(this);
    });

    const showDisabledEl = this.container.querySelector('#cmdShowDisabled');
    showDisabledEl.addEventListener('change', () => {
      this.state.showDisabled = showDisabledEl.checked;
      renderTable(this);
    });

    this.container.querySelector('#newCmdBtn').addEventListener('click', () => openEditor(this, null));
  },

  _empty(container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-terminal"></i>
        <strong>${UI.commands.noCommandsEmptyTitle}</strong>
        <span>${UI.commands.noCommandsEmptyHint}</span>
      </div>`;
  },
};