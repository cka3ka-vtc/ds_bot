// public/assets/js/views/module-settings/message-editor/blocks.js
import { escapeHtml } from '../../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  rolePickerHTML, bindRolePicker,
  emojiPickerHTML, bindEmojiPicker,
} from '../pickers.js';
import { uid, LIMITS, TYPE_LABELS } from './helpers.js';
import {
  defaultRoleSuccessAddResponse,
  defaultRoleSuccessRemoveResponse,
  defaultRoleErrorResponse,
} from '/shared/role-button-responses.js';

const B = UI.msgEditor.blocks;

function tokenBtnHTML() {
  return `<button type="button" class="block-act" data-tokens-for="any"
                   title="${escapeHtml(B.insertVariable)}"
                   aria-label="${escapeHtml(B.insertVariable)}">
            <i class="fa-solid fa-code"></i>
          </button>`;
}

/** Готовая структура кнопки-роли с тремя дефолтными ответами. */
function makeRoleButton() {
  return {
    id: uid(),
    label: 'Роль',
    style: 'primary',
    roleId: '',
    emoji: '',
    successAddResponse: defaultRoleSuccessAddResponse(),
    successRemoveResponse: defaultRoleSuccessRemoveResponse(),
    errorResponse: defaultRoleErrorResponse(),
  };
}

