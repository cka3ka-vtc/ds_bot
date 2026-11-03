// public/assets/js/views/module-settings/message-templates.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { MessageEditor, emptyMessageConfig } from './message-editor.js';
import { channelPickerHTML, bindChannelPicker } from './pickers.js';
import { mergeTemplateMessageConfig } from '/shared/message-templates-config.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../components/moduleBanner.js';

const M = UI.messageTemplates;

/* ─── Утилиты ─── */

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

/* ─── Список ─── */

function renderList(items, search, channels) {
  const q = (search || '').trim().toLowerCase();
  const filtered = q
    ? items.filter((it) => {
        const name = channelName(channels, it.defaultChannelId);
        return it.name.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      })
    : items;

  if (!filtered.length) {
    return `<div class="empty-state">
      <i class="fa-solid fa-message"></i>
      <strong>${q ? M.emptySearchTitle : M.emptyTitle}</strong>
      <span>${q ? M.emptySearchHint : M.emptyHint}</span>
    </div>`;
  }

  return `<div class="rule-grid">
    ${filtered.map((it) => renderCard(it, channels)).join('')}
  </div>`;
}

function renderCard(item, channels) {
  const hasChannel = !!item.defaultChannelId;
  const chName = hasChannel
    ? channelName(channels, item.defaultChannelId)
    : M.card.noChannel;

  const timeRow = item.lastSentAt
    ? `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--green"></span>
         <span>${M.card.sent}: ${fmtDateTime(item.lastSentAt)}</span>
       </div>`
    : `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--gray"></span>
         <span>${M.card.created}: ${fmtDateTime(item.createdAt)}</span>
       </div>`;

  return `
    <div class="rule-card" data-id="${escapeHtml(item.id)}">
      <div class="rule-card-header">
        <div class="rule-icon-wrap">
          <i class="fa-solid fa-message"></i>
        </div>
        <div class="rule-title-wrap">
          <div class="rule-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="rule-channel-name ${hasChannel ? '' : 'rule-channel-name--empty'}">
            <i class="fa-solid ${hasChannel ? 'fa-hashtag' : 'fa-circle-minus'}"></i>
            <span>${escapeHtml(chName)}</span>
          </div>
        </div>
        <button type="button" class="rule-send-btn" data-action="send"
                title="${M.actions.send}" aria-label="${M.actions.send}">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>

      <div class="rule-card-body">
        ${timeRow}
      </div>

      <div class="rule-card-footer">
        <div class="rule-actions-row">
          <button type="button" class="rule-act-btn rule-act-btn--primary" data-action="edit"
                  title="${M.actions.edit}" aria-label="${M.actions.edit}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="rule-act-btn" data-action="duplicate"
                  title="${M.actions.duplicate}" aria-label="${M.actions.duplicate}">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button type="button" class="rule-act-btn rule-act-btn--danger" data-action="delete"
                  title="${M.actions.remove}" aria-label="${M.actions.remove}">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ─── Статус канала ─── */

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
  const draft = item || { name: '', defaultChannelId: '', messageConfig: null };

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules?sub=message-templates" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К списку
          </a>
          <h1>${isEdit ? M.editor.editTitle : M.editor.createTitle}</h1>
          <p>${M.editor.subtitle}</p>
        </div>
      </div>

      <div class="gr-settings">
        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${M.editor.nameLabel}</h3>
                <p>${M.editor.nameHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${M.editor.nameLabel}</label>
                <input type="text" class="input" id="templateName" maxlength="80"
                       placeholder="${escapeHtml(M.editor.namePlaceholder)}"
                       value="${escapeHtml(draft.name || '')}">
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${M.editor.channelLabel}</h3>
                <p>${M.editor.channelHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${M.editor.channelLabel}</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status
                       data-tooltip="${escapeHtml(M.editor.channelStatus.empty)}">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'template_channel', placeholder: M.editor.channelPlaceholder })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${M.editor.messageTitle}</h3>
              <p>${M.editor.messageSubtitle}</p>
            </div>
          </div>
          <div class="gr-section-body">
            <div data-message-editor-container></div>
          </div>
        </section>
      </div>

      <div class="module-page-savebar">
        <a href="#modules?sub=message-templates" class="btn btn-ghost">Отмена</a>
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

/* ─── Модалка отправки (fallback без канала) ─── */

function openSendModal(item, channels) {
  return openModal({
    title: M.sendModal.title,
    subtitle: M.sendModal.subtitle,
    ctaLabel: M.sendModal.submit,
    body: `
      <div class="form-field">
        <label>${M.sendModal.channelLabel}</label>
        ${channelPickerHTML({ id: 'template_send_channel', placeholder: M.sendModal.channelPlaceholder })}
      </div>
    `,
    onOpen: (modal) => {
      const state = { channelId: null };
      bindChannelPicker(modal, {
        id: 'template_send_channel',
        channels,
        onSelect: (ch) => { state.channelId = ch?.id || null; },
      });
      modal._sendState = state;
    },
    onSubmit: async (modal) => {
      const channelId = modal._sendState?.channelId;
      if (!channelId) { toast(M.sendModal.needChannel, 'warn'); throw new Error('no_channel'); }

      const btn = modal.querySelector('[data-cta]');
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

      try {
        await api.post(`/api/message-templates/${item.id}/send`, {
          botId: store.get('activeBotId'),
          guildId: store.get('activeGuildId'),
          channelId,
        });
        toast(M.sendModal.done, 'success');
      } catch (err) {
        toast(`${M.sendModal.failed}: ${err.data?.error || err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = orig;
        throw err;
      }
    },
  });
}

