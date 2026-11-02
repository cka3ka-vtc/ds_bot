// public/assets/js/views/module-settings/autodelete.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  channelPickerHTML, bindChannelPicker,
} from './pickers.js';
import {
  AUTODELETE_UNITS, unitLabel, mergeAutodeleteRule,
} from '/shared/autodelete-config.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../components/moduleBanner.js';

const A = UI.autodelete;

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
      <i class="fa-solid fa-trash"></i>
      <strong>${q ? A.emptySearchTitle : A.emptyTitle}</strong>
      <span>${q ? A.emptySearchHint : A.emptyHint}</span>
    </div>`;
  }

  return `<div class="rule-grid">
    ${filtered.map((it) => renderCard(it, channels)).join('')}
  </div>`;
}

function renderCard(item, channels) {
  const chName = channelName(channels, item.channelId);
  const isInstant = item.mode === 'instant';
  const modeIcon = isInstant ? 'fa-bolt' : 'fa-hourglass-half';
  const modeClass = isInstant ? 'mode-instant' : 'mode-after';
  const modeText = isInstant
    ? A.card.modeInstant
    : A.card.modeAfter(item.delayValue, unitLabel(item.delayUnit));

  const lastDeleted = item.lastDeletedAt
    ? `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--green"></span>
         <span>${A.card.lastDeleted}: ${timeAgo(item.lastDeletedAt)}</span>
       </div>`
    : `<div class="rule-meta-row">
         <span class="rule-dot rule-dot--gray"></span>
         <span>${A.card.neverDeleted}</span>
       </div>`;

  return `
    <div class="rule-card ${item.enabled ? '' : 'is-off'}" data-id="${escapeHtml(item.id)}">
      <div class="rule-card-header">
        <div class="rule-icon-wrap">
          <i class="fa-solid fa-trash"></i>
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
                title="${item.enabled ? A.actions.disable : A.actions.enable}"></button>
      </div>

      <div class="rule-card-body">
        <div class="rule-mode-pill rule-mode-pill--${modeClass}">
          <i class="fa-solid ${modeIcon}"></i>
          <span>${escapeHtml(modeText)}</span>
        </div>
        ${lastDeleted}
      </div>

      <div class="rule-card-footer">
        <div class="rule-actions-row">
          <button type="button" class="rule-act-btn rule-act-btn--primary" data-action="edit"
                  title="${A.actions.edit}" aria-label="${A.actions.edit}">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button type="button" class="rule-act-btn" data-action="duplicate"
                  title="${A.actions.duplicate}" aria-label="${A.actions.duplicate}">
            <i class="fa-solid fa-copy"></i>
          </button>
          <button type="button" class="rule-act-btn rule-act-btn--danger" data-action="delete"
                  title="${A.actions.remove}" aria-label="${A.actions.remove}">
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

