/* ============================================================
   Правила: редактор сообщения с кнопками-ролями + preview.

   Экспортирует:
   - renderRulesView()      — отрисовать редактор
   - getRulesEditor()       — вернуть экземпляр Editor
   - saveRules()            — сохранить в API
   - triggerSendRules()     — открыть модалку отправки
   - openSendModal()        — общая модалка отправки (используют все секции)
   - openEditorModal()      — общая модалка создания (используют все секции)
   - normalizeRules()       — нормализация JSON
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';
import { toast, modal } from '../ui.js';
import { Editor } from '../editor.js';
import { channelIcon } from '../pickers.js';

let rulesEditor = null;

/* ============================================================
   Рендер
   ============================================================ */

export function renderRulesView() {
  const root = document.getElementById('rulesEditor');
  if (!root) return;

  /* Section-intro один раз */
  const parent = root.parentNode;
  if (!parent.querySelector('.section-intro')) {
    parent.insertAdjacentHTML('afterbegin', `
      <div class="section-intro">
        <h2><i class="fa-solid fa-file-lines"></i> Правила и роли</h2>
        <p>Создайте сообщение с правилами сервера и кнопками, по которым участники сами получают роли (уведомления, регионы, интересы).</p>
        <ul>
          <li>Блоки: текст, секции, разделители, картинки, кнопки-ссылки и кнопки-роли</li>
          <li>Каждая кнопка-роль выдаёт или забирает роль по клику — с настраиваемым ответом</li>
          <li>Отправляйте в канал вручную — старое сообщение можно удалить</li>
        </ul>
      </div>
    `);
  }

  if (!rulesEditor) {
    rulesEditor = new Editor('rules', {
      getRoleName: () => null,
      lastSentAt: state.rules.lastSentAt,
      onSend: openSendRulesModal,
      onEditEphemeral: (blockId, buttonId) => openEphemeralEditor(rulesEditor, blockId, buttonId)
    });
  }

  rulesEditor._opts.lastSentAt = state.rules.lastSentAt;
  rulesEditor.mount(root);
  rulesEditor.load(state.rules);
}

export function getRulesEditor() {
  return rulesEditor;
}

export function triggerSendRules() {
  if (!rulesEditor) return toast('Редактор не готов', { type: 'error' });
  rulesEditor._opts.onSend?.();
}

/* ============================================================
   Сохранение
   ============================================================ */

