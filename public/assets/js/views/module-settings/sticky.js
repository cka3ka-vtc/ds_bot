// public/assets/js/views/module-settings/sticky.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  channelPickerHTML, bindChannelPicker,
} from './pickers.js';
import { MessageEditor, emptyMessageConfig } from './message-editor.js';
import { mergeStickyConfig } from '/shared/sticky-config.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../components/moduleBanner.js';

const S = UI.sticky;

/* ═════════════════ Хелперы ═════════════════ */

function channelName(channels, channelId) {
  const ch = channels.find((c) => c.id === channelId);
  return ch?.name || channelId;
}

/* ═════════════════ Список ═════════════════ */

function renderList(items, search, channels) {
  const q = (search || '').trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => {
        const name = channelName(channels, it.channelId);
        return it.name.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      })
    : items;

  if (!filtered.length) {
    return `<div class="empty-state">
      <i class="fa-solid fa-thumbtack"></i>
      <strong>${q ? S.emptySearchTitle : S.emptyTitle}</strong>
      <span>${q ? S.emptySearchHint : S.emptyHint}</span>
    </div>`;
  }

  return `<div class="rule-grid">
    ${filtered.map((it) => renderCard(it, channels)).join('')}
  </div>`;
}

function renderCard(item, channels) {
  const chName = channelName(channels, item.channelId);
  const published = !!item.lastMessageId;

  const metaRow = published
    ? `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--green"></span>
         <span>${S.card.published} · ${timeAgo(item.updatedAt)}</span>
       </div>`
    : `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--gray"></span>
         <span>${S.card.notPublished}</span>
       </div>`;

  return `
    <div class="rule-card ${item.enabled ? '' : 'is-off'}" data-id="${escapeHtml(item.id)}">
      <div class="rule-card-header">
        <div class="rule-icon-wrap">
          <i class="fa-solid fa-thumbtack"></i>
        </div>
        <div class="rule-title-wrap">
          <div class="rule-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="rule-channel-name">
            <i class="fa-solid fa-hashtag"></i>
            <span>${escapeHtml(chName)}</span>
          </div>
        </div>
        <button type="button" class="toggle ${item.enabled ? 'on' : ''}"
                data-action="toggle" role="switch"
                aria-checked="${item.enabled}"
                title="${item.enabled ? S.actions.disable : S.actions.enable}"></button>
      </div>

      <div class="rule-card-body">
        ${metaRow}
      </div>

      <div class="rule-card-footer">
        <div class="rule-actions-row">
          <button type="button" class="rule-act-btn rule-act-btn--primary" data-action="edit"
                  title="${S.actions.edit}" aria-label="${S.actions.edit}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="rule-act-btn" data-action="duplicate"
                  title="${S.actions.duplicate}" aria-label="${S.actions.duplicate}">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button type="button" class="rule-act-btn rule-act-btn--danger" data-action="delete"
                  title="${S.actions.remove}" aria-label="${S.actions.remove}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ═════════════════ Редактор ═════════════════ */

function setChannelStatus(el, status, tooltip) {
  if (!el) return;
  el.className = 'channel-status ' + status;
  const icons = {
    empty: 'fa-circle-minus',
    checking: 'fa-circle-notch fa-spin',
    ok: 'fa-circle-check',
    error: 'fa-circle-xmark',
  };
  el.innerHTML = `<i class="fa-solid ${icons[status] || icons.empty}"></i>`;
  if (tooltip) el.setAttribute('data-tooltip', tooltip);
  else el.removeAttribute('data-tooltip');
}

function renderEditor(item, channels, bot) {
  const isEdit = !!item?.id;
  const draft = item || {
    name: '',
    channelId: '',
    messageConfig: mergeStickyConfig(emptyMessageConfig()),
    enabled: true,
  };

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules?sub=sticky" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К списку
          </a>
          <h1>${isEdit ? S.editor.editTitle : S.editor.createTitle}</h1>
          <p>${S.editor.subtitle}</p>
        </div>
      </div>

      <div class="gr-settings">
        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${S.editor.nameLabel}</h3>
                <p>${S.editor.nameHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${S.editor.nameLabel}</label>
                <input type="text" class="input" id="stickyName" maxlength="80"
                       placeholder="${escapeHtml(S.editor.namePlaceholder)}"
                       value="${escapeHtml(draft.name || '')}">
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${S.editor.channelLabel}</h3>
                <p>${S.editor.channelHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${S.editor.channelLabel}</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status
                       data-tooltip="${escapeHtml(S.editor.channelStatus.empty)}">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'sticky_channel' })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${S.editor.messageTitle}</h3>
              <p>${S.editor.messageSubtitle}</p>
            </div>
          </div>
          <div class="gr-section-body">
            <div data-message-editor-container></div>
          </div>
        </section>
      </div>

      <div class="module-page-savebar">
        <a href="#modules?sub=sticky" class="btn btn-ghost">Отмена</a>
        ${isEdit ? `
          <button type="button" class="btn btn-danger" data-delete>
            <i class="fa-solid fa-trash"></i> Удалить
          </button>
        ` : ''}
        <button type="button" class="btn btn-primary" data-save>
          <i class="fa-solid fa-check"></i> ${isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </div>
  `;
}

