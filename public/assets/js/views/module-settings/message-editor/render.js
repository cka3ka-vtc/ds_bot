// public/assets/js/views/module-settings/message-editor/render.js
import { escapeHtml } from '../../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

/**
 * Рендер каркаса редактора: карточка шаблонов (если есть),
 * карточка настроек, карточка блоков, карточка preview.
 * Заполняет this._root, this._blocksEl, this._previewEl.
 */
export function mountRenderMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

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
    },

    _addMenuButtons() {
      const B = UI.msgEditor.blocks;
      return [
        ['text', B.addText], ['sections', B.addSections], ['separator', B.addSeparator],
        ['image', B.addImage], ['images', B.addImages], ['file', B.addFile],
        ['buttons', B.addButtons], ['role-buttons', B.addRoleButtons], ['footer', B.addFooter],
      ].map(([t, l]) => `<button type="button" data-add="${t}">${l}</button>`).join('');
    },

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
    },

    _updateColorVisibility() {
      const group = this.container.querySelector('[data-color-group]');
      if (group) group.style.display = this.config.displayMode === 'embed-color' ? 'flex' : 'none';
    },

  });
}