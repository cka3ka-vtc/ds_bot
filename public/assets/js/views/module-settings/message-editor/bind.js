// public/assets/js/views/module-settings/message-editor/bind.js
import { UI } from '/shared/ui-strings.js';
import { LIMITS } from './helpers.js';

export function mountBindMethods(MessageEditor) {
  MessageEditor.prototype._bind = function _bind() {
    this._abort?.abort();
    this._abort = new AbortController();
    const { signal } = this._abort;
    const root = this.container;

    bindSettingsCard(this, root, signal);
    bindTemplatesCard(this, root, signal);
    bindPresets(this, root, signal);
    bindModeSeg(this, root, signal);
    bindColorInput(this, root, signal);
    bindTextInputs(this, root, signal);
    bindAddMenu(this, root, signal);
    bindRootToolbar(this, root, signal);
    bindCompactTokenButtons(this, root, signal);
    bindTextareaAutoResize(this, root, signal);
    bindBlocks(this, signal);
  };
}

function bindSettingsCard(editor, root, signal) {
  const card = root.querySelector('[data-settings-card]');
  const toggle = root.querySelector('[data-settings-toggle]');
  if (!card || !toggle) return;

  const doToggle = () => {
    const collapsed = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', collapsed);
    editor._saveSettingsCollapse(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? UI.msgEditor.settings.expand : UI.msgEditor.settings.collapse;
    if (!collapsed) {
      requestAnimationFrame(() => {
        card.querySelectorAll('textarea').forEach((t) => editor._autoResize(t));
      });
    }
  };

  toggle.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, textarea, a, label')) return;
    doToggle();
  }, { signal });

  toggle.addEventListener('keydown', (e) => {
    if (e.target !== toggle) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); }
  }, { signal });
}

function bindTemplatesCard(editor, root, signal) {
  const card = root.querySelector('[data-templates-card]');
  const toggle = root.querySelector('[data-templates-toggle]');
  if (!card || !toggle) return;

  const doToggle = () => {
    const collapsed = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', collapsed);
    editor._saveTemplatesCollapse(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? UI.msgEditor.presets.expand : UI.msgEditor.presets.collapse;
  };

  toggle.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, textarea, a, label')) return;
    doToggle();
  }, { signal });

  toggle.addEventListener('keydown', (e) => {
    if (e.target !== toggle) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); }
  }, { signal });
}

function bindPresets(editor, root, signal) {
  root.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.preset;
      const preset = editor._presets.find((p) => p.key === key);
      if (preset) await editor._applyPreset(preset);
    }, { signal });
  });

  const resetBtn = root.querySelector('[data-reset-template]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => editor._resetConfig(), { signal });
  }

  const clearBtn = root.querySelector('[data-clear-template]');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => editor._clearConfig(), { signal });
  }
}

/**
 * При смене displayMode перерисовываем блоки и тулбары в настройках —
 * хотя кнопки активны всегда, это полезно для отрисовки превью-тулбаров
 * и для возможного пересчёта отображения (например, color picker).
 */
function bindModeSeg(editor, root, signal) {
  root.querySelectorAll('[data-mode-seg] .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-mode-seg] .seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn));
      editor.config.displayMode = btn.dataset.value;
      editor._updateColorVisibility();
      editor._renderBlocks();
      editor._refreshSettingsToolbars();
      editor._renderPreview();
      editor._markDirty();
    }, { signal });
  });
}

function bindColorInput(editor, root, signal) {
  const colorInput = root.querySelector('[data-accent-color]');
  if (colorInput) {
    colorInput.addEventListener('input', () => {
      editor.config.accentColor = colorInput.value;
      editor._renderPreview();
      editor._markDirty();
    }, { signal });
  }
}

function bindTextInputs(editor, root, signal) {
  const bind = (sel, key) => {
    const el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener('input', () => {
      editor.config[key] = el.value;
      editor._renderPreview();
      editor._markDirty();
    }, { signal });
  };
  bind('[data-title-input]', 'title');
  bind('[data-subtitle-input]', 'subtitle');
  bind('[data-thumbnail-input]', 'thumbnail');
}

