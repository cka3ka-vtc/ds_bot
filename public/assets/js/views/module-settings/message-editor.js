// public/assets/js/views/module-settings/message-editor.js
import { escapeHtml } from '../../core/utils.js';
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openModal } from '../../core/modal.js';
import { rolePickerHTML, bindRolePicker, emojiPickerHTML, bindEmojiPicker, positionPopup } from './pickers.js';
import { getPresetsFor, hasMessageContent } from '/shared/message-presets.js';
import { UI } from '/shared/ui-strings.js';
import { getTokensFor } from './message-editor-tokens.js';

const LIMITS = UI.msgEditor.limits;
const TYPE_LABELS = UI.msgEditor.types;
const TIME_FORMAT_CODES = Object.entries(UI.msgEditor.timeFormats);
const CATEGORY_LABELS = UI.msgEditor.categories;

function uid() { return 'b_' + Math.random().toString(36).slice(2, 10); }
function debounce(fn, ms = 200) { let t = null; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

function formatDateByCode(date, code) {
  const map = {
    t: { hour: '2-digit', minute: '2-digit' },
    T: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    d: { day: '2-digit', month: '2-digit', year: 'numeric' },
    D: { day: '2-digit', month: 'long', year: 'numeric' },
    f: { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    F: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  };
  if (code === 'R') {
    const diff = Math.round((date.getTime() - Date.now()) / 1000);
    if (Math.abs(diff) < 60) return 'только что';
    if (Math.abs(diff) < 3600) return `${Math.round(diff / 60)} мин`;
    if (Math.abs(diff) < 86400) return `${Math.round(diff / 3600)} ч`;
    return `${Math.round(diff / 86400)} дн`;
  }
  try { return date.toLocaleString('ru-RU', map[code] || map.f); }
  catch { return date.toISOString(); }
}

export function emptyMessageConfig() {
  return { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] };
}

export class MessageEditor {
  constructor(container, config, opts = {}) {
    this.container = container;
    this.config = structuredClone(config || emptyMessageConfig());
    if (!Array.isArray(this.config.blocks)) this.config.blocks = [];

    this.opts = opts;
    this._root = null;
    this._blocksEl = null;
    this._previewEl = null;
    this._dragSrcIndex = -1;
    this._abort = null;

    this._collapseKey = `msg_editor_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;
    this._settingsCollapseKey = `msg_editor_settings_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;
    this._templatesCollapseKey = `msg_editor_templates_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;

    this._ctx = getTokensFor(opts.context);
    this._previewTokens = { ...this._ctx.preview };
    this._botAvatarUrl = opts.bot?.avatarUrl || '';
    this._presets = getPresetsFor(opts.presetKey || opts.context || '');
    this._markDirty = debounce(() => this.onChange?.(this.getConfig()), 150);
  }

  mount() {
    this._render();
    this._bind();
    this._loadPreviewTokens();
    requestAnimationFrame(() => this._resizeAllTextareas());
    return this;
  }

  destroy() {
    this._abort?.abort();
    this._abort = null;
    document.querySelectorAll('.picker-popup, .time-dropdown, .tokens-dropdown').forEach((p) => p.remove());
    this._root = null;
  }

  getConfig() { return this.config; }

  async _loadPreviewTokens() {
    const botId = this.opts.botId || store.get('activeBotId');
    const guildId = this.opts.guildId || store.get('activeGuildId');
    if (!botId || !guildId) return;

    try {
      const tokens = await api.get(`/api/preview/tokens?botId=${botId}&guildId=${guildId}`);
      this._previewTokens = { ...this._previewTokens, ...tokens };
      this._renderPreview();
    } catch {
      // silent — используем fallback
    }
  }

  _loadCollapseState() { try { const raw = localStorage.getItem(this._collapseKey); return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
  _saveCollapseState(s) { try { localStorage.setItem(this._collapseKey, JSON.stringify(s)); } catch {} }
  _isCollapsed(id) { return !!this._loadCollapseState()[id]; }
  _toggleCollapse(id) { const s = this._loadCollapseState(); s[id] = !s[id]; this._saveCollapseState(s); return s[id]; }
  _isSettingsCollapsed() { try { return localStorage.getItem(this._settingsCollapseKey) === '1'; } catch { return false; } }
  _saveSettingsCollapse(v) { try { localStorage.setItem(this._settingsCollapseKey, v ? '1' : '0'); } catch {} }
  _isTemplatesCollapsed() { try { return localStorage.getItem(this._templatesCollapseKey) === '1'; } catch { return false; } }
  _saveTemplatesCollapse(v) { try { localStorage.setItem(this._templatesCollapseKey, v ? '1' : '0'); } catch {} }

  _autoResize(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    const isSmall = el.matches('[data-title-input], [data-subtitle-input]');
    const min = isSmall ? 40 : 84;
    el.style.height = 'auto';
    el.style.height = Math.max(min, el.scrollHeight) + 'px';
  }
  _resizeAllTextareas() { this.container.querySelectorAll('textarea').forEach((t) => this._autoResize(t)); }

  async _confirm({ title, text, ctaLabel }) {
    const result = await openModal({
      title,
      body: `<div style="padding:4px 0; font-size:14px; line-height:1.55; color:var(--text-soft);">${escapeHtml(text)}</div>`,
      ctaLabel: ctaLabel || UI.common.confirm,
      onSubmit: async () => true,
    });
    return result === true;
  }

  async _applyPreset(preset) {
    const P = UI.msgEditor.presets;
    if (hasMessageContent(this.config)) {
      const ok = await this._confirm({
        title: P.confirmReplaceTitle,
        text: P.confirmReplace,
        ctaLabel: UI.common.confirm,
      });
      if (!ok) return;
    }
    this.config = structuredClone(preset.build());
    this._rerenderAndRebind();
    this._markDirty();
  }

  async _clearConfig() {
    const P = UI.msgEditor.presets;
    if (hasMessageContent(this.config)) {
      const ok = await this._confirm({
        title: P.confirmClearTitle,
        text: P.confirmClear,
        ctaLabel: P.clear,
      });
      if (!ok) return;
    }
    this.config = emptyMessageConfig();
    this._rerenderAndRebind();
    this._markDirty();
  }

  _rerenderAndRebind() {
    this._render();
    this._bind();
    requestAnimationFrame(() => this._resizeAllTextareas());
  }

  _render() {
    const bot = this.opts.bot || { name: 'Bot', avatarUrl: null };
    const botName = bot.name || 'Bot';
    const avatarInner = bot.avatarUrl
      ? `<img src="${escapeHtml(bot.avatarUrl)}" alt="">`
      : botName.charAt(0).toUpperCase();
    const settingsCollapsed = this._isSettingsCollapsed();
    const templatesCollapsed = this._isTemplatesCollapsed();
    const S = UI.msgEditor.settings;
    const B = UI.msgEditor.blocks;
    const P = UI.msgEditor.preview;
    const TPL = UI.msgEditor.presets;

    const templatesHTML = this._presets.length ? `
      <div class="card msg-templates-card ${templatesCollapsed ? 'collapsed' : ''}" data-templates-card>
        <div class="card-head" data-templates-toggle role="button" tabindex="0"
             aria-expanded="${!templatesCollapsed}"
             title="${templatesCollapsed ? TPL.expand : TPL.collapse}">
          <div>
            <span class="card-title">${TPL.title}</span>
            <span class="card-sub">${TPL.subtitle}</span>
          </div>
          <span class="card-collapse-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
        <div class="card-body">
          <div class="msg-templates-grid">
            ${this._presets.map((p) => `
              <button type="button" class="msg-template-btn" data-preset="${escapeHtml(p.key)}">
                <span class="msg-template-icon"><i class="fa-solid ${escapeHtml(p.icon)}"></i></span>
                <span class="msg-template-text">
                  <strong>${escapeHtml(p.label)}</strong>
                  <span>${escapeHtml(p.description || '')}</span>
                </span>
              </button>
            `).join('')}
          </div>
          <div class="msg-templates-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-clear-template>
              <i class="fa-solid fa-eraser"></i> ${TPL.clear}
            </button>
          </div>
        </div>
      </div>
    ` : '';

    this.container.innerHTML = `
      <div class="msg-editor">
        <div class="msg-editor-col">
          ${templatesHTML}
          <div class="card editor-settings-card ${settingsCollapsed ? 'collapsed' : ''}" data-settings-card>
            <div class="card-head" data-settings-toggle role="button" tabindex="0"
                 aria-expanded="${!settingsCollapsed}"
                 title="${settingsCollapsed ? S.expand : S.collapse}">
              <div>
                <span class="card-title">${S.title}</span>
                <span class="card-sub">${S.subtitle}</span>
              </div>
              <span class="card-collapse-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
            <div class="card-body">
              <div class="editor-grid compact-grid">
                <div class="form-field" style="margin-bottom:0;">
                  <label>${S.displayMode}</label>
                  <div class="segmented-control" data-mode-seg>
                    <button type="button" data-value="flat" class="seg-btn">${S.modeFlat}</button>
                    <button type="button" data-value="embed" class="seg-btn">${S.modeEmbed}</button>
                    <button type="button" data-value="embed-color" class="seg-btn">${S.modeColor}</button>
                  </div>
                </div>
                <div class="form-field" data-color-group style="margin-bottom:0; align-self: end;">
                  <div class="color-picker-compact">
                    <input type="color" data-accent-color value="#5865F2" aria-label="${S.color}" title="${S.color}">
                  </div>
                </div>
              </div>
              <div class="form-field" style="margin-top:14px;">
                <label>${S.titleLabel}</label>
                ${this._toolbarHTML()}
                <textarea class="input" data-title-input rows="1" maxlength="4000" placeholder="${S.placeholderTitle}"></textarea>
              </div>
              <div class="form-field">
                <label>${S.subtitleLabel}</label>
                ${this._toolbarHTML()}
                <textarea class="input" data-subtitle-input rows="1" maxlength="4000" placeholder="${S.placeholderSubtitle}"></textarea>
              </div>
              <div class="form-field">
                <label>${S.thumbnailLabel}</label>
                <input class="input" data-thumbnail-input placeholder="${S.placeholderThumbnail}">
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:12px;">
            <div class="card-head">
              <div>
                <span class="card-title">${B.title}</span>
                <span class="card-sub">${B.subtitle}</span>
              </div>
              <span class="badge idle" data-block-count>0 ${UI.words.block(0)}</span>
            </div>
            <div class="card-body">
              <div class="blocks-list" data-blocks></div>
              <div class="add-block-menu" data-add-menu>${this._addMenuButtons()}</div>
            </div>
          </div>
        </div>

        <div class="msg-editor-preview">
          <div class="card">
            <div class="card-head">
              <div>
                <span class="card-title">${P.title}</span>
                <span class="card-sub">${P.subtitle}</span>
              </div>
            </div>
            <div class="card-body">
              <div class="discord-preview">
                <div class="dp-author">
                  <div class="dp-avatar" style="${bot.avatarUrl ? 'background:transparent;' : ''}">${avatarInner}</div>
                  <div>
                    <span class="dp-name">${escapeHtml(botName)}<span class="bot-tag">BOT</span></span>
                    <span class="dp-time">${P.timeNow}</span>
                  </div>
                </div>
                <div data-preview></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._root = this.container.querySelector('.msg-editor');
    this._blocksEl = this.container.querySelector('[data-blocks]');
    this._previewEl = this.container.querySelector('[data-preview]');

    this._renderSettings();
    this._renderBlocks();
    this._renderPreview();
    this._updateCount();
  }

  _addMenuButtons() {
    const B = UI.msgEditor.blocks;
    return [
      ['text', B.addText], ['sections', B.addSections], ['separator', B.addSeparator],
      ['image', B.addImage], ['images', B.addImages], ['file', B.addFile],
      ['buttons', B.addButtons], ['role-buttons', B.addRoleButtons], ['footer', B.addFooter],
    ].map(([t, l]) => `<button type="button" data-add="${t}">${l}</button>`).join('');
  }

  _renderSettings() {
    const root = this.container;
    root.querySelectorAll('[data-mode-seg] .seg-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === this.config.displayMode);
    });
    const colorInput = root.querySelector('[data-accent-color]');
    if (colorInput) colorInput.value = this.config.accentColor || '#5865F2';
    const t = root.querySelector('[data-title-input]'); if (t) t.value = this.config.title || '';
    const st = root.querySelector('[data-subtitle-input]'); if (st) st.value = this.config.subtitle || '';
    const th = root.querySelector('[data-thumbnail-input]'); if (th) th.value = this.config.thumbnail || '';
    this._updateColorVisibility();
  }

  _updateColorVisibility() {
    const group = this.container.querySelector('[data-color-group]');
    if (group) group.style.display = this.config.displayMode === 'embed-color' ? 'flex' : 'none';
  }

  _updateCount() {
    const el = this.container.querySelector('[data-block-count]');
    if (el) el.textContent = UI.msgEditor.blocks.count(this.config.blocks.length);
  }

  _renderBlocks() {
    const container = this._blocksEl;
    if (!container) return;
    this.config.blocks.sort((a, b) => {
      if (a.type === 'footer' && b.type !== 'footer') return 1;
      if (a.type !== 'footer' && b.type === 'footer') return -1;
      return 0;
    });
    if (!this.config.blocks.length) {
      container.innerHTML = `<div class="msg-editor-empty">${UI.msgEditor.blocks.empty}</div>`;
      return;
    }
    container.innerHTML = this.config.blocks.map((b, i) => this._renderBlock(b, i)).join('');
    this._bindBlockPickers();
    this._resizeAllTextareas();
  }

  _renderBlock(block, idx) {
    const label = TYPE_LABELS[block.type] || block.type;
    const isFooter = block.type === 'footer';
    const nextIsFooter = this.config.blocks[idx + 1]?.type === 'footer';
    const isCollapsed = this._isCollapsed(block.id);
    const B = UI.msgEditor.blocks;

    return `
      <div class="block-card ${isCollapsed ? 'collapsed' : ''}" data-block-id="${block.id}" data-idx="${idx}">
        <div class="block-head">
          <span class="block-drag-handle" data-drag-handle draggable="true" aria-label="Перетащить">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
          </span>
          <span class="block-type-tag" data-toggle-collapse title="${isCollapsed ? B.expand : B.collapse}">
            <span class="block-collapse-icon">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
            ${label}
          </span>
          <div class="block-actions">
            ${!isFooter ? `<button type="button" class="block-act" data-action="up" title="${B.moveUp}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg></button>` : ''}
            ${!isFooter && !nextIsFooter ? `<button type="button" class="block-act" data-action="down" title="${B.moveDown}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>` : ''}
            <button type="button" class="block-act danger" data-action="remove" title="${B.remove}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
        <div class="block-body">${this._renderBlockBody(block)}</div>
      </div>
    `;
  }

  _renderBlockBody(block) {
    const B = UI.msgEditor.blocks;
    switch (block.type) {
      case 'text':
        return `
          ${this._toolbarHTML()}
          <textarea class="input" data-field="content" rows="3" maxlength="${LIMITS.maxText}">${escapeHtml(block.content || '')}</textarea>
          <div class="char-counter" data-counter>${(block.content || '').length} / ${LIMITS.maxText}</div>
        `;
      case 'sections': return this._sectionsHTML(block);
      case 'separator':
        return `
          <div class="segmented-control" data-spacing-seg>
            <button type="button" class="seg-btn ${block.spacing != 2 ? 'active' : ''}" data-spacing-value="1">${B.spacingSmall}</button>
            <button type="button" class="seg-btn ${block.spacing == 2 ? 'active' : ''}" data-spacing-value="2">${B.spacingLarge}</button>
          </div>
        `;
      case 'image':
      case 'file':
        return `<input class="input" data-field="url" placeholder="${B.filePlaceholder}" value="${escapeHtml(block.url || '')}">`;
      case 'images':
        return `
          <div class="sub-label">${B.urlsLabel}</div>
          <textarea class="input" data-field="urls" rows="3" placeholder="${B.placeholderUrls}">${(block.urls || []).join('\n')}</textarea>
        `;
      case 'buttons': return this._buttonsHTML(block);
      case 'role-buttons': return this._roleButtonsHTML(block);
      case 'footer':
        return `${this._toolbarHTML()}<input class="input" data-field="content" placeholder="${B.footerPlaceholder}" value="${escapeHtml(block.content || '')}">`;
      default: return '';
    }
  }

  _toolbarHTML() {
    const T = UI.msgEditor.toolbar;
    return `
      <div class="editor-toolbar">
        <button type="button" data-format="bold" title="${T.bold}"><b>B</b></button>
        <button type="button" data-format="italic" title="${T.italic}"><i>I</i></button>
        <button type="button" data-format="underline" title="${T.underline}"><u>U</u></button>
        <button type="button" data-format="strike" title="${T.strike}"><s>S</s></button>
        <button type="button" data-format="quote" title="${T.quote}">❝</button>
        <button type="button" data-format="code" title="${T.code}">&lt;/&gt;</button>
        <button type="button" data-format="spoiler" title="${T.spoiler}">▮</button>
        <div class="toolbar-sep"></div>
        <button type="button" data-format="time" class="time-btn" title="${T.insertTime}">${T.time} ▾</button>
        <div class="toolbar-sep"></div>
        <button type="button" data-tokens-btn class="tokens-btn" title="${T.insertVariable}">${T.variables} ▾</button>
      </div>
    `;
  }

  _sectionsHTML(block) {
    const B = UI.msgEditor.blocks;
    const items = block.items || [];
    const isNumeric = block.listStyle !== 'dot';
    return `
      <div class="sub-item-row"><input class="input" data-field="title" placeholder="${B.sectionTitle}" value="${escapeHtml(block.title || '')}"></div>
      <div class="sub-item-row">
        <label style="font-size:12px;color:var(--text-soft);">${B.style}</label>
        <select class="input" data-field="listStyle" style="width:auto;">
          <option value="numeric" ${isNumeric ? 'selected' : ''}>${B.listNumeric}</option>
          <option value="dot" ${!isNumeric ? 'selected' : ''}>${B.listDot}</option>
        </select>
      </div>
      <div class="sub-label">${B.items}</div>
      ${items.map((item, i) => `
        <div class="sub-item-row">
          <span style="min-width:24px;text-align:center;font-size:11.5px;color:var(--muted);">${isNumeric ? (i + 1) + '.' : '·'}</span>
          <input class="input" data-item-idx="${i}" value="${escapeHtml(item)}">
          <button type="button" class="block-act" data-action="remove-item" data-item-idx="${i}" title="${B.remove}">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('')}
      <button type="button" class="btn btn-ghost btn-sm" data-action="add-item">${B.addItem}</button>
    `;
  }

  _buttonsHTML(block) {
    const B = UI.msgEditor.blocks;
    const buttons = block.buttons || [];
    return `
      <div class="sub-label">${B.buttonsLabel(buttons.length, LIMITS.maxButtons)}</div>
      ${buttons.map((btn) => `
        <div class="sub-item" data-button-id="${btn.id}">
          <div class="sub-item-row">
            <input class="input" data-btn-field="label" placeholder="${B.buttonLabelPlaceholder}" maxlength="${LIMITS.maxLabel}" value="${escapeHtml(btn.label || '')}">
            <button type="button" class="block-act danger" data-action="remove-button" data-button-id="${btn.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="sub-item-row"><input class="input" data-btn-field="url" placeholder="${B.buttonUrlPlaceholder}" value="${escapeHtml(btn.url || '')}"></div>
          <div class="sub-item-row">${emojiPickerHTML({ id: btn.id, value: btn.emoji || '' })}</div>
        </div>
      `).join('')}
      ${buttons.length < LIMITS.maxButtons ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-button">${B.addButton}</button>` : ''}
    `;
  }

  _roleButtonsHTML(block) {
    const B = UI.msgEditor.blocks;
    const buttons = block.buttons || [];
    return `
      ${buttons.map((btn) => `
        <div class="sub-item" data-button-id="${btn.id}">
          <div class="sub-item-row">
            <input class="input" data-btn-field="label" placeholder="${B.buttonLabelPlaceholder}" maxlength="${LIMITS.maxLabel}" value="${escapeHtml(btn.label || '')}">
            <select class="input" data-btn-field="style" style="width:120px;">
              <option value="primary" ${btn.style === 'primary' ? 'selected' : ''}>Primary</option>
              <option value="secondary" ${btn.style === 'secondary' ? 'selected' : ''}>Secondary</option>
              <option value="success" ${btn.style === 'success' ? 'selected' : ''}>Success</option>
              <option value="danger" ${btn.style === 'danger' ? 'selected' : ''}>Danger</option>
            </select>
            <button type="button" class="block-act danger" data-action="remove-button" data-button-id="${btn.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="sub-item-row">${rolePickerHTML({ id: btn.id, value: btn.roleId, roles: this.opts.roles || [] })}</div>
          <div class="sub-item-row">${emojiPickerHTML({ id: 'e_' + btn.id, value: btn.emoji || '' })}</div>
        </div>
      `).join('')}
      ${buttons.length < LIMITS.maxButtons ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-role-button">${B.addRoleButton}</button>` : ''}
    `;
  }

  _bindBlockPickers() {
    const container = this._blocksEl;
    if (!container) return;
    container.querySelectorAll('[data-role-picker]').forEach((el) => {
      const id = el.dataset.rolePicker;
      bindRolePicker(container, {
        id, roles: this.opts.roles || [],
        onSelect: (role) => {
          const btn = this._findButtonById(id);
          if (btn) { btn.roleId = role?.id || ''; this._renderPreview(); this._markDirty(); }
        },
      });
    });
    container.querySelectorAll('[data-emoji-picker]').forEach((el) => {
      const id = el.dataset.emojiPicker;
      const realId = id.startsWith('e_') ? id.slice(2) : id;
      bindEmojiPicker(container, {
        id,
        onChange: (emoji) => {
          const btn = this._findButtonById(realId);
          if (btn) { btn.emoji = emoji; this._renderPreview(); this._markDirty(); }
        },
      });
    });
  }

  _findButtonById(id) {
    for (const block of this.config.blocks) {
      if (Array.isArray(block.buttons)) {
        const btn = block.buttons.find((b) => b.id === id);
        if (btn) return btn;
      }
    }
    return null;
  }

  _bind() {
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;

    const root = this.container;

    const settingsCard = root.querySelector('[data-settings-card]');
    const settingsToggle = root.querySelector('[data-settings-toggle]');
    if (settingsCard && settingsToggle) {
      const toggle = () => {
        const collapsed = !settingsCard.classList.contains('collapsed');
        settingsCard.classList.toggle('collapsed', collapsed);
        this._saveSettingsCollapse(collapsed);
        settingsToggle.setAttribute('aria-expanded', String(!collapsed));
        settingsToggle.title = collapsed ? UI.msgEditor.settings.expand : UI.msgEditor.settings.collapse;
        if (!collapsed) requestAnimationFrame(() => {
          settingsCard.querySelectorAll('textarea').forEach((t) => this._autoResize(t));
        });
      };
      settingsToggle.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, textarea, a, label')) return;
        toggle();
      }, { signal });
      settingsToggle.addEventListener('keydown', (e) => {
        if (e.target !== settingsToggle) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }, { signal });
    }

    const templatesCard = root.querySelector('[data-templates-card]');
    const templatesToggle = root.querySelector('[data-templates-toggle]');
    if (templatesCard && templatesToggle) {
      const toggle = () => {
        const collapsed = !templatesCard.classList.contains('collapsed');
        templatesCard.classList.toggle('collapsed', collapsed);
        this._saveTemplatesCollapse(collapsed);
        templatesToggle.setAttribute('aria-expanded', String(!collapsed));
        templatesToggle.title = collapsed ? UI.msgEditor.presets.expand : UI.msgEditor.presets.collapse;
      };
      templatesToggle.addEventListener('click', (e) => {
        if (e.target.closest('button, input, select, textarea, a, label')) return;
        toggle();
      }, { signal });
      templatesToggle.addEventListener('keydown', (e) => {
        if (e.target !== templatesToggle) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      }, { signal });
    }

    root.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.preset;
        const preset = this._presets.find((p) => p.key === key);
        if (preset) await this._applyPreset(preset);
      }, { signal });
    });

    const clearBtn = root.querySelector('[data-clear-template]');
    if (clearBtn) clearBtn.addEventListener('click', () => this._clearConfig(), { signal });

    root.querySelectorAll('[data-mode-seg] .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('[data-mode-seg] .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        this.config.displayMode = btn.dataset.value;
        this._updateColorVisibility();
        this._renderPreview();
        this._markDirty();
      }, { signal });
    });

    const colorInput = root.querySelector('[data-accent-color]');
    if (colorInput) colorInput.addEventListener('input', () => {
      this.config.accentColor = colorInput.value;
      this._renderPreview();
      this._markDirty();
    }, { signal });

    const bind = (sel, key) => {
      const el = root.querySelector(sel);
      if (!el) return;
      el.addEventListener('input', () => {
        this.config[key] = el.value;
        this._renderPreview();
        this._markDirty();
      }, { signal });
    };
    bind('[data-title-input]', 'title');
    bind('[data-subtitle-input]', 'subtitle');
    bind('[data-thumbnail-input]', 'thumbnail');

    const addMenu = root.querySelector('[data-add-menu]');
    if (addMenu) addMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      const type = btn.dataset.add;
      if (this.config.blocks.length >= LIMITS.maxBlocks) return;
      if (type === 'footer' && this.config.blocks.some((b) => b.type === 'footer')) return;
      this.config.blocks.push(this._createBlock(type));
      this._renderBlocks(); this._renderPreview(); this._updateCount(); this._markDirty();
    }, { signal });

    root.addEventListener('click', (e) => {
      const tokensBtn = e.target.closest('[data-tokens-btn]');
      if (tokensBtn && tokensBtn.closest('.editor-toolbar')) {
        e.preventDefault();
        e.stopPropagation();
        const blockCard = tokensBtn.closest('.block-card');
        let target;
        if (blockCard) {
          target = blockCard.querySelector('textarea[data-field="content"]') || blockCard.querySelector('input[data-field="content"]');
        } else {
          const field = tokensBtn.closest('.form-field');
          target = field?.querySelector('textarea');
        }
        if (target) this._showTokensMenu(tokensBtn, target);
        return;
      }

      const fmtBtn = e.target.closest('[data-format]');
      if (!fmtBtn || !fmtBtn.closest('.editor-toolbar')) return;
      e.preventDefault();
      e.stopPropagation();
      const blockCard = fmtBtn.closest('.block-card');
      let target;
      if (blockCard) {
        target = blockCard.querySelector('textarea[data-field="content"]') || blockCard.querySelector('input[data-field="content"]');
      } else {
        const field = fmtBtn.closest('.form-field');
        target = field?.querySelector('textarea');
      }
      if (target) this._handleFormat(fmtBtn, target);
    }, { signal });

    root.addEventListener('input', (e) => {
      if (e.target.tagName === 'TEXTAREA') this._autoResize(e.target);
    }, { signal });

    const blocksEl = this._blocksEl;
    if (blocksEl) {
      blocksEl.addEventListener('click', (e) => this._handleBlockClick(e), { signal });
      blocksEl.addEventListener('input', (e) => this._handleBlockInput(e), { signal });
      blocksEl.addEventListener('change', (e) => this._handleBlockInput(e), { signal });

      blocksEl.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('[data-drag-handle]');
        if (!handle) { e.preventDefault(); return; }
        const card = handle.closest('.block-card');
        if (!card) return;
        this._dragSrcIndex = parseInt(card.dataset.idx);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(this._dragSrcIndex));
      }, { signal });
      blocksEl.addEventListener('dragend', () => {
        blocksEl.querySelectorAll('.block-card').forEach((c) => c.classList.remove('dragging', 'drag-over'));
      }, { signal });
      blocksEl.addEventListener('dragover', (e) => {
        const card = e.target.closest('.block-card');
        if (!card) return;
        e.preventDefault();
        blocksEl.querySelectorAll('.block-card').forEach((c) => c.classList.remove('drag-over'));
        if (parseInt(card.dataset.idx) !== this._dragSrcIndex) card.classList.add('drag-over');
      }, { signal });
      blocksEl.addEventListener('drop', (e) => {
        const card = e.target.closest('.block-card');
        if (!card) return;
        e.preventDefault();
        const toIdx = parseInt(card.dataset.idx);
        if (toIdx === this._dragSrcIndex || this._dragSrcIndex < 0) return;
        const [moved] = this.config.blocks.splice(this._dragSrcIndex, 1);
        this.config.blocks.splice(toIdx, 0, moved);
        this._dragSrcIndex = -1;
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      }, { signal });
    }
  }

  _handleBlockClick(e) {
    const card = e.target.closest('.block-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx);
    const block = this.config.blocks[idx];
    if (!block) return;

    const typeTag = e.target.closest('[data-toggle-collapse]');
    if (typeTag) {
      e.preventDefault();
      const collapsed = this._toggleCollapse(block.id);
      card.classList.toggle('collapsed', collapsed);
      typeTag.title = collapsed ? UI.msgEditor.blocks.expand : UI.msgEditor.blocks.collapse;
      if (!collapsed) requestAnimationFrame(() => {
        card.querySelectorAll('textarea').forEach((t) => this._autoResize(t));
      });
      return;
    }

    const spacingBtn = e.target.closest('[data-spacing-value]');
    if (spacingBtn) {
      e.preventDefault();
      block.spacing = parseInt(spacingBtn.dataset.spacingValue, 10);
      spacingBtn.parentElement.querySelectorAll('[data-spacing-value]').forEach((b) => b.classList.toggle('active', b === spacingBtn));
      this._renderPreview(); this._markDirty();
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.preventDefault();
      const action = actionBtn.dataset.action;
      const buttonId = actionBtn.dataset.buttonId;
      const itemIdx = parseInt(actionBtn.dataset.itemIdx);

      if (action === 'up' && idx > 0) {
        this.config.blocks.splice(idx - 1, 0, this.config.blocks.splice(idx, 1)[0]);
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'down' && idx < this.config.blocks.length - 1) {
        this.config.blocks.splice(idx + 1, 0, this.config.blocks.splice(idx, 1)[0]);
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'remove') {
        this.config.blocks.splice(idx, 1);
        this._renderBlocks(); this._renderPreview(); this._updateCount(); this._markDirty();
      } else if (action === 'add-button') {
        if (!block.buttons) block.buttons = [];
        if (block.buttons.length >= LIMITS.maxButtons) return;
        block.buttons.push({ id: uid(), label: 'Ссылка', url: '', emoji: '' });
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'add-role-button') {
        if (!block.buttons) block.buttons = [];
        if (block.buttons.length >= LIMITS.maxButtons) return;
        block.buttons.push({ id: uid(), label: 'Роль', style: 'primary', roleId: '', emoji: '' });
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'remove-button') {
        block.buttons = (block.buttons || []).filter((b) => b.id !== buttonId);
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'add-item') {
        if (!block.items) block.items = [];
        block.items.push('');
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'remove-item') {
        block.items.splice(itemIdx, 1);
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      }
    }
  }

  _handleBlockInput(e) {
    const card = e.target.closest('.block-card');
    if (!card) return;
    const idx = parseInt(card.dataset.idx);
    const block = this.config.blocks[idx];
    if (!block) return;

    const field = e.target.dataset.field;
    const btnField = e.target.dataset.btnField;
    const buttonId = e.target.closest('[data-button-id]')?.dataset.buttonId;
    const itemIdx = e.target.dataset.itemIdx;

    if (field) {
      if (field === 'urls') block.urls = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
      else if (field === 'listStyle') { block.listStyle = e.target.value; this._renderBlocks(); }
      else if (field === 'content') {
        block.content = e.target.value;
        const counter = card.querySelector('[data-counter]');
        if (counter) {
          counter.textContent = `${e.target.value.length} / ${LIMITS.maxText}`;
          counter.classList.toggle('warn', e.target.value.length > LIMITS.maxText * 0.9);
        }
      } else block[field] = e.target.value;
    } else if (btnField && buttonId) {
      const btn = (block.buttons || []).find((b) => b.id === buttonId);
      if (btn) btn[btnField] = e.target.value;
    } else if (itemIdx !== undefined && field === undefined) {
      if (!block.items) block.items = [];
      block.items[parseInt(itemIdx)] = e.target.value;
    }
    this._renderPreview();
    this._markDirty();
  }

  _handleFormat(btn, target) {
    if (!target) return;
    const format = btn.dataset.format;
    if (format === 'time') return this._showTimeMenu(btn, target);

    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const value = target.value;
    const selected = value.substring(start, end);
    const wrap = { bold: '**', italic: '*', underline: '__', strike: '~~', code: '`', spoiler: '||' }[format];

    if (format === 'quote') {
      const text = selected || 'цитата';
      const quoted = text.split('\n').map((l) => '> ' + l).join('\n');
      target.value = value.substring(0, start) + quoted + value.substring(end);
      target.selectionStart = start;
      target.selectionEnd = start + quoted.length;
    } else if (wrap) {
      const insert = selected || format;
      target.value = value.substring(0, start) + wrap + insert + wrap + value.substring(end);
      target.selectionStart = start + wrap.length;
      target.selectionEnd = start + wrap.length + insert.length;
    }
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  _showTimeMenu(anchor, target) {
    // Закрываем все открытые попапы (picker + time + tokens), иначе
    // они накладываются друг на друга.
    document.querySelectorAll('.time-dropdown, .tokens-dropdown, .picker-popup').forEach((d) => d.remove());

    const dd = document.createElement('div');
    dd.className = 'time-dropdown';
    dd.innerHTML = TIME_FORMAT_CODES.map(([code, label]) => `<button type="button" data-code="${code}">${label}</button>`).join('');
    document.body.appendChild(dd);
    positionPopup(dd, anchor, 240);
    const close = (ev) => {
      if (!dd.contains(ev.target) && !anchor.contains(ev.target)) {
        dd.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    dd.addEventListener('click', (e) => {
      const b = e.target.closest('[data-code]');
      if (!b) return;
      e.preventDefault();
      this._insertToken(target, `{time:${b.dataset.code}}`);
      dd.remove();
      document.removeEventListener('mousedown', close);
    });
  }

  _showTokensMenu(anchor, target) {
    // Закрываем все открытые попапы.
    document.querySelectorAll('.time-dropdown, .tokens-dropdown, .picker-popup').forEach((d) => d.remove());

    const dd = document.createElement('div');
    dd.className = 'tokens-dropdown';

    dd.innerHTML = this._ctx.categories.map((cat) => `
      <div class="tokens-category">
        <div class="tokens-category-label">${escapeHtml(cat.label)}</div>
        ${cat.items.map(([id, desc]) => `
          <button type="button" class="tokens-item" data-token-id="${escapeHtml(id)}">
            <code class="tokens-item-code">{${escapeHtml(id)}}</code>
            <span class="tokens-item-desc">${escapeHtml(desc || '')}</span>
          </button>
        `).join('')}
      </div>
    `).join('');

    document.body.appendChild(dd);
    positionPopup(dd, anchor, 280);

    const close = (ev) => {
      if (!dd.contains(ev.target) && !anchor.contains(ev.target)) {
        dd.remove();
        document.removeEventListener('mousedown', close);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);

    dd.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-token-id]');
      if (!btn) return;
      e.preventDefault();
      this._insertToken(target, `{${btn.dataset.tokenId}}`);
      dd.remove();
      document.removeEventListener('mousedown', close);
    });
  }

  _insertToken(target, token) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const value = target.value;
    target.value = value.substring(0, start) + token + value.substring(end);
    target.selectionStart = target.selectionEnd = start + token.length;
    target.focus();
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }

  _createBlock(type) {
    const id = uid();
    switch (type) {
      case 'text': return { id, type: 'text', content: '' };
      case 'sections': return { id, type: 'sections', title: '', listStyle: 'numeric', items: [''] };
      case 'separator': return { id, type: 'separator', spacing: 1 };
      case 'image': return { id, type: 'image', url: '' };
      case 'images': return { id, type: 'images', urls: [] };
      case 'file': return { id, type: 'file', url: '' };
      case 'buttons': return { id, type: 'buttons', buttons: [{ id: uid(), label: 'Ссылка', url: '', emoji: '' }] };
      case 'role-buttons': return { id, type: 'role-buttons', buttons: [{ id: uid(), label: 'Роль', style: 'primary', roleId: '', emoji: '' }] };
      case 'footer': return { id, type: 'footer', content: '' };
      default: return { id, type: 'text', content: '' };
    }
  }

  _renderPreview() {
    if (!this._previewEl) return;
    const inner = this._buildPreviewInner(this.config);
    const emptyText = `<div class="dp-empty">${UI.msgEditor.preview.empty}</div>`;
    if (this.config.displayMode === 'flat') {
      this._previewEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">${inner || emptyText}</div>`;
    } else {
      const color = this.config.displayMode === 'embed-color' && this.config.accentColor
        ? `border-left:4px solid ${this.config.accentColor};`
        : 'border-left:1px solid rgba(255,255,255,.08);';
      this._previewEl.innerHTML = `<div class="dp-container" style="${color}">${inner || emptyText}</div>`;
    }
  }

  _buildPreviewInner(r) {
    let html = '';
    if (r.title || r.subtitle) {
      const header = `
        <div class="dp-header-text">
          ${r.title ? `<div class="dp-title">${this._md(r.title)}</div>` : ''}
          ${r.subtitle ? `<div class="dp-subtitle">${this._md(r.subtitle)}</div>` : ''}
        </div>
      `;
      const thumbSrc = this._resolveUrl(r.thumbnail);
      html += thumbSrc
        ? `<div class="dp-header">${header}<img class="dp-thumbnail" src="${escapeHtml(thumbSrc)}" alt=""></div>`
        : `<div class="dp-header">${header}</div>`;
    }
    for (const block of r.blocks || []) {
      switch (block.type) {
        case 'text':
          if (block.content) html += `<div class="dp-text">${this._md(block.content)}</div>`;
          break;
        case 'sections': {
          let s = '';
          if (block.title) s += `<div class="dp-heading">${this._md(block.title)}</div>`;
          if (block.items?.length) {
            const itemsHtml = block.items.map((item, i) => {
              const prefix = block.listStyle === 'dot' ? '·' : (i + 1) + '.';
              return `<span style="display:inline-block;min-width:10px;color:#949ba4;">${prefix}</span>${this._md(item)}`;
            }).join('<br>');
            s += `<div class="dp-text" style="margin-top:4px;">${itemsHtml}</div>`;
          }
          if (s) html += s;
          break;
        }
        case 'separator':
          html += `<div class="dp-separator ${block.spacing == 2 ? 'large' : ''}"></div>`;
          break;
        case 'image':
        case 'file': {
          const src = this._resolveUrl(block.url);
          if (src) html += `<img class="dp-image" src="${escapeHtml(src)}" alt="">`;
          break;
        }
        case 'images': {
          const urls = (block.urls || []).map((u) => this._resolveUrl(u)).filter(Boolean);
          if (urls.length) html += `<div class="dp-images-grid ${urls.length === 1 ? 'single' : ''}">${urls.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join('')}</div>`;
          break;
        }
        case 'buttons':
          if (block.buttons?.length) html += `<div class="dp-buttons">${block.buttons.map((b) => `<button type="button" class="dp-btn link">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Ссылка')}</button>`).join('')}</div>`;
          break;
        case 'role-buttons':
          if (block.buttons?.length) html += `<div class="dp-buttons">${block.buttons.map((b) => `<button type="button" class="dp-btn ${b.style || 'primary'}">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Роль')}</button>`).join('')}</div>`;
          break;
        case 'footer':
          if (block.content) html += `<div class="dp-footer">${this._md(block.content)}</div>`;
          break;
      }
    }
    return html;
  }

  _resolveUrl(url) {
    if (!url) return '';
    const t = String(url).trim();
    if (t === '{avatarUrl}') return this._previewTokens?.avatarUrl || '';
    if (t === '{guildIconUrl}') return this._previewTokens?.guildIconUrl || '';
    return t;
  }

  _md(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/&lt;t:(\d+):([RrFfDdTt])&gt;/g, (_, u, c) =>
      `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(parseInt(u, 10) * 1000), c))}</span>`
    );
    html = html.replace(/\{time(?::([RrFfDdTt]))?\}/g, (_, c) =>
      `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(), c || 'f'))}</span>`
    );

    const t = this._previewTokens;
    const wrapMention = (v) => `<span class="dp-mention">${escapeHtml(v)}</span>`;
    const wrapBold = (v) => `<b>${escapeHtml(v)}</b>`;
    const wrapAccent = (v) => `<span style="color:#c9cdfb;">${escapeHtml(v)}</span>`;

    html = html.replace(/\{user\}/g, wrapMention(t.user || ''));
    html = html.replace(/\{mention\}/g, wrapMention(t.mention || t.user || ''));
    html = html.replace(/\{username\}/g, wrapAccent(t.username || ''));
    html = html.replace(/\{displayName\}/g, wrapBold(t.displayName || ''));
    html = html.replace(/\{guild\}/g, wrapBold(t.guild || ''));
    html = html.replace(/\{count\}/g, t.count != null ? String(t.count) : '');

    html = html.replace(/\{level\}/g, wrapBold(t.level || ''));
    html = html.replace(/\{oldLevel\}/g, t.oldLevel != null ? String(t.oldLevel) : '');
    html = html.replace(/\{title\}/g, `<span class="dp-mention role">${escapeHtml(t.title || '')}</span>`);
    html = html.replace(/\{xp\}/g, wrapBold(t.xp || ''));
    html = html.replace(/\{nextLevelXp\}/g, t.nextLevelXp != null ? String(t.nextLevelXp) : '');
    html = html.replace(/\{xpToNext\}/g, wrapBold(t.xpToNext || ''));
    html = html.replace(/\{progress\}/g, t.progress || '');
    html = html.replace(/\{progressPercent\}/g, (t.progressPercent != null ? String(t.progressPercent) : '') + '%');
    html = html.replace(/\{position\}/g, t.position ? wrapBold('#' + t.position) : '');
    html = html.replace(/\{rank\}/g, t.rank ? wrapBold('#' + t.rank) : '');
    html = html.replace(/\{rewardRole\}/g, t.rewardRole ? wrapMention(t.rewardRole) : '');

    /* ── Дополнительные токены для leaderboard/daily ── */
    html = html.replace(/\{topUsers\}/g, () => {
      if (!t.topUsers) return '';
      // topUsers содержит markdown с `<@id>`. Прогоняем через локальный escape
      // и превращаем `<@id>` → span.dp-mention для предпросмотра.
      return escapeHtml(String(t.topUsers))
        .replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="dp-mention role">@$1</span>')
        .replace(/&lt;@(\d+)&gt;/g, '<span class="dp-mention">@$1</span>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\n/g, '<br>');
    });
    html = html.replace(/\{topCount\}/g, t.topCount != null ? String(t.topCount) : '');
    html = html.replace(/\{xpGained\}/g, t.xpGained != null ? wrapBold(String(t.xpGained)) : '');
    html = html.replace(/\{newXp\}/g, t.newXp != null ? wrapBold(String(t.newXp)) : '');
    html = html.replace(/\{newLevel\}/g, t.newLevel != null ? wrapBold(String(t.newLevel)) : '');
    html = html.replace(/\{nextDailyAt\}/g, () => {
      if (!t.nextDailyAt) return '';
      const m = String(t.nextDailyAt).match(/^<t:(\d+):(\w)>$/);
      if (m) {
        try {
          return `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(parseInt(m[1], 10) * 1000), m[2]))}</span>`;
        } catch {}
      }
      return escapeHtml(String(t.nextDailyAt));
    });
    html = html.replace(/\{streakDays\}/g, t.streakDays != null ? String(t.streakDays) : '');

    html = html.replace(/\{avatarUrl\}/g, '<span class="dp-mention">[avatar]</span>');
    html = html.replace(/\{guildIconUrl\}/g, '<span class="dp-mention">[icon]</span>');

    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="dp-link">$1</a>');
    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="dp-spoiler">$1</span>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    html = html.replace(/__(.+?)__/g, '<u>$1</u>');
    html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
    html = html.replace(/```([\s\S]+?)```/g, '<code style="display:block;padding:8px;border-radius:4px;background:#1e1f22;margin:4px 0;">$1</code>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^&gt; (.+)$/gm, '<div class="dp-quote">$1</div>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }
}