export async function saveRules() {
  if (!rulesEditor) return;

  try {
    const cfg = rulesEditor.getConfig();
    await api.setData(state.guildId, 'rules', cfg);
    state.rules = { ...cfg };
    rulesEditor.markSaved();
    toast('Правила сохранены');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}

/* ============================================================
   Модалка отправки правил
   ============================================================ */

function openSendRulesModal() {
  const cfg = rulesEditor.getConfig();
  const ch = state.channels.find(c => c.id === cfg.channelId);
  if (!ch) return toast('Сначала выберите канал', { type: 'error' });

  openSendModal({
    title: 'Отправить правила',
    channel: ch,
    onConfirm: async (clear) => {
      try {
        await api.setData(state.guildId, 'rules', cfg);
        state.rules = { ...cfg };

        const r = await api.sendRules(state.guildId, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);

        state.rules.lastSentAt = new Date().toISOString();
        rulesEditor._opts.lastSentAt = state.rules.lastSentAt;
      } catch (e) {
        toast(e.message, { type: 'error' });
      }
    }
  });
}

/* ============================================================
   Настройка ephemeral-ответа кнопки-роли
   ============================================================ */

function openEphemeralEditor(parentEditor, blockId, buttonId) {
  const parentCfg = parentEditor.getConfig();
  const block = parentCfg.blocks.find(b => b.id === blockId);
  if (!block) return;

  const btn = block.buttons?.find(b => b.id === buttonId);
  if (!btn) return;

  const eph = btn.ephemeral?.positive && btn.ephemeral?.negative
    ? structuredClone(btn.ephemeral)
    : {
      positive: {
        displayMode: 'embed-color', accentColor: '#5865F2',
        title: '', subtitle: '', thumbnail: '',
        blocks: [{ id: 'e1', type: 'text', content: '✅ Роль выдана!' }]
      },
      negative: {
        displayMode: 'embed-color', accentColor: '#5865F2',
        title: '', subtitle: '', thumbnail: '',
        blocks: [{ id: 'e2', type: 'text', content: '❌ Роль снята!' }]
      }
    };

  let currentVariant = 'positive';

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-close>Отмена</button>
    <button type="button" class="btn btn-primary" data-save>Сохранить</button>
  `;

  let editorInstance = null;
  const m = modal({
    title: 'Ответ на кнопку роли',
    body: '',
    footer,
    size: 'fullscreen',
    onClose: () => editorInstance?.unmount()
  });

  m.bodyEl.innerHTML = `
    <div class="eph-tabs">
      <button type="button" class="eph-tab active" data-variant="positive">✅ Положительный</button>
      <button type="button" class="eph-tab" data-variant="negative">❌ Отрицательный</button>
    </div>
    <div data-ephemeral-editor class="rules-layout"></div>
  `;

  editorInstance = new Editor('ephemeral', {
    getRoleName: () => {
      if (!btn.roleId) return null;
      const r = state.roles.find(x => x.id === btn.roleId);
      return r?.name || null;
    }
  });
  editorInstance.mount(m.bodyEl.querySelector('[data-ephemeral-editor]'));
  editorInstance.load(eph[currentVariant]);

  m.bodyEl.querySelectorAll('.eph-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      eph[currentVariant] = editorInstance.getConfig();
      currentVariant = tab.dataset.variant;
      m.bodyEl.querySelectorAll('.eph-tab').forEach(t => t.classList.toggle('active', t === tab));
      editorInstance.load(eph[currentVariant]);
    });
  });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', () => {
    eph[currentVariant] = editorInstance.getConfig();
    btn.ephemeral = eph;
    parentEditor._markDirty();
    parentEditor._renderPreview();
    m.close();
    toast('Ответ сохранён');
  });
}

/* ============================================================
   Модалка «Отправить в канал»
   ============================================================ */

/**
 * Универсальная модалка отправки.
 * @param {object} opts
 * @param {string} opts.title
 * @param {object} opts.channel
 * @param {(clear: boolean) => Promise<void>} opts.onConfirm
 */
export function openSendModal({ title, channel, onConfirm }) {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-cancel>Отмена</button>
    <button type="button" class="btn btn-primary" data-confirm>Отправить</button>
  `;

  const body = `
    <div class="send-channel-info">
      <div class="send-channel-icon">${channelIcon(channel.type)}</div>
      <div class="send-channel-details">
        <strong>${escapeHtml(channel.name)}</strong>
        <span>${channel.id}</span>
      </div>
    </div>
    <label class="check-row">
      <input type="checkbox" data-clear>
      <div class="check-row-info">
        <strong>Очистить канал</strong>
        <span>Все сообщения будут удалены перед отправкой</span>
      </div>
    </label>
    <div class="warning-box" data-warn>
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Это действие необратимо.</span>
    </div>
  `;

  const m = modal({ title, body, footer });
  const clearCheckbox = m.bodyEl.querySelector('[data-clear]');
  const warn = m.bodyEl.querySelector('[data-warn]');
  const confirmBtn = footer.querySelector('[data-confirm]');

  clearCheckbox.addEventListener('change', () => {
    warn.classList.toggle('show', clearCheckbox.checked);
    confirmBtn.className = 'btn ' + (clearCheckbox.checked ? 'btn-danger' : 'btn-primary');
  });

  footer.querySelector('[data-cancel]').addEventListener('click', () => m.close());
  confirmBtn.addEventListener('click', async () => {
    const clear = clearCheckbox.checked;
    m.close();
    await onConfirm(clear);
  });
}

/* ============================================================
   Общая модалка редактора (messages/announcements/delayed)
   ============================================================ */

/**
 * Открывает модалку создания/редактирования элемента.
 * @param {object} opts
 * @param {string} opts.context - 'message'|'announcement'|'delayed'
 * @param {object} opts.draft
 * @param {string} opts.title
 * @param {Function} [opts.extrasBuilder]
 * @param {Function} [opts.extrasBinder]
 * @param {Function} [opts.extrasCollector]
 * @param {(data: object) => Promise<void>} opts.onSave
 */
export function openEditorModal({
  context, draft, title,
  extrasBuilder, extrasBinder, extrasCollector, onSave
}) {
  const extrasHTML = extrasBuilder
    ? extrasBuilder(context, draft)
    : { top: '', tabs: '' };

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-close>Отмена</button>
    <button type="button" class="btn btn-primary" data-save>Сохранить</button>
  `;

  let editorInstance = null;
  const m = modal({
    title,
    body: '',
    footer,
    size: 'fullscreen',
    onClose: () => editorInstance?.unmount()
  });

  m.bodyEl.innerHTML = `
    <div class="msg-editor-top">${extrasHTML.top}</div>
    <div data-editor class="rules-layout"></div>
    ${extrasHTML.tabs ? `<div style="margin-top:16px;">${extrasHTML.tabs}</div>` : ''}
  `;

  /* Channel picker (во всех контекстах присутствует) */
  import('../pickers.js').then(({ bindChannelPicker, channelIcon }) => {
    bindChannelPicker(m.bodyEl, {
      id: context + '_channel',
      onSelect: (ch) => { draft.channelId = ch?.id || ''; }
    });

    if (draft.channelId) {
      const ch = state.channels.find(c => c.id === draft.channelId);
      if (ch) {
        const hidden = m.bodyEl.querySelector(`[data-hidden="${context}_channel"]`);
        const input = m.bodyEl.querySelector(`[data-input="${context}_channel"]`);
        const icon = m.bodyEl.querySelector('.channel-input-icon');
        if (hidden) hidden.value = ch.id;
        if (input) input.value = ch.name;
        if (icon) icon.innerHTML = channelIcon(ch.type);
      }
    }
  });

  /* Название */
  const nameInput = m.bodyEl.querySelector('[data-msg-name]');
  if (nameInput) {
    nameInput.value = draft.name || '';
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
  }

  /* Редактор */
  editorInstance = new Editor(context, {
    lastSentAt: draft.lastSentAt,
    getRoleName: () => null,
    onEditEphemeral: (blockId, buttonId) => openEphemeralEditor(editorInstance, blockId, buttonId)
  });
  editorInstance.mount(m.bodyEl.querySelector('[data-editor]'));
  editorInstance.load({ ...draft.config });

  /* Extras */
  if (extrasBinder) extrasBinder(m.bodyEl, draft);

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const editorCfg = editorInstance.getConfig();
      const config = {
        displayMode: editorCfg.displayMode,
        accentColor: editorCfg.accentColor,
        title: editorCfg.title,
        subtitle: editorCfg.subtitle,
        thumbnail: editorCfg.thumbnail,
        blocks: editorCfg.blocks
      };

      const d = {
        ...draft,
        name: m.bodyEl.querySelector('[data-msg-name]')?.value || draft.name,
        channelId: m.bodyEl.querySelector(`[data-hidden="${context}_channel"]`)?.value || draft.channelId,
        config
      };

      if (extrasCollector) extrasCollector(m.bodyEl, d);

      await onSave(d);
      m.close();
    } catch (e) {
      toast(e.message || 'Ошибка сохранения', { type: 'error' });
    }
  });
}

/* ============================================================
   Нормализация
   ============================================================ */

export function normalizeRules(r) {
  const base = {
    channelId: '',
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: []
  };
  if (!r || typeof r !== 'object') return base;
  const m = { ...base, ...r };
  if (!Array.isArray(m.blocks)) m.blocks = [];
  return m;
}