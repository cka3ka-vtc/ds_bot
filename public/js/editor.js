/* ============================================================
   Редактор блоков сообщений (Components v2).

   Позволяет:
   - добавлять/удалять/переупорядочивать блоки
   - редактировать текст с toolbar (bold, italic, code, …)
   - настраивать кнопки-ссылки и кнопки-роли
   - видеть живой preview справа
   - хранить историю (undo/redo)
   - автосохранять черновик в localStorage

   Работает в контекстах: rules, message, announcement, delayed,
   birthdays, profiles, ephemeral (для кнопок-ролей).
   ============================================================ */

import { state, loadCollapsed, saveCollapsed } from './state.js';
import { uid, escapeHtml, formatDateByCode, debounce } from './utils.js';
import {
  channelPickerHTML, bindChannelPicker,
  rolePickerHTML, bindRolePicker,
  emojiPickerHTML, bindEmojiPicker,
  positionPopup, channelIcon
} from './pickers.js';
import { toast } from './ui.js';

/* ============================================================
   Константы и словари
   ============================================================ */

const LIMITS = {
  MAX_BLOCKS: 40,
  MAX_BUTTONS: 5,
  MAX_TEXT: 4000,
  MAX_LABEL: 80
};

const TYPE_LABELS = {
  text: 'Текст',
  sections: 'Секции',
  separator: 'Разделитель',
  image: 'Картинка',
  images: 'Картинки',
  file: 'Файл',
  buttons: 'Кнопки',
  'role-buttons': 'Кнопки ролей',
  footer: 'Подпись'
};

/* Не поддерживаемые типы из старых версий — вычищаем при загрузке */
const UNSUPPORTED_TYPES = new Set(['thumbnail', 'select-menu']);

/* Токены, требующие {format} → редактор вставляет в текст */
const TOKEN_FORMATS = new Set([
  'role', 'until', 'user', 'age',
  'mention', 'birthday', 'links',
  'vtc', 'steam', 'haulmp', 'truckersmp',
  'companySince', 'companyDuration'
]);

/* Токены профиля (для контекста 'profiles') */
const PROFILE_TOKENS = [
  ['mention', '{mention}', 'Упоминание'],
  ['birthday', '{birthday}', 'Дата рождения'],
  ['age', '{age}', 'Возраст'],
  ['links', '{links}', 'Все ссылки'],
  ['vtc', '{vtc}', 'VTC'],
  ['steam', '{steam}', 'Steam'],
  ['haulmp', '{haulmp}', 'HaulMP'],
  ['truckersmp', '{truckersmp}', 'TruckersMP'],
  ['companySince', '{companySince}', 'Дата вступления'],
  ['companyDuration', '{companyDuration}', 'Стаж']
];

/* ============================================================
   Класс Editor
   ============================================================ */

export class Editor {
  /**
   * @param {'rules'|'message'|'announcement'|'delayed'|'birthdays'|'profiles'|'ephemeral'} context
   * @param {object} [opts]
   */
  constructor(context, opts = {}) {
    this.context = context;
    this.config = this._defaultConfig();
    this.history = [];
    this.historyIndex = -1;
    this.unsaved = false;
    this._savedSnapshot = JSON.stringify(this.config);
    this._autoSaveTimer = null;
    this._root = null;
    this._previewEl = null;
    this._blocksEl = null;
    this._countEl = null;
    this._opts = opts;
    this._dragSrcIndex = -1;
    this._keyHandler = null;
  }

  /* ---------- Жизненный цикл ---------- */

  mount(rootEl) {
    this._root = rootEl;
    this._renderLayout();
    this._applyCollapseState();
    this._renderAll();
    this._startAutoSave();
    return this;
  }

  unmount() {
    this._stopAutoSave();
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = null;
    this._root = null;
  }

  load(config) {
    const cfg = structuredClone(config || this._defaultConfig());
    if (!Array.isArray(cfg.blocks)) cfg.blocks = [];
    cfg.blocks = cfg.blocks.filter(b => !UNSUPPORTED_TYPES.has(b.type));

    this.config = cfg;
    this.history = [];
    this.historyIndex = -1;
    this._savedSnapshot = this._serialize();
    this.unsaved = false;

    if (this._root) {
      this._renderAll();
      this._syncChannelPicker();
    }
  }

  getConfig() { return this.config; }

  markSaved() {
    this._savedSnapshot = this._serialize();
    this.unsaved = false;
    this._updateUnsavedIndicator();
  }

  isDirty() { return this._serialize() !== this._savedSnapshot; }

  /* ---------- Настройки ---------- */

  _defaultConfig() {
    return {
      channelId: '',
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: '',
      subtitle: '',
      thumbnail: '',
      blocks: []
    };
  }

  /* ---------- Свёрнутые состояния ---------- */

  _loadCollapseState() {
    return { has: (k) => loadCollapsed(this.context).has(k) };
  }

  _applyCollapseState() {
    if (!this._root) return;
    const collapsed = loadCollapsed(this.context);
    this._root.querySelectorAll('[data-collapse-key]').forEach(card => {
      const key = card.dataset.collapseKey;
      card.classList.toggle('collapsed', collapsed.has(key));
    });
  }