function bindAddMenu(editor, root, signal) {
  const addMenu = root.querySelector('[data-add-menu]');
  if (!addMenu) return;

  addMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn) return;
    const type = btn.dataset.add;

    if (editor.config.blocks.length >= LIMITS.maxBlocks) return;
    if (type === 'footer' && editor.config.blocks.some((b) => b.type === 'footer')) return;

    editor.config.blocks.push(editor._createBlock(type));
    editor._renderBlocks();
    editor._renderPreview();
    editor._updateCount();
    editor._markDirty();
  }, { signal });
}

function bindRootToolbar(editor, root, signal) {
  root.addEventListener('click', (e) => {
    const tokensBtn = e.target.closest('[data-tokens-btn]');
    if (tokensBtn && tokensBtn.closest('.editor-toolbar')) {
      e.preventDefault();
      e.stopPropagation();
      const parent = tokensBtn.closest('.editor-toolbar')?.parentElement;
      const target = parent?.querySelector('textarea, input.input[data-token-context]')
        || parent?.querySelector('textarea, input.input');
      if (target) editor._showTokensMenu(tokensBtn, target);
      return;
    }

    const fmtBtn = e.target.closest('[data-format]');
    if (!fmtBtn || !fmtBtn.closest('.editor-toolbar')) return;
    e.preventDefault();
    e.stopPropagation();

    const parent = fmtBtn.closest('.editor-toolbar')?.parentElement;
    const target = parent?.querySelector('textarea, input.input[data-token-context]')
      || parent?.querySelector('textarea, input.input');
    if (target) editor._handleFormat(fmtBtn, target);
  }, { signal });
}

function bindCompactTokenButtons(editor, root, signal) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tokens-for]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const row = btn.closest('.sub-item-row');
    const target = row?.querySelector('input.input, textarea.input');
    if (target) editor._showTokensMenu(btn, target);
  }, { signal });
}

function bindTextareaAutoResize(editor, root, signal) {
  root.addEventListener('input', (e) => {
    if (e.target.tagName === 'TEXTAREA') editor._autoResize(e.target);
  }, { signal });
}

function bindBlocks(editor, signal) {
  const blocksEl = editor._blocksEl;
  if (!blocksEl) return;

  blocksEl.addEventListener('click', (e) => {
    if (e.target.closest('[data-tokens-for]')) return;
    editor._handleBlockClick(e);
  }, { signal });
  blocksEl.addEventListener('input', (e) => editor._handleBlockInput(e), { signal });
  blocksEl.addEventListener('change', (e) => editor._handleBlockInput(e), { signal });

  blocksEl.addEventListener('dragstart', (e) => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) { e.preventDefault(); return; }
    const card = handle.closest('.block-card');
    if (!card) return;

    editor._dragSrcIndex = parseInt(card.dataset.idx, 10);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(editor._dragSrcIndex));
  }, { signal });

  blocksEl.addEventListener('dragend', () => {
    blocksEl.querySelectorAll('.block-card')
      .forEach((c) => c.classList.remove('dragging', 'drag-over'));
  }, { signal });

  blocksEl.addEventListener('dragover', (e) => {
    const card = e.target.closest('.block-card');
    if (!card) return;
    e.preventDefault();
    blocksEl.querySelectorAll('.block-card').forEach((c) => c.classList.remove('drag-over'));
    if (parseInt(card.dataset.idx, 10) !== editor._dragSrcIndex) {
      card.classList.add('drag-over');
    }
  }, { signal });

  blocksEl.addEventListener('drop', (e) => {
    const card = e.target.closest('.block-card');
    if (!card) return;
    e.preventDefault();
    const toIdx = parseInt(card.dataset.idx, 10);
    if (toIdx === editor._dragSrcIndex || editor._dragSrcIndex < 0) return;

    const [moved] = editor.config.blocks.splice(editor._dragSrcIndex, 1);
    editor.config.blocks.splice(toIdx, 0, moved);
    editor._dragSrcIndex = -1;
    editor._renderBlocks();
    editor._renderPreview();
    editor._markDirty();
  }, { signal });
}