function renderEditor(item, channels) {
  const isEdit = !!item?.id;
  const draft = item || {
    name: '', channelId: '',
    mode: 'instant',
    delayValue: 30, delayUnit: 'minutes',
    enabled: true,
  };

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules?sub=autodelete" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К списку
          </a>
          <h1>${isEdit ? A.editor.editTitle : A.editor.createTitle}</h1>
          <p>${A.editor.subtitle}</p>
        </div>
      </div>

      <div class="gr-settings">
        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${A.editor.nameLabel}</h3>
                <p>${A.editor.nameHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${A.editor.nameLabel}</label>
                <input type="text" class="input" id="adName" maxlength="80"
                       placeholder="${escapeHtml(A.editor.namePlaceholder)}"
                       value="${escapeHtml(draft.name || '')}">
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${A.editor.channelLabel}</h3>
                <p>${A.editor.channelHint}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${A.editor.channelLabel}</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status
                       data-tooltip="${escapeHtml(A.editor.channelStatus.empty)}">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'ad_channel' })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${A.editor.modeLabel}</h3>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="ad-mode-grid">
              <label class="ad-mode-option" data-mode="instant">
                <input type="radio" name="adMode" value="instant"
                       ${draft.mode === 'instant' ? 'checked' : ''}>
                <div class="ad-mode-body">
                  <div class="ad-mode-title">${A.editor.modeInstantLabel}</div>
                  <div class="ad-mode-hint">${A.editor.modeInstantHint}</div>
                </div>
              </label>
              <label class="ad-mode-option" data-mode="after">
                <input type="radio" name="adMode" value="after"
                       ${draft.mode === 'after' ? 'checked' : ''}>
                <div class="ad-mode-body">
                  <div class="ad-mode-title">${A.editor.modeAfterLabel}</div>
                  <div class="ad-mode-hint">${A.editor.modeAfterHint}</div>
                </div>
              </label>
            </div>

            <div class="form-field" id="adDelayField" style="margin-top:16px;${draft.mode === 'instant' ? 'display:none;' : ''}">
              <label>${A.editor.delayLabel}</label>
              <div class="ad-delay-row">
                <input type="number" class="input" id="adDelayValue" min="1"
                       max="525600" value="${Number(draft.delayValue) || 30}"
                       style="max-width:140px;">
                <div class="select-wrap" style="max-width:180px;">
                  <select id="adDelayUnit" class="custom-select">
                    ${AUTODELETE_UNITS.map((u) => `
                      <option value="${u.value}" ${draft.delayUnit === u.value ? 'selected' : ''}>${u.label}</option>
                    `).join('')}
                  </select>
                </div>
              </div>
              <span class="hint">${A.editor.delayHint}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="module-page-savebar">
        <a href="#modules?sub=autodelete" class="btn btn-ghost">Отмена</a>
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
        api.get(`/api/autodelete?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules?botId=${botId}&guildId=${guildId}`).catch(() => []),
      ]);
      items = listRes;
      channels = chsRes;
      const m = (modsRes || []).find((x) => x.key === 'autodelete');
      moduleEnabled = !!m?.enabled;
    } catch (err) {
      return this._emptyError(container, err.message);
    }

    if (isNew || editId) {
      const item = editId ? items.find((x) => x.id === editId) : null;
      if (editId && !item) return this._emptyError(container, 'Правило не найдено');
      this.state = { botId, guildId, channels, item, isNew, moduleEnabled };
      container.innerHTML = renderEditor(item, channels);
      this._bindEditor();
      return;
    }

    this.state = { botId, guildId, items, channels, search: '', moduleEnabled };
    container.innerHTML = this._renderListView();
    this._bindList();
  },

  destroy() {
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
          <h1>${A.pageTitle}</h1>
          <p>${A.pageSubtitle}</p>
        </div>
        <div class="view-actions">
          <button class="btn btn-primary" id="adCreateBtn" type="button">
            <i class="fa-solid fa-plus"></i> ${A.createBtn}
          </button>
        </div>
      </div>

      ${moduleOff ? renderModuleOffBanner({
        moduleKey: 'autodelete',
        moduleName: 'Автоудаление',
        hint: 'Правила не будут применяться, пока модуль выключен.',
      }) : ''}

      <div class="rule-toolbar">
        <div class="search-input" style="flex:1;max-width:380px;">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="adSearch" placeholder="${A.searchPlaceholder}"
                 value="${escapeHtml(this.state.search)}">
        </div>
        <span class="rule-count">${items.length} всего</span>
      </div>

      <div id="adListZone">
        ${renderList(items, this.state.search, this.state.channels)}
      </div>
    `;
  },

  _bindList() {
    const c = this.container;

    c.querySelector('#adCreateBtn')?.addEventListener('click', () => {
      location.hash = 'modules?sub=autodelete&new=1';
    });

    bindModuleOffBanner({
      container: c,
      botId: this.state.botId,
      guildId: this.state.guildId,
      moduleKey: 'autodelete',
      onEnabled: () => { this.state.moduleEnabled = true; },
    });

    const searchEl = c.querySelector('#adSearch');
    let timer = null;
    searchEl?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        this.state.search = searchEl.value;
        c.querySelector('#adListZone').innerHTML =
          renderList(this.state.items, this.state.search, this.state.channels);
        this._bindCards();
      }, 250);
    });

    this._bindCards();
  },

  _bindCards() {
    const zone = this.container.querySelector('#adListZone');
    if (!zone) return;

    zone.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.closest('.rule-card').dataset.id;
        location.hash = `modules?sub=autodelete&id=${encodeURIComponent(id)}`;
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
      await api.post(`/api/autodelete/${id}/toggle`, {
        botId: this.state.botId,
        guildId: this.state.guildId,
        enabled: !item.enabled,
      });
      item.enabled = !item.enabled;
      toast(item.enabled ? A.toast.enabled : A.toast.disabled, 'success');
      await this._reloadList();
    } catch (err) {
      const code = err.data?.error;
      if (code === 'channel_already_has_rule') toast(A.toast.channelConflict, 'warn');
      else toast(`${A.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _duplicate(id) {
    try {
      await api.post(`/api/autodelete/${id}/duplicate?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(A.toast.duplicated, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${A.toast.saveFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _delete(id) {
    const item = this.state.items.find((x) => x.id === id);
    if (!item) return;
    if (!confirm(A.actions.removeConfirm(item.name))) return;
    try {
      await api.del(`/api/autodelete/${id}?botId=${this.state.botId}&guildId=${this.state.guildId}`);
      toast(A.toast.deleted, 'success');
      await this._reloadList();
    } catch (err) {
      toast(`${A.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
    }
  },

  async _reloadList() {
    try {
      const [items, mods] = await Promise.all([
        api.get(`/api/autodelete?botId=${this.state.botId}&guildId=${this.state.guildId}`),
        api.get(`/api/modules?botId=${this.state.botId}&guildId=${this.state.guildId}`).catch(() => []),
      ]);
      this.state.items = items;
      const m = (mods || []).find((x) => x.key === 'autodelete');
      this.state.moduleEnabled = !!m?.enabled;
      this.container.innerHTML = this._renderListView();
      this._bindList();
    } catch {
      toast(A.errors.loadFailed, 'error');
    }
  },

  _bindEditor() {
    const c = this.container;
    const state = this.state;
    const { botId, guildId, channels, item } = state;
    const draft = item || {
      name: '', channelId: '',
      mode: 'instant', delayValue: 30, delayUnit: 'minutes',
    };

    const nameEl = c.querySelector('#adName');
    const statusEl = c.querySelector('[data-channel-status]');

    const checkPermissions = async (channel) => {
      if (!channel) {
        setChannelStatus(statusEl, 'empty', A.editor.channelStatus.empty);
        return;
      }
      setChannelStatus(statusEl, 'checking', A.editor.channelStatus.checking(channel.name));
      try {
        const perms = await api.get(
          `/api/guilds/channels/${channel.id}/permissions?botId=${botId}&guildId=${guildId}`,
        );
        if (!perms.channelExists) {
          setChannelStatus(statusEl, 'error', A.editor.channelStatus.notFound);
          return;
        }
        const missing = [];
        if (!perms.canViewChannel) missing.push('Просмотр канала');
        if (!perms.canSend) missing.push('Отправка сообщений');
        if (missing.length === 0) setChannelStatus(statusEl, 'ok', A.editor.channelStatus.ok);
        else setChannelStatus(statusEl, 'error', A.editor.channelStatus.missing(missing.join(', ')));
      } catch {
        setChannelStatus(statusEl, 'error', A.editor.channelStatus.checkFailed);
      }
    };

    const picker = bindChannelPicker(c, {
      id: 'ad_channel',
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

    const delayField = c.querySelector('#adDelayField');
    const radioBoxes = c.querySelectorAll('input[name="adMode"]');
    radioBoxes.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        draft.mode = radio.value;
        delayField.style.display = draft.mode === 'after' ? '' : 'none';
        c.querySelectorAll('.ad-mode-option').forEach((opt) => {
          opt.classList.toggle('active', opt.dataset.mode === draft.mode);
        });
      });
    });
    c.querySelectorAll('.ad-mode-option').forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.mode === draft.mode);
    });

    const delayValueEl = c.querySelector('#adDelayValue');
    const delayUnitEl = c.querySelector('#adDelayUnit');

    c.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;

      draft.name = (nameEl?.value || '').trim();
      if (!draft.name) return toast(A.toast.needName, 'warn');
      if (!draft.channelId) return toast(A.toast.needChannel, 'warn');

      const normalized = mergeAutodeleteRule({
        mode: draft.mode,
        delayValue: parseInt(delayValueEl?.value, 10) || 30,
        delayUnit: delayUnitEl?.value || 'minutes',
      });

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

      const payload = {
        botId, guildId,
        name: draft.name,
        channelId: draft.channelId,
        mode: normalized.mode,
        delayValue: normalized.mode === 'after' ? normalized.delayValue : null,
        delayUnit: normalized.mode === 'after' ? normalized.delayUnit : null,
      };

      try {
        if (item?.id) {
          await api.put(`/api/autodelete/${item.id}`, payload);
          toast(A.toast.updated, 'success');
        } else {
          await api.post('/api/autodelete', payload);
          toast(A.toast.created, 'success');
        }
        location.hash = 'modules?sub=autodelete';
      } catch (err) {
        const code = err.data?.error;
        const msg = code === 'channel_already_has_rule' ? A.toast.channelConflict
          : code === 'no_manage_messages_permission' ? A.toast.noManagePermission
          : code === 'invalid_channel' ? A.toast.invalidChannel
          : (err.data?.error || err.message);
        toast(msg, 'error');
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    c.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!item?.id) return;
      if (!confirm(A.actions.removeConfirm(item.name))) return;
      try {
        await api.del(`/api/autodelete/${item.id}?botId=${botId}&guildId=${guildId}`);
        toast(A.toast.deleted, 'success');
        location.hash = 'modules?sub=autodelete';
      } catch (err) {
        toast(`${A.toast.deleteFailed}: ${err.data?.error || err.message}`, 'error');
      }
    });
  },

  _emptyNoServer(container) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-trash"></i>
      <strong>${UI.common.selectServer}</strong>
      <span>${UI.common.selectServerHint}</span>
    </div>`;
  },

  _emptyError(container, msg) {
    container.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <strong>${A.errors.loadFailed}</strong>
      <span>${escapeHtml(msg || '')}</span>
    </div>`;
  },
};