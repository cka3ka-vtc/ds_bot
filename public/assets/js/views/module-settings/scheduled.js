// public/assets/js/views/module-settings/scheduled.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  channelPickerHTML, bindChannelPicker,
} from './pickers.js';
import { MessageEditor, emptyMessageConfig } from './message-editor.js';
import { mergeScheduledMessageConfig } from '/shared/scheduled-config.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../components/moduleBanner.js';

const S = UI.scheduled;

/* ═════════════════ Хелперы ═════════════════ */

function channelName(channels, channelId) {
  const ch = channels.find((c) => c.id === channelId);
  return ch?.name || channelId;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function toLocalInputValue(ts) {
  const d = new Date(ts * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
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
      <i class="fa-solid fa-clock"></i>
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
  const status = item.status || 'pending';
  const isPending = status === 'pending';
  const isSent = status === 'sent';
  const isError = status === 'error';

  // Строка времени: для отправленных — время отправки, для остальных — планируемое
  let timeRow;
  if (isSent && item.lastSentAt) {
    timeRow = `
      <div class="rule-meta-row">
        <span class="rule-dot rule-dot--green"></span>
        <span>${S.card.sent}: ${fmtDateTime(item.lastSentAt)}</span>
      </div>
    `;
  } else if (isError) {
    timeRow = `
      <div class="rule-meta-row rule-meta-row--error">
        <span class="rule-dot rule-dot--red"></span>
        <span>${S.card.planned}: ${fmtDateTime(item.scheduledAt)}</span>
      </div>
    `;
  } else {
    timeRow = `
      <div class="rule-meta-row">
        <span class="rule-dot rule-dot--orange"></span>
        <span>${S.card.planned}: ${fmtDateTime(item.scheduledAt)}</span>
      </div>
    `;
  }

  const toggleHTML = isPending
    ? `<button type="button" class="toggle ${item.enabled ? 'on' : ''}"
             data-action="toggle" role="switch"
             aria-checked="${item.enabled}"
             title="${item.enabled ? S.actions.disable : S.actions.enable}"></button>`
    : '';

  const sendNowBtn = isPending && item.enabled
    ? `<button type="button" class="rule-act-btn" data-action="send-now"
               title="${S.actions.sendNow}" aria-label="${S.actions.sendNow}">
         <i class="fa-solid fa-paper-plane"></i>
       </button>`
    : '';

  const errorRow = isError && item.lastError
    ? `<div class="rule-error-row">
         <i class="fa-solid fa-triangle-exclamation"></i>
         <span>${escapeHtml(item.lastError.slice(0, 120))}</span>
       </div>`
    : '';

  return `
    <div class="rule-card ${item.enabled ? '' : 'is-off'}" data-id="${escapeHtml(item.id)}">
      <div class="rule-card-header">
        <div class="rule-icon-wrap">
          <i class="fa-solid fa-clock"></i>
        </div>
        <div class="rule-title-wrap">
          <div class="rule-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="rule-channel-name">
            <i class="fa-solid fa-hashtag"></i>
            <span>${escapeHtml(chName)}</span>
          </div>
        </div>
        ${toggleHTML}
      </div>

      <div class="rule-card-body">
        ${timeRow}
        ${errorRow}
      </div>

      <div class="rule-card-footer">
        <div class="rule-actions-row">
          <button type="button" class="rule-act-btn rule-act-btn--primary" data-action="edit"
                  title="${S.actions.edit}" aria-label="${S.actions.edit}">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${sendNowBtn}
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
    scheduledAt: Math.floor(Date.now() / 1000) + 3600,
    messageConfig: mergeScheduledMessageConfig(emptyMessageConfig()),
    enabled: true,
  };

  const dtValue = toLocalInputValue(draft.scheduledAt || Math.floor(Date.now() / 1000) + 3600);

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules?sub=scheduled" class="back-link">
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
                <input type="text" class="input" id="scheduledName" maxlength="80"
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
                  ${channelPickerHTML({ id: 'scheduled_channel' })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${S.editor.whenLabel}</h3>
              <p>${S.editor.whenHint}</p>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="form-field">
              <label>${S.editor.whenLabel}</label>
              <input type="datetime-local" class="input" id="scheduledAt" value="${dtValue}" style="max-width:340px;">
            </div>
          </div>
        </section>

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
        <a href="#modules?sub=scheduled" class="btn btn-ghost">Отмена</a>
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
        api.get(`/api/scheduled?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules?botId=${botId}&guildId=${guildId}`).catch(() => []),
      ]);
      items = listRes;
      channels = chsRes;
      const m = (modsRes || []).find((x) => x.key === 'scheduled');
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
          <button class="btn btn-primary" id="scheduledCreateBtn" type="button">
            <i class="fa-solid fa-plus"></i> ${S.createBtn}
          </button>
        </div>
      </div>

      ${moduleOff ? renderModuleOffBanner({
        moduleKey: 'scheduled',
        moduleName: 'Отложенные сообщения',
        hint: 'Сообщения не будут отправляться, пока модуль выключен.',
      }) : ''}

      <div class="rule-toolbar">
        <div class="search-input" style="flex:1;max-width:380px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="scheduledSearch" placeholder="${S.searchPlaceholder}"
                 value="${escapeHtml(this.state.search)}">
        </div>
        <span class="rule-count">${items.length} всего</span>
      </div>

      <div id="scheduledListZone">
        ${renderList(items, this.state.search, this.state.channels)}
      </div>
    `;
  },

  _bindList() {
    const c = this.container;

    c.querySelector('#scheduledCreateBtn')?.addEventListener('click', () => {
      location.hash = 'modules?sub=scheduled&new=1';
    });

    bindModuleOffBanner({
      container: c,
      botId: this.state.botId,
      guildId: this.state.guildId,
      moduleKey: 'scheduled',
      onEnabled: () => { this.state.moduleEnabled = true; },
    });

    const searchEl = c.querySelector('#scheduledSearch');
    let timer = null;
    searchEl?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.search = searchEl.value;
        c.querySelector('#scheduledListZone').innerHTML =
          renderList(this.state.items, this.state.search, this.state.channels);
        this._bindCards();
      }, 250);
    });

    this._bindCards();
  },

  _bindCards() {
    const zone = this.container.querySelector('#scheduledListZone');
    if (!zone) return;

    zone.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.rule-card').dataset.id;
        location.hash = `modules?sub=scheduled&id=${encodeURIComponent(id)}`;
      });
    });

    zone.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._toggle(btn.closest('.rule-card').dataset.id);
      });
    });

    zone.querySelectorAll('[data-action="send-now"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this._sendNow(btn.closest('.rule-card').dataset.id);
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
      await api.post(`/api/scheduled/${id}/toggle`, {
        botId: this.state.botId,
        guildId: this.state.guildId,
        enabled: !item.enabled,
      });
      item.enabled = !item.enabled;
      toast(item.enabled ? S.toast.enabled : S.toast.disabled, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${S.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _sendNow(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) return;
    if (!confirm(S.actions.sendNowConfirm(item.name))) return;
    try {
      await api.post(`/api/scheduled/${id}/send-now?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(S.actions.sendNowDone, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${S.actions.sendNowFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _duplicate(id) {
    try {
      await api.post(`/api/scheduled/${id}/duplicate?botId=${this.state.botId}&guildId=${this.state.guildId}`);
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
      await api.del(`/api/scheduled/${id}?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(S.toast.deleted, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${S.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _reloadList() {
    try {
      const [items, mods] = await Promise.all([
        api.get(`/api/scheduled?botId=${this.state.botId}&guildId=${this.state.guildId}`),
        api.get(`/api/modules?botId=${this.state.botId}&guildId=${this.state.guildId}`).catch(() => []),
      ]);
      this.state.items = items;
      const m = (mods || []).find((x) => x.key === 'scheduled');
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
    const draft = item || { name: '', channelId: '', scheduledAt: null, messageConfig: null };

    const nameEl = c.querySelector('#scheduledName');
    const atEl = c.querySelector('#scheduledAt');
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
      id: 'scheduled_channel',
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
      ? mergeScheduledMessageConfig(draft.messageConfig)
      : mergeScheduledMessageConfig(emptyMessageConfig());
    const editor = new MessageEditor(editorContainer, initial, {
      bot, roles: [], context: 'scheduled', presetKey: null, guildId, botId,
    });
    editor.mount();
    state.editor = editor;

    c.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;

      draft.name = (nameEl?.value || '').trim();
      if (!draft.name) return toast(S.toast.needName, 'warn');
      if (!draft.channelId) return toast(S.toast.needChannel, 'warn');

      const ts = fromLocalInputValue(atEl?.value || '');
      if (!ts) return toast(S.toast.needDate, 'warn');
      if (ts <= Math.floor(Date.now() / 1000) + 30) {
        return toast(S.toast.pastDate, 'warn');
      }

      const cfg = editor.getConfig();
      const hasContent = !!(cfg.title || cfg.subtitle || (cfg.blocks || []).length);
      if (!hasContent) return toast(S.toast.needContent, 'warn');

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

      try {
        if (item?.id) {
          await api.put(`/api/scheduled/${item.id}`, {
            botId, guildId,
            name: draft.name,
            channelId: draft.channelId,
            scheduledAt: ts,
            messageConfig: cfg,
          });
          toast(S.toast.updated, 'success');
        } else {
          await api.post('/api/scheduled', {
            botId, guildId,
            name: draft.name,
            channelId: draft.channelId,
            scheduledAt: ts,
            messageConfig: cfg,
          });
          toast(S.toast.created, 'success');
        }
        location.hash = 'modules?sub=scheduled';
      } catch (err) {
        const code = err.data?.error;
        const msg = code === 'no_send_permission' ? S.toast.noSendPermission
          : code === 'invalid_channel' ? S.toast.invalidChannel
          : code === 'scheduled_in_past' ? S.toast.pastDate
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
        await api.del(`/api/scheduled/${item.id}?botId=${botId}&guildId=${guildId}`);
        toast(S.toast.deleted, 'success');
        location.hash = 'modules?sub=scheduled';
      } catch (err) {
        toast(`${S.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
      }
    });
  },

  _emptyNoServer(container) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-clock"></i>
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