import { state } from '../state.js';
import { api } from '../api.js';
import { uid, escapeHtml } from '../utils.js';
import { toast, modal } from '../ui.js';
import { Editor } from '../editor.js';
import { channelIcon } from '../pickers.js';

let rulesEditor = null;

export function renderRulesView() {
  const root = document.getElementById('rulesEditor');
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

export function getRulesEditor() { return rulesEditor; }

export function triggerSendRules() {
  if (!rulesEditor) return toast('Редактор не готов', { type: 'error' });
  rulesEditor._opts.onSend?.();
}

export async function saveRules() {
  if (!rulesEditor) return;
  try {
    const cfg = rulesEditor.getConfig();
    await api.setData(state.guildId, 'rules', cfg);
    state.rules = { ...cfg };
    rulesEditor.markSaved();
    toast('Правила сохранены');
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function openSendRulesModal() {
  const cfg = rulesEditor.getConfig();
  const ch = state.channels.find(c => c.id === cfg.channelId);
  if (!ch) return toast('Сначала выберите канал', { type: 'error' });
  openSendModal({
    title: 'Отправка правил',
    channel: ch,
    onConfirm: async (clear) => {
      try {
        await api.setData(state.guildId, 'rules', cfg);
        state.rules = { ...cfg };
        const r = await api.sendRules(state.guildId, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        state.rules.lastSentAt = new Date().toISOString();
        rulesEditor._opts.lastSentAt = state.rules.lastSentAt;
      } catch (e) { toast(e.message, { type: 'error' }); }
    }
  });
}

/* ================= Ephemeral editor ================= */
function openEphemeralEditor(parentEditor, blockId, buttonId) {
  const parentCfg = parentEditor.getConfig();
  const block = parentCfg.blocks.find(b => b.id === blockId);
  if (!block) return;
  const btn = block.buttons?.find(b => b.id === buttonId);
  if (!btn) return;

  const eph = btn.ephemeral && btn.ephemeral.positive && btn.ephemeral.negative
    ? structuredClone(btn.ephemeral)
    : {
        positive: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [{ id: uid(), type: 'text', content: '✅ Роль выдана!' }] },
        negative: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [{ id: uid(), type: 'text', content: '❌ Роль снята!' }] }
      };

  let currentVariant = 'positive';

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-close>Отмена</button><button type="button" class="btn btn-primary" data-save>Сохранить</button>`;

  let editorInstance = null;
  const m = modal({ title: 'Ответ на кнопку роли', body: '', footer, size: 'fullscreen', onClose: () => editorInstance?.unmount() });

  m.bodyEl.innerHTML = `
    <div class="eph-tabs">
      <button type="button" class="eph-tab active" data-variant="positive">✓ Положительный</button>
      <button type="button" class="eph-tab" data-variant="negative">✗ Отрицательный</button>
    </div>
    <div data-ephemeral-editor class="rules-layout"></div>
  `;

  editorInstance = new Editor('ephemeral', {
    getRoleName: () => {
      if (!btn.roleId) return null;
      const currentRole = state.roles.find(r => r.id === btn.roleId);
      return currentRole?.name || null;
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
    toast('Ответы сохранены');
  });
}

/* ================= Send modal ================= */
export function openSendModal({ title, channel, onConfirm }) {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-cancel>Отмена</button><button type="button" class="btn btn-primary" data-confirm>Отправить</button>`;
  const body = `
    <div class="send-channel-info">
      <div class="send-channel-icon">${channelIcon(channel.type)}</div>
      <div class="send-channel-details"><strong>${escapeHtml(channel.name)}</strong><span>${channel.id}</span></div>
    </div>
    <label class="check-row">
      <input type="checkbox" data-clear>
      <div class="check-row-info"><strong>Очистить канал</strong><span>Все сообщения будут удалены перед отправкой</span></div>
    </label>
    <div class="warning-box" data-warn>
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Это действие нельзя отменить.</span>
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

/* ================= Shared editor modal ================= */
export function openEditorModal({ context, draft, title, extrasBuilder, extrasBinder, extrasCollector, onSave }) {
  const extrasHTML = extrasBuilder(context, draft);
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-close>Отмена</button><button type="button" class="btn btn-primary" data-save>Сохранить</button>`;

  let editorInstance = null;
  const m = modal({ title, body: '', footer, size: 'fullscreen', onClose: () => editorInstance?.unmount() });

  m.bodyEl.innerHTML = `
    <div class="msg-editor-top">${extrasHTML.top}</div>
    <div data-editor class="rules-layout"></div>
    ${extrasHTML.tabs ? `<div style="margin-top:16px;">${extrasHTML.tabs}</div>` : ''}
  `;

  import('../pickers.js').then(({ bindChannelPicker, channelIcon }) => {
    bindChannelPicker(m.bodyEl, { id: context + '_channel', onSelect: (ch) => { draft.channelId = ch?.id || ''; } });
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

  const nameInput = m.bodyEl.querySelector('[data-msg-name]');
  if (nameInput) {
    nameInput.value = draft.name || '';
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });
  }

  editorInstance = new Editor(context, {
    lastSentAt: draft.lastSentAt,
    getRoleName: () => null,
    onEditEphemeral: (blockId, buttonId) => openEphemeralEditor(editorInstance, blockId, buttonId)
  });
  editorInstance.mount(m.bodyEl.querySelector('[data-editor]'));
  editorInstance.load({ ...draft.config });

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