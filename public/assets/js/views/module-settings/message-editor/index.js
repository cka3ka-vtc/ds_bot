// public/assets/js/views/module-settings/message-editor/index.js
import { api } from '../../../core/api.js';
import { store } from '../../../core/store.js';
import { openModal } from '../../../core/modal.js';
import { escapeHtml } from '../../../core/utils.js';
import { getPresetsFor } from '/shared/message-presets.js';
import { UI } from '/shared/ui-strings.js';
import { getTokensFor } from '../message-editor-tokens.js';
import { uid, debounce, emptyMessageConfig } from './helpers.js';

import { mountRenderMethods } from './render.js';
import { mountBlockMethods } from './blocks.js';
import { mountPreviewMethods } from './preview.js';
import { mountToolbarMethods } from './toolbar.js';
import { mountPresetsMethods } from './presets-ui.js';
import { mountBindMethods } from './bind.js';

export { emptyMessageConfig };

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

    // Скрыть displayMode-селектор (mode/accent/thumbnail) в UI.
    // Используется в модулях, где сообщение уходит как content (v2ConfigToMarkdown)
    // или как embed-без-опций (moderation DM). В V2-модулях (sticky, scheduled,
    // message-templates, commands) НЕ передаётся — там mode работает как раньше.
    this._hideDisplayMode = !!opts.hideDisplayMode;

    // Скрытие отдельных типов блоков (напр. role-buttons в moderation DM).
    this._hiddenBlockTypes = new Set(opts.hideBlockTypes || []);

    this._collapseKey = `msg_editor_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;
    this._settingsCollapseKey = `msg_editor_settings_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;
    this._templatesCollapseKey = `msg_editor_templates_collapsed_${opts.guildId || 'x'}_${opts.context || 'default'}`;

    this._ctx = getTokensFor(opts.context);
    this._previewTokens = { ...this._ctx.preview, ...(opts.previewTokens || {}) };

    this._botAvatarUrl = opts.bot?.avatarUrl || '';
    this._presets = getPresetsFor(opts.presetKey || opts.context || '');
    this._resetFactory = typeof opts.resetFactory === 'function' ? opts.resetFactory : null;
    this._markDirty = debounce(() => this.onChange?.(this.getConfig()), 150);
  }

  mount() {
    if (this._hiddenBlockTypes.size > 0) {
      this.config.blocks = (this.config.blocks || [])
        .filter((b) => !this._hiddenBlockTypes.has(b.type));
    }
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
    } catch {}
  }

  _loadCollapseState() {
    try { const raw = localStorage.getItem(this._collapseKey); return raw ? JSON.parse(raw) : {}; }
    catch { return {}; }
  }
  _saveCollapseState(s) { try { localStorage.setItem(this._collapseKey, JSON.stringify(s)); } catch {} }
  _isCollapsed(id) { return !!this._loadCollapseState()[id]; }
  _toggleCollapse(id) {
    const s = this._loadCollapseState();
    s[id] = !s[id];
    this._saveCollapseState(s);
    return s[id];
  }

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
  _resizeAllTextareas() {
    this.container.querySelectorAll('textarea').forEach((t) => this._autoResize(t));
  }

  async _confirm({ title, text, ctaLabel }) {
    const result = await openModal({
      title,
      body: `<div style="padding:4px 0; font-size:14px; line-height:1.55; color:var(--text-soft);">${escapeHtml(text)}</div>`,
      ctaLabel: ctaLabel || UI.common.confirm,
      onSubmit: async () => true,
    });
    return result === true;
  }

  _rerenderAndRebind() {
    this._render();
    this._bind();
    requestAnimationFrame(() => this._resizeAllTextareas());
  }

  _updateCount() {
    const el = this.container.querySelector('[data-block-count]');
    if (el) el.textContent = UI.msgEditor.blocks.count(this.config.blocks.length);
  }
}

mountRenderMethods(MessageEditor);
mountBlockMethods(MessageEditor);
mountPreviewMethods(MessageEditor);
mountToolbarMethods(MessageEditor);
mountPresetsMethods(MessageEditor);
mountBindMethods(MessageEditor);