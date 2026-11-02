// public/assets/js/views/moderation/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { fmtNum } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  renderPage, renderTabs, renderSanctionList, renderPagination,
} from './render.js';
import { openPunishModal } from './punishModal.js';
import { openDetailModal } from './detailModal.js';

const M = UI.moderation;

export default {
  container: null,
  state: null,
  _searchTimer: null,
  _fetchToken: 0,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._empty(container);

    this.state = {
      tab: 'active',
      filters: { kind: '', since: 'all', search: '' },
      page: 1,
      data: { items: [], total: 0, pages: 1, counts: { activeMutes: 0, activeBans: 0, warns7d: 0, auto7d: 0 } },
    };

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>`;
    await this._fetch();
    this._renderUI();
  },

  destroy() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.container = null;
    this.state = null;
  },

  /* ═════════════ Загрузка ═════════════ */

  async _fetch() {
    if (!this.state) return;

    const myToken = ++this._fetchToken;

    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    const { tab, filters, page } = this.state;

    const params = new URLSearchParams({
      botId, guildId,
      page: String(page),
      limit: '50',
      status: tab === 'active' ? 'active' : 'all',
      since: filters.since,
      search: filters.search,
    });
    if (filters.kind) params.set('kind', filters.kind);

    try {
      const data = await api.get(`/api/moderation/actions?${params}`);
      if (myToken !== this._fetchToken) return;
      this.state.data = data;
    } catch (err) {
      if (myToken !== this._fetchToken) return;
      if (err.data?.error === 'bot_offline') throw err;
      toast(M.errors.loadFailed, 'error');
    }
  },

  /**
   * Точечный refresh.
   * options.tabs — пересобирать зону табов (счётчик активных).
   * KPI всегда патчится text-content без замены DOM — анимация kpiIn не переигрывается.
   */
  async _refresh({ tabs = false } = {}) {
    if (!this.container) return;
    try {
      await this._fetch();
      if (!this.container) return;
      this._updateKpiValues();
      if (tabs) this._renderTabsZone();
      this._renderListZone();
    } catch (err) {
      if (err.data?.error === 'bot_offline') return this._empty(this.container);
      toast(M.errors.loadFailed, 'error');
    }
  },

  /* ═════════════ Рендер ═════════════ */

  _renderUI() {
    this.container.innerHTML = renderPage(this);
    this._bindToolbar();
    this._bindTabs();
    this._bindListZone();
    this._bindPunishBtn();
  },

  /**
   * Патч KPI-значений. НЕ заменяет DOM карточек —
   * поэтому CSS-анимация .kpi-card { animation: kpiIn } не переигрывается.
   */
  _updateKpiValues() {
    const zone = this.container?.querySelector('#modKpiZone');
    if (!zone) return;
    const c = this.state.data.counts;
    const values = [c.activeMutes, c.activeBans, c.warns7d, c.auto7d];
    zone.querySelectorAll('.kpi-card').forEach((card, i) => {
      const v = card.querySelector('.kpi-value');
      if (!v) return;
      const next = fmtNum(values[i]);
      if (v.textContent !== next) v.textContent = next;
    });
  },

  _renderTabsZone() {
    const zone = this.container?.querySelector('#modTabsZone');
    if (!zone) return;
    zone.innerHTML = renderTabs(this);
    this._bindTabs();
  },

  _renderListZone() {
    const zone = this.container?.querySelector('#modListZone');
    if (!zone) return;
    zone.innerHTML =
      renderSanctionList(this.state.data.items, { tab: this.state.tab })
      + renderPagination(this.state.page, this.state.data.pages);
    this._bindListZone();
  },

  /* ═════════════ Биндинги ═════════════ */

  _bindToolbar() {
    const c = this.container;

    const searchEl = c.querySelector('#modSearch');
    searchEl?.addEventListener('input', () => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        if (!this.state) return;
        this.state.filters.search = searchEl.value.trim();
        this.state.page = 1;
        // поиск не меняет KPI и tabs → только list
        this._refresh();
      }, 350);
    });

    const kindEl = c.querySelector('#modKind');
    kindEl?.addEventListener('change', () => {
      this.state.filters.kind = kindEl.value;
      this.state.page = 1;
      this._refresh();
    });

    const sinceEl = c.querySelector('#modSince');
    sinceEl?.addEventListener('change', () => {
      this.state.filters.since = sinceEl.value;
      this.state.page = 1;
      this._refresh();
    });

    c.querySelector('#modResetFilters')?.addEventListener('click', () => {
      this.state.filters = { kind: '', since: 'all', search: '' };
      this.state.page = 1;
      this._syncToolbar();
      this._refresh();
    });
  },

  _bindTabs() {
    const c = this.container;
    c.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.tab;
        if (this.state.tab === next) return;
        this.state.tab = next;
        this.state.page = 1;
        // смена таба → обновить подсветку/бейдж табов + список
        this._refresh({ tabs: true });
      });
    });
  },

  _bindListZone() {
    const zone = this.container.querySelector('#modListZone');
    if (!zone) return;

    zone.querySelectorAll('.mod-row').forEach((row) => {
      if (row.tagName === 'SUMMARY') return;
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = row.dataset.id;
        const item = this.state.data.items.find((x) => x.id === id);
        if (item) openDetailModal(this, item);
      });
    });

    zone.querySelectorAll('[data-row-remove]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._removeAction(btn.dataset.rowRemove);
      });
    });

    zone.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.page;
        if (dir === 'prev' && this.state.page > 1) this.state.page--;
        else if (dir === 'next' && this.state.page < this.state.data.pages) this.state.page++;
        else return;
        this._refresh();
      });
    });
  },

  _bindPunishBtn() {
    this.container.querySelector('#modPunishBtn')?.addEventListener('click', async () => {
      const created = await openPunishModal();
      if (created) this._refresh({ tabs: true });
    });
  },

  _syncToolbar() {
    const c = this.container;
    const searchEl = c.querySelector('#modSearch');
    const kindEl = c.querySelector('#modKind');
    const sinceEl = c.querySelector('#modSince');
    if (searchEl) searchEl.value = this.state.filters.search;
    if (kindEl) kindEl.value = this.state.filters.kind;
    if (sinceEl) sinceEl.value = this.state.filters.since;
  },

  /* ═════════════ Снятие наказания ═════════════ */

  async _removeAction(id) {
    const item = this.state.data.items.find((x) => x.id === id);
    if (!item) return;
    const userLabel = item.displayName || item.username || item.userId;
    if (!confirm(M.actions.removeConfirm(M.kinds[item.kind] || item.kind, userLabel))) return;

    try {
      await api.del(`/api/moderation/actions/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
      toast(M.actions.removed, 'success');
      // После снятия: KPI (значения), tabs (бейдж активных), list
      await this._refresh({ tabs: true });
    } catch (err) {
      const code = err.data?.error;
      const msg = code === 'already_removed' ? M.actions.alreadyRemoved
        : code === 'cannot_revert_kick' ? M.actions.cannotRevert
        : (err.data?.details || err.message);
      toast(`${M.actions.removeFailed}: ${msg}`, 'error');
    }
  },

  /* ═════════════ Fallback ═════════════ */

  _empty(container) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-shield-halved"></i>
        <strong>${M.errors.botOffline}</strong>
        <span>${M.pageSubtitle}</span>
      </div>`;
  },
};