export function mountBlockMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

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

      container.innerHTML = this.config.blocks
        .map((b, i) => this._renderBlock(b, i))
        .join('');

      this._bindBlockPickers();
      this._resizeAllTextareas();
    },

    _renderBlock(block, idx) {
      const label = TYPE_LABELS[block.type] || block.type;
      const isFooter = block.type === 'footer';
      const nextIsFooter = this.config.blocks[idx + 1]?.type === 'footer';
      const isCollapsed = this._isCollapsed(block.id);

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
    },

    _renderBlockBody(block) {
      switch (block.type) {
        case 'text':
          return `
            ${this._toolbarHTML()}
            <textarea class="input" data-field="content" data-token-context="rich"
                      rows="3" maxlength="${LIMITS.maxText}">${escapeHtml(block.content || '')}</textarea>
            <div class="char-counter" data-counter>${(block.content || '').length} / ${LIMITS.maxText}</div>
          `;

        case 'sections': {
          const items = block.items || [];
          const isNumeric = block.listStyle !== 'dot';
          return `
            <div class="sub-item-row">
              <input class="input" data-field="title" data-token-context="rich"
                     placeholder="${B.sectionTitle}" value="${escapeHtml(block.title || '')}">
              ${tokenBtnHTML()}
            </div>
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
                <input class="input" data-item-idx="${i}" data-token-context="rich"
                       value="${escapeHtml(item)}">
                ${tokenBtnHTML()}
                <button type="button" class="block-act" data-action="remove-item" data-item-idx="${i}" title="${B.remove}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            `).join('')}
            <button type="button" class="btn btn-ghost btn-sm" data-action="add-item">${B.addItem}</button>
          `;
        }

        case 'separator':
          return `
            <div class="segmented-control" data-spacing-seg>
              <button type="button" class="seg-btn ${block.spacing != 2 ? 'active' : ''}" data-spacing-value="1">${B.spacingSmall}</button>
              <button type="button" class="seg-btn ${block.spacing == 2 ? 'active' : ''}" data-spacing-value="2">${B.spacingLarge}</button>
            </div>
          `;

        case 'image':
        case 'file':
          return `
            <div class="sub-item-row">
              <input class="input" data-field="url" data-token-context="url"
                     placeholder="${B.filePlaceholder}" value="${escapeHtml(block.url || '')}">
              ${tokenBtnHTML()}
            </div>
          `;

        case 'images':
          return `
            <div class="sub-label">${B.urlsLabel}</div>
            <div class="sub-item-row" style="align-items:flex-start;">
              <textarea class="input" data-field="urls" data-token-context="url"
                        rows="3" placeholder="${B.placeholderUrls}">${(block.urls || []).join('\n')}</textarea>
              ${tokenBtnHTML()}
            </div>
          `;

        case 'buttons': {
          const buttons = block.buttons || [];
          return `
            <div class="sub-label">${B.buttonsLabel(buttons.length, LIMITS.maxButtons)}</div>
            ${buttons.map((btn) => `
              <div class="sub-item" data-button-id="${btn.id}">
                <div class="sub-item-row">
                  <input class="input" data-btn-field="label" data-token-context="label"
                         placeholder="${B.buttonLabelPlaceholder}" maxlength="${LIMITS.maxLabel}"
                         value="${escapeHtml(btn.label || '')}">
                  ${tokenBtnHTML()}
                  <button type="button" class="block-act danger" data-action="remove-button" data-button-id="${btn.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <div class="sub-item-row">
                  <input class="input" data-btn-field="url" data-token-context="url"
                         placeholder="${B.buttonUrlPlaceholder}" value="${escapeHtml(btn.url || '')}">
                  ${tokenBtnHTML()}
                </div>
                <div class="sub-item-row">${emojiPickerHTML({ id: btn.id, value: btn.emoji || '' })}</div>
              </div>
            `).join('')}
            ${buttons.length < LIMITS.maxButtons ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-button">${B.addButton}</button>` : ''}
          `;
        }

        case 'role-buttons': {
          const buttons = block.buttons || [];
          return `
            ${buttons.map((btn) => `
              <div class="sub-item" data-button-id="${btn.id}">
                <div class="sub-item-row">
                  <input class="input" data-btn-field="label" data-token-context="label"
                         placeholder="${B.buttonLabelPlaceholder}" maxlength="${LIMITS.maxLabel}"
                         value="${escapeHtml(btn.label || '')}">
                  ${tokenBtnHTML()}
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
                <div class="sub-item-row">
                  <button type="button" class="btn btn-ghost btn-sm" data-action="edit-role-responses" data-button-id="${btn.id}">
                    <i class="fa-solid fa-reply"></i> ${B.roleResponses || 'Ответы'}
                  </button>
                </div>
              </div>
            `).join('')}
            ${buttons.length < LIMITS.maxButtons ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-role-button">${B.addRoleButton}</button>` : ''}
          `;
        }

        case 'footer':
          return `
            ${this._toolbarHTML()}
            <input class="input" data-field="content" data-token-context="footer"
                   placeholder="${B.footerPlaceholder}" value="${escapeHtml(block.content || '')}">
          `;

        default: return '';
      }
    },

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
    },

    _findButtonById(id) {
      for (const block of this.config.blocks) {
        if (Array.isArray(block.buttons)) {
          const btn = block.buttons.find((b) => b.id === id);
          if (btn) return btn;
        }
      }
      return null;
    },

    _createBlock(type) {
      const id = uid();
      switch (type) {
        case 'text': return { id, type: 'text', content: '' };
        case 'sections': return { id, type: 'sections', title: '', listStyle: 'numeric', items: [''] };
        case 'separator': return { id, type: 'separator', spacing: 1 };
        case 'image': return { id, type: 'image', url: '' };
        case 'images': return { id, type: 'images', urls: [] };
        case 'file': return { id, type: 'file', url: '' };
        case 'buttons': return { id, type: 'buttons', buttons: [{ id: uid(), label: 'Кнопка', url: '', emoji: '' }] };
        case 'role-buttons': return { id, type: 'role-buttons', buttons: [makeRoleButton()] };
        case 'footer': return { id, type: 'footer', content: '' };
        default: return { id, type: 'text', content: '' };
      }
    },

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
        typeTag.title = collapsed ? B.expand : B.collapse;
        if (!collapsed) requestAnimationFrame(() => {
          card.querySelectorAll('textarea').forEach((t) => this._autoResize(t));
        });
        return;
      }

      const spacingBtn = e.target.closest('[data-spacing-value]');
      if (spacingBtn) {
        e.preventDefault();
        block.spacing = parseInt(spacingBtn.dataset.spacingValue, 10);
        spacingBtn.parentElement.querySelectorAll('[data-spacing-value]').forEach((b) =>
          b.classList.toggle('active', b === spacingBtn));
        this._renderPreview(); this._markDirty();
        return;
      }

      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
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
        block.buttons.push({ id: uid(), label: 'Кнопка', url: '', emoji: '' });
        this._renderBlocks(); this._renderPreview(); this._markDirty();
      } else if (action === 'add-role-button') {
        if (!block.buttons) block.buttons = [];
        if (block.buttons.length >= LIMITS.maxButtons) return;
        block.buttons.push(makeRoleButton());
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
      } else if (action === 'edit-role-responses') {
        const btn = (block.buttons || []).find((b) => b.id === buttonId);
        if (!btn) return;
        import('./role-response-modal.js').then(({ openRoleResponseModal }) => {
          openRoleResponseModal({
            btn,
            bot: this.opts.bot,
            roles: this.opts.roles || [],
            guildId: this.opts.guildId,
            botId: this.opts.botId,
          }).then((result) => {
            if (result && result.successAddResponse) {
              btn.successAddResponse = result.successAddResponse;
              btn.successRemoveResponse = result.successRemoveResponse;
              btn.errorResponse = result.errorResponse;
              this._markDirty();
            }
          });
        });
      }
    },

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
        if (field === 'urls') {
          block.urls = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
        } else if (field === 'listStyle') {
          block.listStyle = e.target.value;
          this._renderBlocks();
        } else if (field === 'content') {
          block.content = e.target.value;
          const counter = card.querySelector('[data-counter]');
          if (counter) {
            counter.textContent = `${e.target.value.length} / ${LIMITS.maxText}`;
            counter.classList.toggle('warn', e.target.value.length > LIMITS.maxText * 0.9);
          }
        } else {
          block[field] = e.target.value;
        }
      } else if (btnField && buttonId) {
        const btn = (block.buttons || []).find((b) => b.id === buttonId);
        if (btn) btn[btnField] = e.target.value;
      } else if (itemIdx !== undefined && field === undefined) {
        if (!block.items) block.items = [];
        block.items[parseInt(itemIdx)] = e.target.value;
      }

      this._renderPreview();
      this._markDirty();
    },

  });
}