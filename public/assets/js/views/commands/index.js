// public/assets/js/views/commands/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { WORD } from '../../core/utils.js';
import { renderTable } from './table.js';
import { openEditor } from './editor.js';

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
    this._renderUI();
  },

  _renderUI() {
    const total = this.state.builtin.length + this.state.custom.length;
    this.container.innerHTML = `
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
        <button class="tab ${this.state.filter === 'all' ? 'active' : ''}" data-filter="all">Все <span class="count">${total}</span></button>
        <button class="tab ${this.state.filter === 'builtin' ? 'active' : ''}" data-filter="builtin">Встроенные <span class="count">${this.state.builtin.length}</span></button>
        <button class="tab ${this.state.filter === 'custom' ? 'active' : ''}" data-filter="custom">Пользовательские <span class="count">${this.state.custom.length}</span></button>
      </div>
      <div class="table-wrap">
        <div class="table-toolbar">
          <div class="search-input" style="max-width:320px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="cmdSearch" placeholder="Поиск команды..." value="${this.state.search}">
          </div>
          <span class="count" id="cmdCount"></span>
        </div>
        <table class="tbl">
          <thead><tr>
            <th>Команда</th><th>Категория</th><th>Тип</th>
            <th style="text-align:right;">Действия</th>
          </tr></thead>
          <tbody id="cmdBody"></tbody>
        </table>
        <div class="empty-state" id="cmdEmpty" hidden>
          <i class="fa-solid fa-terminal"></i>
          <strong>Команды не найдены</strong>
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
    this.container.querySelector('#cmdSearch').addEventListener('input', (e) => {
      this.state.search = e.target.value.trim().toLowerCase();
      renderTable(this);
    });
    this.container.querySelector('#newCmdBtn').addEventListener('click', () => openEditor(this, null));
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