/* ─── Модуль ─── */

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
    let roles = [];   // ФИКС: роли для role-buttons в редакторе сообщений
    let moduleEnabled = true;
    try {
      const [listRes, chsRes, rlsRes, modsRes] = await Promise.all([
        api.get(`/api/message-templates?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules?botId=${botId}&guildId=${guildId}`).catch(() => []),
      ]);
      items = listRes;
      channels = chsRes;
      roles = Array.isArray(rlsRes) ? rlsRes : [];
      const m = (modsRes || []).find((x) => x.key === 'message-templates');
      moduleEnabled = !!m?.enabled;
    } catch (err) {
      return this._emptyError(container, err.message);
    }

    const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    if (isNew || editId) {
      const item = editId ? items.find((x) => x.id === editId) : null;
      if (editId && !item) return this._emptyError(container, 'Сообщение не найдено');
      this.state = { botId, guildId, bot, channels, roles, items, item, isNew, moduleEnabled };
      container.innerHTML = renderEditor(item, channels, bot);
      this._bindEditor();
      return;
    }

    this.state = { botId, guildId, items, channels, roles, search: '', moduleEnabled };
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
          <h1>${M.pageTitle}</h1>
          <p>${M.pageSubtitle}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="templateCreateBtn" type="button">
            <i class="fa-solid fa-plus"></i> ${M.createBtn}
          </button>
        </div>
      </div>

      ${moduleOff ? renderModuleOffBanner({
        moduleKey: 'message-templates',
        moduleName: 'Сообщения',
        hint: 'Отправка шаблонов будет недоступна, пока модуль выключен.',
      }) : ''}

      <div class="rule-toolbar">
        <div class="search-input" style="flex:1;max-width:380px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="templateSearch" placeholder="${M.searchPlaceholder}"
                 value="${escapeHtml(this.state.search)}">
        </div>
        <span class="rule-count">${items.length} всего</span>
      </div>

      <div id="templateListZone">
        ${renderList(items, this.state.search, this.state.channels)}
      </div>
    `;
  },

  _bindList() {
    const c = this.container;

    c.querySelector('#templateCreateBtn')?.addEventListener('click', () => {
      location.hash = 'modules?sub=message-templates&new=1';
    });

    bindModuleOffBanner({
      container: c,
      botId: this.state.botId,
      guildId: this.state.guildId,
      moduleKey: 'message-templates',
      onEnabled: () => { this.state.moduleEnabled = true; },
    });

    const searchEl = c.querySelector('#templateSearch');
    let timer = null;
    searchEl?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.search = searchEl.value;
        c.querySelector('#templateListZone').innerHTML =
          renderList(this.state.items, this.state.search, this.state.channels);
        this._bindCards();
      }, 250);
    });

    this._bindCards();
  },

  _bindCards() {
    const zone = this.container.querySelector('#templateListZone');
    if (!zone) return;

    zone.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.rule-card').dataset.id;
        location.hash = `modules?sub=message-templates&id=${encodeURIComponent(id)}`;
      });
    });

    zone.querySelectorAll('[data-action="send"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.closest('.rule-card').dataset.id;
        const item = this.state.items.find((x) => x.id === id);
        if (!item) return;

        if (item.defaultChannelId) {
          await this._sendDirect(item);
        } else {
          openSendModal(item, this.state.channels).then((result) => {
            if (result === true) this._reloadList();
          });
        }
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

  async _sendDirect(item) {
    try {
      await api.post(`/api/message-templates/${item.id}/send`, {
        botId: this.state.botId,
        guildId: this.state.guildId,
        channelId: item.defaultChannelId,
      });
      toast(M.sendModal.done, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${M.sendModal.failed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _duplicate(id) {
    try {
      await api.post(`/api/message-templates/${id}/duplicate?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(M.toast.duplicated, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${M.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _delete(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) return;
    if (!confirm(M.actions.removeConfirm(item.name))) return;
    try {
      await api.del(`/api/message-templates/${id}?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(M.toast.deleted, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${M.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _reloadList() {
    try {
      const [items, mods] = await Promise.all([
        api.get(`/api/message-templates?botId=${this.state.botId}&guildId=${this.state.guildId}`),
        api.get(`/api/modules?botId=${this.state.botId}&guildId=${this.state.guildId}`).catch(() => []),
      ]);
      this.state.items = items;
      const m = (mods || []).find((x) => x.key === 'message-templates');
      this.state.moduleEnabled = !!m?.enabled;
      this.container.innerHTML = this._renderListView();
      this._bindList();
    } catch {
      toast(M.errors.loadFailed, 'error');
    }
  },

  _bindEditor() {
    const c = this.container;
    const state = this.state;
    const { botId, guildId, channels, roles, item, bot } = state;
    const draft = item || { name: '', defaultChannelId: null, messageConfig: null };

    const nameEl = c.querySelector('#templateName');
    const statusEl = c.querySelector('[data-channel-status]');

    const checkPermissions = async (channel) => {
      if (!channel) {
        setChannelStatus(statusEl, 'empty', M.editor.channelStatus.empty);
        return;
      }
      setChannelStatus(statusEl, 'checking', M.editor.channelStatus.checking(channel.name));
      try {
        const perms = await api.get(
          `/api/guilds/channels/${channel.id}/permissions?botId=${botId}&guildId=${guildId}`,
        );
        if (!perms.channelExists) {
          setChannelStatus(statusEl, 'error', M.editor.channelStatus.notFound);
          return;
        }
        const missing = [];
        if (!perms.canViewChannel) missing.push('Просмотр канала');
        if (!perms.canSend) missing.push('Отправка сообщений');
        if (missing.length === 0) setChannelStatus(statusEl, 'ok', M.editor.channelStatus.ok);
        else setChannelStatus(statusEl, 'error', M.editor.channelStatus.missing(missing.join(', ')));
      } catch {
        setChannelStatus(statusEl, 'error', M.editor.channelStatus.checkFailed);
      }
    };

    const picker = bindChannelPicker(c, {
      id: 'template_channel',
      channels,
      onSelect: async (ch) => {
        draft.defaultChannelId = ch?.id || null;
        await checkPermissions(ch);
      },
    });
    if (draft.defaultChannelId) {
      const ch = channels.find((x) => x.id === draft.defaultChannelId);
      if (ch) {
        picker?.setValue?.(ch);
        checkPermissions(ch);
      }
    }

    const editorContainer = c.querySelector('[data-message-editor-container]');
    const initial = draft.messageConfig
      ? mergeTemplateMessageConfig(draft.messageConfig)
      : mergeTemplateMessageConfig(emptyMessageConfig());

    // ФИКС: roles из state вместо захардкоженного пустого массива.
    const editor = new MessageEditor(editorContainer, initial, {
      bot,
      roles: roles || [],
      context: 'message-templates',
      presetKey: null,
      guildId,
      botId,
    });
    editor.mount();
    state.editor = editor;

    c.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;

      draft.name = (nameEl?.value || '').trim();
      if (!draft.name) return toast(M.toast.needName, 'warn');

      const cfg = editor.getConfig();
      const hasContent = !!(cfg.title || cfg.subtitle || (cfg.blocks || []).length);
      if (!hasContent) return toast(M.toast.needContent, 'warn');

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

      try {
        if (item?.id) {
          await api.put(`/api/message-templates/${item.id}`, {
            botId, guildId,
            name: draft.name,
            defaultChannelId: draft.defaultChannelId || null,
            messageConfig: cfg,
          });
          toast(M.toast.updated, 'success');
        } else {
          await api.post('/api/message-templates', {
            botId, guildId,
            name: draft.name,
            defaultChannelId: draft.defaultChannelId || null,
            messageConfig: cfg,
          });
          toast(M.toast.created, 'success');
        }
        location.hash = 'modules?sub=message-templates';
      } catch (err) {
        toast(`${M.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    c.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!item?.id) return;
      if (!confirm(M.actions.removeConfirm(item.name))) return;
      try {
        await api.del(`/api/message-templates/${item.id}?botId=${botId}&guildId=${guildId}`);
        toast(M.toast.deleted, 'success');
        location.hash = 'modules?sub=message-templates';
      } catch (err) {
        toast(`${M.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
      }
    });
  },

  _emptyNoServer(container) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-message"></i>
      <strong>${UI.common.selectServer}</strong>
      <span>${UI.common.selectServerHint}</span>
    </div>`;
  },

  _emptyError(container, msg) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <strong>${M.errors.loadFailed}</strong>
      <span>${escapeHtml(msg || '')}</span>
    </div>`;
  },
};