/* ═════════════════ Модуль ═════════════════ */

export default {
  container: null,
  state: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) return this._emptyNoServer(container);

    const hash = location.hash.slice(1);
    const [, qs] = hash.split('?');
    const params = new URLSearchParams(qs || '');
    const editId = params.get('id');
    const isNew = params.get('new') === '1';

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>`;

    let items = [];
    let channels = [];
    let moduleEnabled = true;
    try {
      const [listRes, chsRes, modsRes] = await Promise.all([
        api.get(`/api/sticky?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules?botId=${botId}&guildId=${guildId}`).catch(() => []),
      ]);
      items = listRes;
      channels = chsRes;
      const m = (modsRes || []).find((x) => x.key === 'sticky');
      moduleEnabled = !!m?.enabled;
    } catch (err) {
      return this._emptyError(container, err.message);
    }

    const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    if (isNew || editId) {
      const item = editId ? items.find((x) => x.id === editId) : null;
      if (editId && !item) return this._emptyError(container, 'Сообщение не найдено');
      this.state = { botId, guildId, bot, channels, item, isNew, moduleEnabled };
      container.innerHTML = renderEditor(item, channels, bot);
      this._bindEditor();
      return;
    }

    this.state = { botId, guildId, items, channels, search: '', moduleEnabled };
    container.innerHTML = this._renderListView();
    this._bindList();
  },

  destroy() {
    if (this.state?.editor) {
      try { this.state.editor.destroy(); } catch {}
    }
    this.state = null;
    this.container = null;
  },

  _renderListView() {
    const items = this.state.items;
    const moduleOff = this.state.moduleEnabled === false;
    return `
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К модулям
          </a>
          <h1>${S.pageTitle}</h1>
          <p>${S.pageSubtitle}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="stickyCreateBtn" type="button">
            <i class="fa-solid fa-plus"></i> ${S.createBtn}
          </button>
        </div>
      </div>

      ${moduleOff ? renderModuleOffBanner({
        moduleKey: 'sticky',
        moduleName: 'Липнущее сообщение',
        hint: 'Сообщения не будут переопубликовываться, пока модуль выключен.',
      }) : ''}

      <div class="rule-toolbar">
        <div class="search-input" style="flex:1;max-width:380px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="stickySearch" placeholder="${S.searchPlaceholder}"
                 value="${escapeHtml(this.state.search)}">
        </div>
        <span class="rule-count">${items.length} всего</span>
      </div>

      <div id="stickyListZone">
        ${renderList(items, this.state.search, this.state.channels)}
      </div>
    `;
  },

  _bindList() {
    const c = this.container;

    c.querySelector('#stickyCreateBtn')?.addEventListener('click', () => {
      location.hash = 'modules?sub=sticky&new=1';
    });

    bindModuleOffBanner({
      container: c,
      botId: this.state.botId,
      guildId: this.state.guildId,
      moduleKey: 'sticky',
      onEnabled: () => { this.state.moduleEnabled = true; },
    });

    const searchEl = c.querySelector('#stickySearch');
    let timer = null;
    searchEl?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.search = searchEl.value;
        c.querySelector('#stickyListZone').innerHTML =
          renderList(this.state.items, this.state.search, this.state.channels);
        this._bindCards();
      }, 250);
    });

    this._bindCards();
  },

  _bindCards() {
    const zone = this.container.querySelector('#stickyListZone');
    if (!zone) return;

    zone.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.rule-card').dataset.id;
        location.hash = `modules?sub=sticky&id=${encodeURIComponent(id)}`;
      });
    });

    zone.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._toggle(btn.closest('.rule-card').dataset.id);
      });
    });

    zone.querySelectorAll('[data-action="duplicate"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._duplicate(btn.closest('.rule-card').dataset.id);
      });
    });

    zone.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._delete(btn.closest('.rule-card').dataset.id);
      });
    });
  },

  async _toggle(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) return;
    try {
      await api.post(`/api/sticky/${id}/toggle`, {
        botId: this.state.botId,
        guildId: this.state.guildId,
        enabled: !item.enabled,
      });
      item.enabled = !item.enabled;
      toast(item.enabled ? S.toast.enabled : S.toast.disabled, 'success');
      await this._reloadList();
    } catch (err) {
      const code = err.data?.error;
      if (code === 'channel_already_has_sticky') toast(S.toast.channelConflict, 'warn');
      else toast(`${S.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _duplicate(id) {
    try {
      await api.post(`/api/sticky/${id}/duplicate?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(S.toast.duplicated, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${S.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _delete(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) return;
    if (!confirm(S.actions.removeConfirm(item.name))) return;
    try {
      await api.del(`/api/sticky/${id}?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(S.toast.deleted, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${S.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _reloadList() {
    try {
      const [items, mods] = await Promise.all([
        api.get(`/api/sticky?botId=${this.state.botId}&guildId=${this.state.guildId}`),
        api.get(`/api/modules?botId=${this.state.botId}&guildId=${this.state.guildId}`).catch(() => []),
      ]);
      this.state.items = items;
      const m = (mods || []).find((x) => x.key === 'sticky');
      this.state.moduleEnabled = !!m?.enabled;
      this.container.innerHTML = this._renderListView();
      this._bindList();
    } catch {
      toast(S.errors.loadFailed, 'error');
    }
  },

  _bindEditor() {
    const c = this.container;
    const state = this.state;
    const { botId, guildId, channels, item, bot } = state;
    const draft = item || { name: '', channelId: '', messageConfig: null };

    const nameEl = c.querySelector('#stickyName');
    const statusEl = c.querySelector('[data-channel-status]');

    const checkPermissions = async (channel) => {
      if (!channel) {
        setChannelStatus(statusEl, 'empty', S.editor.channelStatus.empty);
        return;
      }
      setChannelStatus(statusEl, 'checking', S.editor.channelStatus.checking(channel.name));
      try {
        const perms = await api.get(
          `/api/guilds/channels/${channel.id}/permissions?botId=${botId}&guildId=${guildId}`,
        );
        if (!perms.channelExists) {
          setChannelStatus(statusEl, 'error', S.editor.channelStatus.notFound);
          return;
        }
        const missing = [];
        if (!perms.canViewChannel) missing.push('Просмотр канала');
        if (!perms.canSend) missing.push('Отправка сообщений');
        if (missing.length === 0) setChannelStatus(statusEl, 'ok', S.editor.channelStatus.ok);
        else setChannelStatus(statusEl, 'error', S.editor.channelStatus.missing(missing.join(', ')));
      } catch {
        setChannelStatus(statusEl, 'error', S.editor.channelStatus.checkFailed);
      }
    };

    const picker = bindChannelPicker(c, {
      id: 'sticky_channel',
      channels,
      onSelect: async (ch) => {
        draft.channelId = ch?.id || '';
        await checkPermissions(ch);
      },
    });
    if (draft.channelId) {
      const ch = channels.find((x) => x.id === draft.channelId);
      if (ch) {
        picker?.setValue?.(ch);
        checkPermissions(ch);
      }
    }

    const editorContainer = c.querySelector('[data-message-editor-container]');
    const initial = draft.messageConfig
      ? mergeStickyConfig(draft.messageConfig)
      : mergeStickyConfig(emptyMessageConfig());
    const editor = new MessageEditor(editorContainer, initial, {
      bot, roles: [], context: 'sticky', presetKey: null, guildId, botId,
    });
    editor.mount();
    state.editor = editor;

    c.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      draft.name = (nameEl?.value || '').trim();
      if (!draft.name) return toast(S.toast.needName, 'warn');
      if (!draft.channelId) return toast(S.toast.needChannel, 'warn');

      const cfg = editor.getConfig();
      const hasContent = !!(cfg.title || cfg.subtitle || (cfg.blocks || []).length);
      if (!hasContent) return toast(S.toast.needContent, 'warn');

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

      try {
        if (item?.id) {
          await api.put(`/api/sticky/${item.id}`, {
            botId, guildId,
            name: draft.name, channelId: draft.channelId, messageConfig: cfg,
          });
          toast(S.toast.updated, 'success');
        } else {
          await api.post('/api/sticky', {
            botId, guildId,
            name: draft.name, channelId: draft.channelId, messageConfig: cfg,
          });
          toast(S.toast.created, 'success');
        }
        location.hash = 'modules?sub=sticky';
      } catch (err) {
        const code = err.data?.error;
        const msg = code === 'channel_already_has_sticky' ? S.toast.channelConflict
          : code === 'no_send_permission' ? S.toast.noSendPermission
          : code === 'invalid_channel' ? S.toast.invalidChannel
          : (err.data?.error || err.message);
        toast(msg, 'error');
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    c.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!item?.id) return;
      if (!confirm(S.actions.removeConfirm(item.name))) return;
      try {
        await api.del(`/api/sticky/${item.id}?botId=${botId}&guildId=${guildId}`);
        toast(S.toast.deleted, 'success');
        location.hash = 'modules?sub=sticky';
      } catch (err) {
        toast(`${S.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
      }
    });
  },

  _emptyNoServer(container) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-thumbtack"></i>
      <strong>${UI.common.selectServer}</strong>
      <span>${UI.common.selectServerHint}</span>
    </div>`;
  },

  _emptyError(container, msg) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <strong>${S.errors.loadFailed}</strong>
      <span>${escapeHtml(msg || '')}</span>
    </div>`;
  },
};