  _bindCollapseToggles() {
    if (!this._root) return;
    this._root.querySelectorAll('[data-collapse-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.target.closest('.badge')) return;
        const card = btn.closest('[data-collapse-key]');
        if (!card) return;
        const key = card.dataset.collapseKey;
        const collapsed = loadCollapsed(this.context);
        const isCollapsed = card.classList.toggle('collapsed');
        if (isCollapsed) collapsed.add(key);
        else collapsed.delete(key);
        saveCollapsed(this.context);
      });
    });
  }

  /* ---------- Layout ---------- */

  _renderLayout() {
    const bot = state.bot || { username: 'Ckaзka Dev', avatar: null };
    const botName = bot.username || 'Ckaзka Dev';
    const avatarInner = bot.avatar ? `<img src="${bot.avatar}" alt="">` : botName.charAt(0).toUpperCase();
    const avatarStyle = bot.avatar ? 'background:transparent;' : '';
    const showChannelPicker = this.context === 'rules';

    this._root.innerHTML = `
      <div class="editor-col">
        <div class="card editor-collapsible" data-collapse-key="settings">
          <div class="card-header" data-collapse-toggle>
            <div><h2>Настройки сообщения</h2><p>Режим, оформление</p></div>
            <span class="collapse-chevron"><i class="fa-solid fa-chevron-down"></i></span>
          </div>
          <div class="card-body">
            ${showChannelPicker ? `
              <div class="form-group" data-channel-group>
                <label>Канал отправки</label>
                ${channelPickerHTML({ id: 'rules_channel', hintId: 'rules_channel_hint' })}
              </div>
            ` : ''}
            <div class="editor-grid compact-grid">
              <div class="form-group" style="margin-bottom:0;">
                <label>Режим отображения</label>
                <div class="segmented-control" data-mode-seg>
                  <button type="button" data-value="flat" class="seg-btn">Плоский</button>
                  <button type="button" data-value="embed" class="seg-btn">Блок</button>
                  <button type="button" data-value="embed-color" class="seg-btn active">Цветной</button>
                </div>
              </div>
              <div class="form-group" data-color-group style="margin-bottom:0;">
                <label>Цвет</label>
                <div class="color-picker-compact"><input type="color" data-accent-color value="#5865F2"></div>
              </div>
            </div>
            <div class="form-group" style="margin-top:18px;">
              <label>Заголовок</label>
              <input class="input" data-title-input maxlength="4000">
            </div>
            <div class="form-group">
              <label>Подзаголовок</label>
              <input class="input" data-subtitle-input maxlength="4000">
            </div>
            <div class="form-group">
              <label>Thumbnail (URL)</label>
              <input class="input" data-thumbnail-input placeholder="https://...">
            </div>
          </div>
        </div>

        <div class="card editor-collapsible" data-collapse-key="blocks">
          <div class="card-header" data-collapse-toggle>
            <div><h2>Блоки</h2><p>Тяните за <b>⋮⋮</b> для изменения порядка</p></div>
            <div class="header-right">
              <span class="badge idle" data-block-count>0 блоков</span>
              <span class="collapse-chevron"><i class="fa-solid fa-chevron-down"></i></span>
            </div>
          </div>
          <div class="card-body">
            <div class="blocks-list" data-blocks></div>
            <div class="add-block-menu" data-add-menu>${this._addMenuButtons()}</div>
          </div>
        </div>
      </div>

      <div class="preview-col">
        <div class="card">
          <div class="card-header">
            <div><h2>Предпросмотр</h2><p>Как это увидит участник</p></div>
          </div>
          <div class="card-body">
            <div class="discord-preview">
              <div class="dp-author">
                <div class="dp-avatar" style="${avatarStyle}">${avatarInner}</div>
                <div>
                  <span class="dp-name">${escapeHtml(botName)}<span class="bot-tag">BOT</span></span>
                  <span class="dp-time">Сегодня</span>
                </div>
              </div>
              <div data-preview></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._previewEl = this._root.querySelector('[data-preview]');
    this._blocksEl = this._root.querySelector('[data-blocks]');
    this._countEl = this._root.querySelector('[data-block-count]');

    this._bindStaticControls();
    this._bindCollapseToggles();
  }

  _addMenuButtons() {
    const items = [
      ['text', '+ Текст'],
      ['sections', '+ Секции'],
      ['separator', '+ Разделитель'],
      ['image', '+ Картинка'],
      ['images', '+ Картинки'],
      ['file', '+ Файл'],
      ['buttons', '+ Кнопки'],
      ['role-buttons', '+ Кнопки ролей'],
      ['footer', '+ Подпись']
    ];
    return items.map(([type, label]) => `<button type="button" data-add="${type}">${label}</button>`).join('');
  }

  _bindStaticControls() {
    const root = this._root;

    if (root.querySelector('[data-channel-group]')) {
      bindChannelPicker(root, {
        id: 'rules_channel',
        onSelect: (ch) => {
          this.config.channelId = ch?.id || '';
          const hint = root.querySelector('#rules_channel_hint');
          if (hint) hint.textContent = ch ? `Выбран: ${ch.name} · ${ch.id}` : 'Канал не выбран';
          this._markDirty();
        }
      });
    }

    /* Режим отображения */
    const seg = root.querySelector('[data-mode-seg]');
    if (seg) {
      seg.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
          this.config.displayMode = btn.dataset.value;
          this._updateColorVisibility();
          this._snapshot();
          this._renderPreview();
          this._markDirty();
        });
      });
    }

    /* Цвет */
    const colorInput = root.querySelector('[data-accent-color]');
    if (colorInput) {
      colorInput.addEventListener('input', () => {
        this.config.accentColor = colorInput.value;
        this._renderPreview();
        this._markDirtyDebounced();
      });
    }

    /* Заголовок / подзаголовок / thumbnail */
    const titleInput = root.querySelector('[data-title-input]');
    const subtitleInput = root.querySelector('[data-subtitle-input]');
    const thumbInput = root.querySelector('[data-thumbnail-input]');

    if (titleInput) titleInput.addEventListener('input', () => { this.config.title = titleInput.value; this._renderPreview(); this._markDirtyDebounced(); });
    if (subtitleInput) subtitleInput.addEventListener('input', () => { this.config.subtitle = subtitleInput.value; this._renderPreview(); this._markDirtyDebounced(); });
    if (thumbInput) thumbInput.addEventListener('input', () => { this.config.thumbnail = thumbInput.value.trim(); this._renderPreview(); this._markDirtyDebounced(); });

    /* Меню «добавить блок» */
    const addMenu = root.querySelector('[data-add-menu]');
    if (addMenu) {
      addMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-add]');
        if (!btn) return;
        const type = btn.dataset.add;

        if (this.config.blocks.length >= LIMITS.MAX_BLOCKS) {
          return toast('Достигнут лимит блоков', { type: 'error' });
        }
        if (type === 'footer' && this.config.blocks.some(b => b.type === 'footer')) {
          return toast('Подпись уже добавлена', { type: 'error' });
        }

        this.config.blocks.push(this._createBlock(type));
        this._snapshot();
        this._renderAll();
        this._markDirty();
      });
    }

    /* Undo/Redo */
    if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    this._keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this._undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        this._redo();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  /* ---------- Рендер ---------- */

  _renderAll() {
    if (!this._root) return;
    this._renderSettings();
    this._renderBlocks();
    this._renderPreview();
    this._updateCounts();
    this._updateButtons();
  }

  _renderSettings() {
    const root = this._root;
    if (!root || !this.config) return;

    if (root.querySelector('[data-mode-seg]')) {
      root.querySelectorAll('[data-mode-seg] .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === this.config.displayMode);
      });
    }

    const colorInput = root.querySelector('[data-accent-color]');
    if (colorInput) colorInput.value = this.config.accentColor || '#5865F2';

    const titleInput = root.querySelector('[data-title-input]');
    if (titleInput) titleInput.value = this.config.title || '';

    const subtitleInput = root.querySelector('[data-subtitle-input]');
    if (subtitleInput) subtitleInput.value = this.config.subtitle || '';

    const thumbInput = root.querySelector('[data-thumbnail-input]');
    if (thumbInput) thumbInput.value = this.config.thumbnail || '';

    this._updateColorVisibility();
  }

  _updateColorVisibility() {
    const group = this._root?.querySelector('[data-color-group]');
    if (group) group.style.display = this.config.displayMode === 'embed-color' ? 'flex' : 'none';
  }

  _updateButtons() {
    if (!this._root || !this.config) return;
    const addMenu = this._root.querySelector('[data-add-menu]');
    if (!addMenu) return;
    const hasFooter = this.config.blocks.some(b => b.type === 'footer');
    addMenu.querySelectorAll('[data-add]').forEach(btn => {
      if (btn.dataset.add === 'footer') btn.disabled = hasFooter;
      if (this.config.blocks.length >= LIMITS.MAX_BLOCKS) btn.disabled = true;
    });
  }

  _updateCounts() {
    if (!this._countEl || !this.config) return;
    this._countEl.textContent = `${this.config.blocks.length} блоков`;
  }

  _renderBlocks() {
    if (!this.config) return;
    const container = this._blocksEl;
    if (!container) return;

    /* Footer всегда последний */
    this.config.blocks.sort((a, b) => {
      if (a.type === 'footer' && b.type !== 'footer') return 1;
      if (a.type !== 'footer' && b.type === 'footer') return -1;
      return 0;
    });

    if (!this.config.blocks.length) {
      container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">Нет блоков. Добавьте первый.</div>';
      return;
    }

    container.innerHTML = this.config.blocks.map((b, i) => this._renderBlock(b, i)).join('');

    /* Биндинги (один раз) */
    if (!container._bound) {
      container._bound = true;
      container.addEventListener('click', (e) => this._handleBlockClick(e));
      container.addEventListener('input', (e) => this._handleBlockInput(e));
      container.addEventListener('change', (e) => this._handleBlockInput(e));

      /* Drag & drop */
      container.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('[data-drag-handle]');
        if (!handle) { e.preventDefault(); return; }
        const card = handle.closest('.block-card');
        if (!card) return;
        this._dragSrcIndex = parseInt(card.dataset.idx);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(this._dragSrcIndex));
        try { e.dataTransfer.setDragImage(card, 20, 20); } catch {}
      });
      container.addEventListener('dragend', () => {
        container.querySelectorAll('.block-card').forEach(c => c.classList.remove('dragging', 'drag-over'));
      });
      container.addEventListener('dragover', (e) => {
        const card = e.target.closest('.block-card');
        if (!card) return;
        e.preventDefault();
        container.querySelectorAll('.block-card').forEach(c => c.classList.remove('drag-over'));
        if (parseInt(card.dataset.idx) !== this._dragSrcIndex) card.classList.add('drag-over');
      });
      container.addEventListener('drop', (e) => {
        const card = e.target.closest('.block-card');
        if (!card) return;
        e.preventDefault();
        const toIdx = parseInt(card.dataset.idx);
        if (toIdx === this._dragSrcIndex || this._dragSrcIndex < 0) return;
        const [moved] = this.config.blocks.splice(this._dragSrcIndex, 1);
        this.config.blocks.splice(toIdx, 0, moved);
        this._dragSrcIndex = -1;
        this._snapshot();
        this._renderAll();
        this._markDirty();
      });
    }

    this._bindBlockPickers();
  }

  _bindBlockPickers() {
    const container = this._blocksEl;
    if (!container) return;

    container.querySelectorAll('[data-role-picker]').forEach((el) => {
      const id = el.dataset.rolePicker;
      bindRolePicker(container, {
        id,
        onSelect: (role) => {
          const btn = this._findButtonById(id);
          if (btn) {
            btn.roleId = role?.id || '';
            this._renderPreview();
            this._markDirtyDebounced();
          }
        }
      });
    });

    container.querySelectorAll('[data-emoji-picker]').forEach((el) => {
      const id = el.dataset.emojiPicker;
      bindEmojiPicker(container, {
        id,
        onChange: (emoji) => {
          const btn = this._findButtonByEmojiId(id);
          if (btn) {
            btn.emoji = emoji;
            this._renderPreview();
            this._markDirtyDebounced();
          }
        }
      });
    });
  }

  _findButtonById(id) {
    for (const block of this.config.blocks) {
      if (Array.isArray(block.buttons)) {
        const btn = block.buttons.find(b => b.id === id);
        if (btn) return btn;
      }
    }
    return null;
  }

  _findButtonByEmojiId(id) {
    const realId = id.startsWith('e_') ? id.slice(2) : id;
    return this._findButtonById(realId);
  }

  _renderBlock(block, idx) {
    const label = TYPE_LABELS[block.type] || block.type;
    const isFooter = block.type === 'footer';
    const nextIsFooter = this.config.blocks[idx + 1]?.type === 'footer';

    return `
      <div class="block-card" data-block-id="${block.id}" data-idx="${idx}">
        <div class="block-head">
          <span class="block-drag-handle" data-drag-handle draggable="true" aria-label="Перетащить">
            <i class="fa-solid fa-grip-vertical"></i>
          </span>
          <span class="block-type-tag" data-toggle-collapse>${label}</span>
          <div class="block-actions">
            ${!isFooter ? `<button type="button" data-action="up" title="Вверх"><i class="fa-solid fa-chevron-up"></i></button>` : ''}
            ${!isFooter && !nextIsFooter ? `<button type="button" data-action="down" title="Вниз"><i class="fa-solid fa-chevron-down"></i></button>` : ''}
            <button type="button" class="danger" data-action="remove" title="Удалить"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="block-body">${this._renderBlockBody(block)}</div>
      </div>
    `;
  }

  _renderBlockBody(block) {
    switch (block.type) {
      case 'text':
        return `
          ${this._toolbarHTML(false)}
          <textarea class="input" data-field="content" rows="4" maxlength="${LIMITS.MAX_TEXT}">${escapeHtml(block.content || '')}</textarea>
          <div class="char-counter" data-counter>${(block.content || '').length} / ${LIMITS.MAX_TEXT}</div>
        `;
      case 'sections': return this._sectionsHTML(block);
      case 'separator':
        return `
          <div class="sub-item-row">
            <label style="display:flex;gap:8px;font-size:12px;color:var(--text-dim);cursor:pointer;align-items:center;">
              <input type="checkbox" data-field="divider" ${block.divider !== false ? 'checked' : ''}>
              Показать линию
            </label>
            <select class="input" data-field="spacing" style="width:auto;margin-left:auto;">
              <option value="1" ${block.spacing == 1 ? 'selected' : ''}>Маленький отступ</option>
              <option value="2" ${block.spacing == 2 ? 'selected' : ''}>Большой отступ</option>
            </select>
          </div>
        `;
      case 'image':
      case 'file':
        return `<input class="input" data-field="url" placeholder="https://... или {vtc} / {steam}" value="${escapeHtml(block.url || '')}">`;
      case 'images':
        return `
          <div class="sub-label">URL (по одному в строке)</div>
          <textarea class="input" data-field="urls" rows="3" placeholder="https://...\nhttps://...">${(block.urls || []).join('\n')}</textarea>
        `;
      case 'buttons': return this._buttonsHTML(block);
      case 'role-buttons': return this._roleButtonsHTML(block);
      case 'footer':
        return `
          ${this._toolbarHTML(true)}
          <input class="input" data-field="content" placeholder="Текст подписи" value="${escapeHtml(block.content || '')}">
        `;
      default: return '';
    }
  }

  _toolbarHTML(noShortcuts = false) {
    const tokens = this.context === 'profiles' ? PROFILE_TOKENS : [];

    return `
      <div class="editor-toolbar">
        ${!noShortcuts ? `
          <button type="button" data-format="bold" title="Жирный"><b>B</b></button>
          <button type="button" data-format="italic" title="Курсив"><i>I</i></button>
          <button type="button" data-format="underline" title="Подчёркнутый"><u>U</u></button>
          <button type="button" data-format="strike" title="Зачёркнутый"><s>S</s></button>
          <button type="button" data-format="quote" title="Цитата">❞</button>
          <button type="button" data-format="code" title="Код">&lt;/&gt;</button>
          <button type="button" data-format="spoiler" title="Спойлер">▮</button>
          <div class="toolbar-sep"></div>
        ` : ''}
        <button type="button" data-format="time" class="time-btn" title="Вставить время">{time} ▾</button>
        ${this.context === 'ephemeral' ? `<button type="button" data-format="role" class="role-btn" title="Вставить роль">{role}</button>` : ''}
        ${this.context === 'announcement' ? `<button type="button" data-format="until" class="time-btn" title="Вставить {until}">{until}</button>` : ''}
        ${this.context === 'birthdays' ? `
          <div class="toolbar-sep"></div>
          <button type="button" data-format="user" class="role-btn" title="Упоминание">{user}</button>
          ${this._opts.allowAge !== false ? `<button type="button" data-format="age" class="role-btn" title="Возраст">{age}</button>` : ''}
        ` : ''}
        ${tokens.length ? `
          <div class="toolbar-sep"></div>
          ${tokens.map(([id, label, title]) => `<button type="button" data-format="${id}" class="role-btn" title="${escapeHtml(title)}">${escapeHtml(label)}</button>`).join('')}
        ` : ''}
      </div>
    `;
  }

  _sectionsHTML(block) {
    const items = block.items || [];
    const isNumeric = block.listStyle !== 'dot';
    return `
      <div class="sub-item-row"><input class="input" data-field="title" placeholder="Заголовок секции" value="${escapeHtml(block.title || '')}"></div>
      <div class="sub-item-row">
        <label style="font-size:12px;color:var(--text-dim);">Стиль:</label>
        <select class="input" data-field="listStyle" style="width:auto;">
          <option value="numeric" ${isNumeric ? 'selected' : ''}>1. 2. 3.</option>
          <option value="dot" ${!isNumeric ? 'selected' : ''}>· · ·</option>
        </select>
      </div>
      <div class="sub-label">Пункты</div>
      ${items.map((item, i) => `
        <div class="sub-item-row">
          <span style="min-width:24px;text-align:center;font-size:11.5px;color:var(--text-muted);">${isNumeric ? (i + 1) + '.' : '·'}</span>
          <input class="input" data-item-idx="${i}" value="${escapeHtml(item)}">
          <button type="button" class="icon-btn" data-action="remove-item" data-item-idx="${i}" aria-label="Удалить пункт">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('')}
      <button type="button" class="btn btn-ghost btn-sm" data-action="add-item">+ Добавить пункт</button>
    `;
  }

  _buttonsHTML(block) {
    const buttons = block.buttons || [];
    return `
      <div class="sub-label">Кнопки-ссылки (${buttons.length}/${LIMITS.MAX_BUTTONS})</div>
      ${buttons.map(btn => `
        <div class="sub-item" data-button-id="${btn.id}">
          <div class="sub-item-row">
            <input class="input" data-btn-field="label" placeholder="Название" maxlength="${LIMITS.MAX_LABEL}" value="${escapeHtml(btn.label || '')}">
            <button type="button" class="icon-btn" data-action="remove-button" data-button-id="${btn.id}" aria-label="Удалить кнопку">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="sub-item-row">
            <input class="input" data-btn-field="url" placeholder="https://... или {vtc} / {steam}" value="${escapeHtml(btn.url || '')}">
          </div>
          <div class="sub-item-row">${emojiPickerHTML({ id: btn.id, value: btn.emoji || '' })}</div>
        </div>
      `).join('')}
      ${buttons.length < LIMITS.MAX_BUTTONS ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-button">+ Добавить кнопку</button>` : ''}
    `;
  }

  _roleButtonsHTML(block) {
    const buttons = block.buttons || [];
    const showEphemeral = this.context !== 'ephemeral';
    return `
      ${buttons.map(btn => `
        <div class="sub-item" data-button-id="${btn.id}">
          <div class="sub-item-row">
            <input class="input" data-btn-field="label" placeholder="Название" maxlength="${LIMITS.MAX_LABEL}" value="${escapeHtml(btn.label || '')}">
            <select class="input" data-btn-field="style" style="width:120px;">
              <option value="primary" ${btn.style === 'primary' ? 'selected' : ''}>Primary</option>
              <option value="secondary" ${btn.style === 'secondary' ? 'selected' : ''}>Secondary</option>
              <option value="success" ${btn.style === 'success' ? 'selected' : ''}>Success</option>
              <option value="danger" ${btn.style === 'danger' ? 'selected' : ''}>Danger</option>
            </select>
            <button type="button" class="icon-btn" data-action="remove-button" data-button-id="${btn.id}" aria-label="Удалить кнопку">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          ${rolePickerHTML({ id: btn.id, value: btn.roleId })}
          <div class="sub-item-row">${emojiPickerHTML({ id: 'e_' + btn.id, value: btn.emoji || '' })}</div>
          ${showEphemeral ? `<button type="button" class="btn btn-ghost btn-sm" data-action="edit-ephemeral" data-button-id="${btn.id}">✎ Настроить ответ</button>` : ''}
        </div>
      `).join('')}
      ${buttons.length < LIMITS.MAX_BUTTONS ? `<button type="button" class="btn btn-ghost btn-sm" data-action="add-role-button">+ Добавить кнопку роли</button>` : ''}
    `;
  }

  /* ---------- Обработчики блоков ---------- */

  _handleBlockClick(e) {
    const card = e.target.closest('.block-card');
    if (!card) return;

    const blockId = card.dataset.blockId;
    const idx = parseInt(card.dataset.idx);
    const block = this.config.blocks[idx];
    if (!block) return;

    /* Сворачивание блока по клику на тег */
    if (e.target.closest('[data-toggle-collapse]')) {
      const collapsed = loadCollapsed(this.context);
      if (collapsed.has(blockId)) collapsed.delete(blockId);
      else collapsed.add(blockId);
      saveCollapsed(this.context);
      card.classList.toggle('collapsed');
      return;
    }

    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) {
      /* Панель форматирования */
      const fmtBtn = e.target.closest('[data-format]');
      if (fmtBtn) {
        e.preventDefault();
        e.stopPropagation();
        this._handleFormat(fmtBtn, card);
      }
      return;
    }

    e.preventDefault();

    const action = actionBtn.dataset.action;
    const buttonId = actionBtn.dataset.buttonId;
    const itemIdx = parseInt(actionBtn.dataset.itemIdx);

    if (action === 'up' && idx > 0) {
      this.config.blocks.splice(idx - 1, 0, this.config.blocks.splice(idx, 1)[0]);
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'down' && idx < this.config.blocks.length - 1) {
      this.config.blocks.splice(idx + 1, 0, this.config.blocks.splice(idx, 1)[0]);
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'remove') {
      this.config.blocks.splice(idx, 1);
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'add-button') {
      if (block.buttons.length >= LIMITS.MAX_BUTTONS) return;
      block.buttons.push({ id: uid(), label: 'Кнопка', url: '', emoji: '' });
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'add-role-button') {
      if (block.buttons.length >= LIMITS.MAX_BUTTONS) return;
      block.buttons.push({
        id: uid(), label: 'Роль', style: 'primary', roleId: '', emoji: '',
        ephemeral: {
          positive: this._defaultEphemeral('✅ Роль выдана!'),
          negative: this._defaultEphemeral('❌ Роль снята!')
        }
      });
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'remove-button') {
      block.buttons = block.buttons.filter(b => b.id !== buttonId);
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'edit-ephemeral') {
      this._opts.onEditEphemeral?.(blockId, buttonId);
    } else if (action === 'add-item') {
      if (!block.items) block.items = [];
      block.items.push('');
      this._snapshot(); this._renderAll(); this._markDirty();
    } else if (action === 'remove-item') {
      block.items.splice(itemIdx, 1);
      this._snapshot(); this._renderAll(); this._markDirty();
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
      if (field === 'urls') block.urls = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
      else if (field === 'spacing') block.spacing = parseInt(e.target.value);
      else if (field === 'divider') block.divider = e.target.checked;
      else if (field === 'listStyle') block.listStyle = e.target.value;
      else if (field === 'content') {
        block.content = e.target.value;
        const counter = card.querySelector('[data-counter]');
        if (counter) {
          counter.textContent = `${e.target.value.length} / ${LIMITS.MAX_TEXT}`;
          counter.classList.toggle('warn', e.target.value.length > LIMITS.MAX_TEXT * .9);
          counter.classList.toggle('error', e.target.value.length >= LIMITS.MAX_TEXT);
        }
      } else {
        block[field] = e.target.value;
      }
    } else if (btnField && buttonId) {
      const btn = block.buttons.find(b => b.id === buttonId);
      if (btn) btn[btnField] = e.target.value;
    } else if (itemIdx !== undefined && e.target.dataset.field === undefined) {
      if (!block.items) block.items = [];
      block.items[parseInt(itemIdx)] = e.target.value;
    }

    this._renderPreview();
    this._markDirtyDebounced();
  }

  _handleFormat(btn, card) {
    const format = btn.dataset.format;
    const textarea = card.querySelector('textarea[data-field="content"]') || card.querySelector('input[data-field="content"]');
    if (!textarea) return;

    if (format === 'time') return this._showTimeMenu(btn, textarea);

    if (TOKEN_FORMATS.has(format)) {
      return this._insertToken(textarea, `{${format}}`);
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const value = textarea.value;
    const selected = value.substring(start, end);

    const wrap = {
      bold: '**', italic: '*', underline: '__', strike: '~~',
      code: '`', spoiler: '||'
    }[format];

    if (format === 'quote') {
      const text = selected || 'цитата';
      const quoted = text.split('\n').map(l => '> ' + l).join('\n');
      textarea.value = value.substring(0, start) + quoted + value.substring(end);
      textarea.selectionStart = start;
      textarea.selectionEnd = start + quoted.length;
    } else if (wrap) {
      const insert = selected || format;
      textarea.value = value.substring(0, start) + wrap + insert + wrap + value.substring(end);
      textarea.selectionStart = start + wrap.length;
      textarea.selectionEnd = start + wrap.length + insert.length;
    }

    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  _showTimeMenu(anchor, textarea) {
    document.querySelectorAll('.time-dropdown').forEach(d => d.remove());

    const dd = document.createElement('div');
    dd.className = 'time-dropdown';
    dd.innerHTML = `
      <button type="button" data-code="R">Относительное время</button>
      <button type="button" data-code="f">Дата и время (по умолчанию)</button>
      <button type="button" data-code="F">Полная дата, день недели и время</button>
      <button type="button" data-code="d">Краткая дата</button>
      <button type="button" data-code="D">Полная дата</button>
      <button type="button" data-code="t">Краткое время</button>
      <button type="button" data-code="T">Полное время (с секундами)</button>
    `;
    document.body.appendChild(dd);
    positionPopup(dd, anchor, 240);

    const closeOnOutside = (ev) => {
      if (!dd.contains(ev.target)) {
        dd.remove();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);

    dd.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-code]');
      if (!btn) return;
      e.preventDefault();
      this._insertToken(textarea, `{time:${btn.dataset.code}}`);
      dd.remove();
      document.removeEventListener('click', closeOnOutside);
    });
  }

  _insertToken(textarea, token) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const value = textarea.value;
    textarea.value = value.substring(0, start) + token + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + token.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ---------- Preview ---------- */

  _renderPreview() {
    if (!this._previewEl || !this.config) return;
    const roleName = this._opts.getRoleName?.();
    const inner = this._buildPreviewInner(this.config, roleName);

    if (this.config.displayMode === 'flat') {
      this._previewEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px;">${inner}</div>`;
    } else {
      const colorStyle = this.config.displayMode === 'embed-color' && this.config.accentColor
        ? `border-left:4px solid ${this.config.accentColor};`
        : `border-left:1px solid #1e1f22;`;
      this._previewEl.innerHTML = `<div class="dp-container" style="${colorStyle}">${inner}</div>`;
    }
  }

  _buildPreviewInner(r, roleName) {
    let html = '';
    const hasHeader = r.title || r.subtitle;

    if (hasHeader) {
      const headerHtml = `
        <div class="dp-header-text">
          ${r.title ? `<div class="dp-title">${this._md(r.title, roleName)}</div>` : ''}
          ${r.subtitle ? `<div class="dp-subtitle">${this._md(r.subtitle, roleName)}</div>` : ''}
        </div>
      `;
      html += r.thumbnail
        ? `<div class="dp-header">${headerHtml}<img class="dp-thumbnail" src="${escapeHtml(r.thumbnail)}" alt=""></div>`
        : `<div class="dp-header">${headerHtml}</div>`;
    }

    for (const block of r.blocks || []) {
      switch (block.type) {
        case 'text':
          if (block.content) html += `<div class="dp-text">${this._md(block.content, roleName)}</div>`;
          break;

        case 'sections': {
          let s = '';
          if (block.title) s += `<div class="dp-heading">${this._md(block.title, roleName)}</div>`;
          if (block.items?.length) {
            const itemsHtml = block.items.map((item, i) => {
              const prefix = block.listStyle === 'dot' ? '·' : (i + 1) + '.';
              return `<span style="display:inline-block;min-width:10px;color:#949ba4;">${prefix}</span>${this._md(item, roleName)}`;
            }).join('<br>');
            s += `<div class="dp-text" style="margin-top:4px;">${itemsHtml}</div>`;
          }
          if (s) html += s;
          break;
        }

        case 'separator':
          html += `<div class="dp-separator ${block.spacing == 2 ? 'large' : ''}" style="${block.divider === false ? 'border:none;' : ''}"></div>`;
          break;

        case 'image':
        case 'file':
          if (block.url) html += `<img class="dp-image" src="${escapeHtml(block.url)}" alt="">`;
          break;

        case 'images':
          if (block.urls?.length) {
            html += `<div class="dp-images-grid ${block.urls.length === 1 ? 'single' : ''}">${block.urls.map(u => `<img src="${escapeHtml(u)}" alt="">`).join('')}</div>`;
          }
          break;

        case 'buttons':
          if (block.buttons?.length) {
            html += `<div class="dp-buttons">${block.buttons.map(b => `<button class="dp-btn link">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Ссылка')}</button>`).join('')}</div>`;
          }
          break;

        case 'role-buttons':
          if (block.buttons?.length) {
            html += `<div class="dp-buttons">${block.buttons.map(b => `<button class="dp-btn ${b.style || 'primary'}">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Role')}</button>`).join('')}</div>`;
          }
          break;

        case 'footer':
          if (block.content) html += `<div class="dp-footer">${this._md(block.content, roleName)}</div>`;
          break;
      }
    }

    if (!html) html = '<div class="dp-empty">Сообщение пустое</div>';
    return html;
  }

  /* ---------- Markdown + токены ---------- */

  _md(text, roleName) {
    if (!text) return '';
    let html = escapeHtml(text);

    /* Discord-тег <t:...> */
    html = html.replace(/&lt;t:(\d+):([RrFfDdTt])&gt;/g, (_, unix, code) =>
      `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(parseInt(unix, 10) * 1000), code))}</span>`
    );

    /* {time} и {time:CODE} */
    html = html.replace(/\{time(?::([RrFfDdTt]))?\}/g, (_, code) => {
      const c = code || 'f';
      return `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(), c))}</span>`;
    });

    html = html.replace(/\{until\}/g, '<span class="dp-time-tag">через 3 часа</span>');

    /* {role} */
    if (roleName) html = html.replace(/\{role\}/g, escapeHtml(roleName));
    else html = html.replace(/\{role\}/g, '<span style="color:#a5adff;">{role}</span>');

    /* {user} */
    const userVal = this._opts.previewUser || '<span class="dp-mention">@Пользователь</span>';
    html = html.replace(/\{user\}/g, userVal);

    /* {age} */
    const ageVal = this._opts.previewAge || '<span style="color:#a5adff;">30</span>';
    html = html.replace(/\{age\}/g, ageVal);

    /* Токены профиля */
    if (this.context === 'profiles') {
      const p = this._opts.previewProfile || {
        mention: '@Иван',
        displayName: 'Иван Иванов',
        username: 'ivan',
        userId: '123456789',
        birthday: '30 марта 1995 г.',
        age: '30 лет',
        vtc: 'https://vtc.example.com',
        steam: 'https://steamcommunity.com/id/ivan',
        haulmp: 'https://haulmp.example.com',
        truckersmp: 'https://truckersmp.com/user/1',
        companySince: '15.03.2022',
        companyDuration: '3 года 7 месяцев',
        links: '[VTC](https://vtc.example.com) · [Steam](https://steamcommunity.com/id/ivan)'
      };

      html = html.replace(/\{mention\}/g, `<span class="dp-mention">${escapeHtml(p.mention)}</span>`);
      html = html.replace(/\{displayName\}/g, escapeHtml(p.displayName));
      html = html.replace(/\{username\}/g, escapeHtml(p.username));
      html = html.replace(/\{userId\}/g, escapeHtml(p.userId));
      html = html.replace(/\{birthday\}/g, escapeHtml(p.birthday));
      html = html.replace(/\{age\}/g, escapeHtml(p.age));
      html = html.replace(/\{companySince\}/g, escapeHtml(p.companySince));
      html = html.replace(/\{companyDuration\}/g, escapeHtml(p.companyDuration));

      html = html.replace(/\{vtc\}/g, this._linkTag(p.vtc));
      html = html.replace(/\{steam\}/g, this._linkTag(p.steam));
      html = html.replace(/\{haulmp\}/g, this._linkTag(p.haulmp));
      html = html.replace(/\{truckersmp\}/g, this._linkTag(p.truckersmp));

      html = html.replace(/\{links\}/g, p.links);
    }

    /* Markdown-ссылки */
    html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="dp-link">$1</a>');

    /* Прочее форматирование */
    html = html.replace(/\|\|(.+?)\|\|/g, '<span class="dp-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
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

  _linkTag(url) {
    if (!url) return '';
    const safe = escapeHtml(url);
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer" class="dp-link">${safe}</a>`;
  }

  /* ---------- История ---------- */

  _serialize() { return JSON.stringify(this.config); }

  _snapshot() {
    const snap = this._serialize();
    if (this.history[this.historyIndex] === snap) return;
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snap);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  _undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.config = JSON.parse(this.history[this.historyIndex]);
    this._renderAll();
    this._markDirty();
  }

  _redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.config = JSON.parse(this.history[this.historyIndex]);
    this._renderAll();
    this._markDirty();
  }

  /* ---------- Dirty-индикатор ---------- */

  _markDirty() {
    this.unsaved = this.isDirty();
    this._updateUnsavedIndicator();
  }

  _markDirtyDebounced = debounce(() => this._markDirty(), 200);

  _updateUnsavedIndicator() {
    const title = this._root?.closest('.modal')?.querySelector('.modal-header h3');
    if (!title) return;
    const exists = title.querySelector('.unsaved-dot');
    if (this.unsaved && !exists) {
      const dot = document.createElement('span');
      dot.className = 'unsaved-dot';
      dot.title = 'Есть несохранённые изменения';
      title.appendChild(dot);
    } else if (!this.unsaved && exists) {
      exists.remove();
    }
  }

  /* ---------- Автосохранение черновика ---------- */

  _startAutoSave() {
    this._stopAutoSave();
    this._autoSaveTimer = setInterval(() => {
      if (!this.unsaved || !this.config) return;
      try {
        localStorage.setItem(
          `nexus_draft_${state.guildId}_${this.context}`,
          JSON.stringify({ config: this.config, at: Date.now() })
        );
      } catch {}
    }, 3000);
  }

  _stopAutoSave() {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    this._autoSaveTimer = null;
  }

  /* ---------- Синхронизация channel-picker ---------- */

  _syncChannelPicker() {
    const root = this._root;
    if (!root) return;
    const picker = root.querySelector('[data-channel-group] .channel-picker');
    if (!picker) return;

    const hidden = picker.querySelector('input[type="hidden"]');
    const input = picker.querySelector('.channel-search');
    const icon = picker.querySelector('.channel-input-icon');
    const hint = root.querySelector('#rules_channel_hint');

    if (this.config.channelId) {
      const ch = state.channels.find(c => c.id === this.config.channelId);
      if (ch) {
        if (hidden) hidden.value = ch.id;
        if (input) input.value = ch.name;
        if (icon) icon.innerHTML = channelIcon(ch.type);
        if (hint) hint.textContent = `Выбран: ${ch.name} · ${ch.id}`;
        return;
      }
    }
    if (hidden) hidden.value = '';
    if (input) input.value = '';
    if (icon) icon.innerHTML = '';
    if (hint) hint.textContent = 'Канал не выбран';
  }

  /* ---------- Фабрика блоков ---------- */

  _createBlock(type) {
    const id = uid();
    switch (type) {
      case 'text':      return { id, type: 'text', content: '' };
      case 'sections':  return { id, type: 'sections', title: '', listStyle: 'numeric', items: [''] };
      case 'separator': return { id, type: 'separator', divider: true, spacing: 1 };
      case 'image':     return { id, type: 'image', url: '' };
      case 'images':    return { id, type: 'images', urls: [] };
      case 'file':      return { id, type: 'file', url: '' };
      case 'buttons':
        return { id, type: 'buttons', buttons: [{ id: uid(), label: 'Ссылка', url: '', emoji: '' }] };
      case 'role-buttons':
        return {
          id, type: 'role-buttons',
          buttons: [{
            id: uid(), label: 'Роль', style: 'primary', roleId: '', emoji: '',
            ephemeral: {
              positive: this._defaultEphemeral('✅ Роль выдана!'),
              negative: this._defaultEphemeral('❌ Роль снята!')
            }
          }]
        };
      case 'footer': return { id, type: 'footer', content: '' };
      default:       return { id, type: 'text', content: '' };
    }
  }

  _defaultEphemeral(content) {
    return {
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: '', subtitle: '', thumbnail: '',
      blocks: [{ id: uid(), type: 'text', content }]
    };
  }
}