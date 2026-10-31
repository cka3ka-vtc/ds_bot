// public/assets/js/views/commands/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { UI } from '/shared/ui-strings.js';
import { renderCommandsList } from './cards.js';
import { renderCommandEditor } from './editor.js';

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

    // route: #commands  |  #commands?edit=builtin:rank  |  #commands?edit=cmd_xxx  |  #commands?new=1
    const hash = location.hash.slice(1) || '';
    const [, queryStr] = hash.split('?');
    const params = new URLSearchParams(queryStr || '');
    const editId = params.get('edit');
    const isNew = params.get('new') === '1';

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

    if (isNew || editId) {
      return renderCommandEditor(this, container, { editId, isNew });
    }
    return this._renderList(container);
  },

  _renderList(container) {
    const total = this.state.builtin.length + this.state.custom.length;

    container.innerHTML = `
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
      <div class="commands-toolbar">
        <div class="tabs" role="tablist">
          <button class="tab ${this.state.filter === 'all' ? 'active' : ''}" data-filter="all">${UI.commands.tabAll} <span class="count">${total}</span></button>
          <button class="tab ${this.state.filter === 'builtin' ? 'active' : ''}" data-filter="builtin">${UI.commands.tabBuiltin} <span class="count">${this.state.builtin.length}</span></button>
          <button class="tab ${this.state.filter === 'custom' ? 'active' : ''}" data-filter="custom">${UI.commands.tabCustom} <span class="count">${this.state.custom.length}</span></button>
        </div>
        <div class="search-input" style="max-width:340px;flex:1;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="cmdSearch" placeholder="${UI.commands.searchPlaceholder}" value="${escapeAttr(this.state.search)}">
        </div>
        <label class="cmd-show-disabled">
          <input type="checkbox" id="cmdShowDisabled" ${this.state.showDisabled ? 'checked' : ''}>
          <span>Показывать выключенные</span>
        </label>
      </div>
      <div id="cmdCardsWrap"></div>
    `;

    this._renderCards();

    container.querySelectorAll('[data-filter]').forEach((tab) => {
      tab.addEventListener('click', () => {
        this.state.filter = tab.dataset.filter;
        container.querySelectorAll('[data-filter]').forEach((t) =>
          t.classList.toggle('active', t === tab));
        this._renderCards();
      });
    });

    const searchEl = container.querySelector('#cmdSearch');
    searchEl.addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      this._renderCards();
    });

    const showDisabledEl = container.querySelector('#cmdShowDisabled');
    showDisabledEl.addEventListener('change', () => {
      this.state.showDisabled = showDisabledEl.checked;
      this._renderCards();
    });

    container.querySelector('#newCmdBtn').addEventListener('click', () => {
      location.hash = 'commands?new=1';
    });
  },

  _renderCards() {
    const wrap = this.container.querySelector('#cmdCardsWrap');
    if (!wrap) return;
    renderCommandsList(this, wrap);
  },

  async _reload() {
    location.hash = 'commands';
    await this.render(this.container);
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

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}