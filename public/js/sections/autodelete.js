import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, pickJSONFile, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState, modal } from '../ui.js';
import { channelIcon, channelPickerHTML, bindChannelPicker } from '../pickers.js';
import { renderMessageCard, actionsDivider, ICONS, actionButton } from '../card-templates.js';
import { updateBotStatus } from './helpers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const UNIT_FACTOR = { minutes: 1, hours: 60, days: 1440 };
const MAX_MINUTES = 10080;

const AUTODELETE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

let autodeleteToolbar = null;

function splitMinutes(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return { value: 60, unit: 'minutes' };
  if (totalMinutes % 1440 === 0) return { value: totalMinutes / 1440, unit: 'days' };
  if (totalMinutes % 60 === 0) return { value: totalMinutes / 60, unit: 'hours' };
  return { value: totalMinutes, unit: 'minutes' };
}
function toMinutes(value, unit) {
  const factor = UNIT_FACTOR[unit] || 1;
  const n = Math.round(Number(value) * factor);
  return Math.max(1, Math.min(MAX_MINUTES, n));
}
function formatMinutes(min) {
  if (!min) return '—';
  if (min < 60) return `${min} мин`;
  if (min < 1440) return `${Math.round(min / 60)} ч`;
  return `${Math.round(min / 1440)} дн`;
}

export function renderAutodeleteList() {
  const container = document.getElementById('autodeleteList');
  if (!container) return;

  if (!state.autodelete.length) {
    if (autodeleteToolbar) { autodeleteToolbar.destroy(); autodeleteToolbar = null; }
    container.innerHTML = emptyState(
      '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      'Пока нет правил автоудаления', 'Нажмите «Создать автоудаление»'
    );
    return;
  }

  if (autodeleteToolbar && autodeleteToolbar.el.isConnected) {
    autodeleteToolbar.refresh();
    return;
  }

  autodeleteToolbar = createListToolbar({
    listEl: container,
    getAllItems: () => state.autodelete,
    renderList: (items) => {
      if (!items.length) { container.innerHTML = noResultsHTML(); return; }
      container.innerHTML = items.map(a => {
        const modeText = a.mode === 'instant'
          ? 'Все новые сообщения удаляются'
          : `Удаление через ${formatMinutes(a.deleteAfterMinutes)}`;
        const metaLeft = `<span class="list-meta-item">${escapeHtml(modeText)}</span>`;
        const actions = `
          <button type="button" class="switch ${a.enabled ? 'on' : ''}" data-ad-toggle="${a.id}" aria-label="Включить/отключить"></button>
          ${actionsDivider()}
          ${actionButton('edit', ICONS.edit, 'Редактировать', 'data-ad-action', a.id)}
          ${actionButton('delete', ICONS.delete, 'Удалить', 'data-ad-action', a.id, true)}
        `;
        return renderMessageCard({
          item: a, icon: AUTODELETE_ICON,
          title: a.name || 'Без названия',
          actions, metaLeft, metaRight: '',
          statusClass: a.enabled ? 'active' : '',
          selectable: true
        });
      }).join('');
      bindAutodeleteActions(container);
    },
    searchPlaceholder: 'Поиск по названию правила…',
    searchKeyFn: (a) => a.name || '',
    filters: [
      { id: 'on', label: 'Только включённые', fn: a => a.enabled }
    ],
    actions: [
      { id: 'enable', label: 'Включить', handler: ids => bulkToggleAutodelete(ids, true) },
      { id: 'disable', label: 'Отключить', handler: ids => bulkToggleAutodelete(ids, false) },
      { id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteAutodelete }
    ]
  });
  autodeleteToolbar.refresh();
}

async function bulkToggleAutodelete(ids, enabled) {
  const affected = state.autodelete.filter(a => ids.includes(a.id));
  const prev = affected.map(a => ({ id: a.id, enabled: a.enabled }));
  for (const a of affected) a.enabled = enabled;
  try {
    await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
    updateBotStatus();
    renderAutodeleteList();
    toast(`${enabled ? 'Включено' : 'Отключено'}: ${affected.length}`);
  } catch (e) {
    for (const p of prev) {
      const a = state.autodelete.find(x => x.id === p.id);
      if (a) a.enabled = p.enabled;
    }
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function bulkDeleteAutodelete(ids) {
  const ok = await confirmDialog({
    title: 'Удаление правил',
    text: `Удалить ${ids.length} ${pluralize(ids.length, ['правило', 'правила', 'правил'])}?`,
    actionText: 'Удалить'
  });
  if (!ok) return;
  try {
    state.autodelete = state.autodelete.filter(a => !ids.includes(a.id));
    await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
    updateBotStatus();
    renderAutodeleteList();
    toast(`Удалено: ${ids.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

function bindAutodeleteActions(container) {
  container.querySelectorAll('[data-ad-toggle]').forEach(sw => {
    sw.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = sw.dataset.adToggle;
      const a = state.autodelete.find(x => x.id === id);
      if (!a) return;
      const prev = a.enabled;
      a.enabled = !a.enabled;
      try {
        await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
        updateBotStatus();
        renderAutodeleteList();
        toast(a.enabled ? 'Правило включено' : 'Правило отключено');
      } catch (err) {
        a.enabled = prev;
        toast('Ошибка: ' + err.message, { type: 'error' });
      }
    });
  });

  container.querySelectorAll('[data-ad-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.adAction;
      const id = btn.dataset.id;
      if (action === 'edit') return openAutodeleteEditor(id);
      if (action === 'export') return exportAutodelete(id);
      if (action === 'delete') return deleteAutodelete(id);
    });
  });
}

export async function createAutodeleteFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Новое автоудаление',
    onCreate: () => openAutodeleteEditor(null),
    onImport: () => importAutodeleteFlow()
  });
}

async function importAutodeleteFlow() {
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран или повреждён', { type: 'error' });
  try {
    const draft = {
      id: 'ad_' + uid(),
      name: data.name || 'Импортированное правило',
      channelId: data.channelId || '',
      mode: data.mode === 'delayed' ? 'delayed' : 'instant',
      deleteAfterMinutes: data.deleteAfterMinutes || 60,
      enabled: data.enabled !== false,
      isNew: true
    };
    openAutodeleteEditorDraft(draft);
  } catch (e) {
    toast('Ошибка импорта: ' + e.message, { type: 'error' });
  }
}

export function openAutodeleteEditor(id) {
  const existing = id ? state.autodelete.find(a => a.id === id) : null;
  if (existing) openAutodeleteEditorDraft({ ...existing, isNew: false });
  else openAutodeleteEditorDraft({
    id: 'ad_' + uid(), name: '', channelId: '',
    mode: 'instant', deleteAfterMinutes: 60, enabled: true, isNew: true
  });
}

function openAutodeleteEditorDraft(draft) {
  const { value: initialValue, unit: initialUnit } = splitMinutes(draft.deleteAfterMinutes || 60);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-close>Отмена</button><button type="button" class="btn btn-primary" data-save>Сохранить</button>`;

  const body = `
    <div class="form-group">
      <label>Название правила</label>
      <input class="input" data-ad-name placeholder="Например: Очистка #general">
    </div>
    <div class="form-group">
      <label>Канал</label>
      ${channelPickerHTML({ id: 'ad_channel' })}
    </div>
    <div class="form-group">
      <label>Режим</label>
      <div class="radio-group" data-ad-mode>
        <label class="radio-row"><input type="radio" name="ad-mode" value="instant" ${draft.mode === 'instant' ? 'checked' : ''}><span>Удалять все новые сообщения</span></label>
        <label class="radio-row"><input type="radio" name="ad-mode" value="delayed" ${draft.mode === 'delayed' ? 'checked' : ''}><span>Удалять сообщение спустя заданное время</span></label>
      </div>
      <div data-ad-delayed-group style="display:${draft.mode === 'delayed' ? 'block' : 'none'};">
        <label style="margin-bottom:7px;display:block;">Через</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" class="input" data-ad-value min="1" value="${initialValue}" style="flex:1;">
          <select class="input" data-ad-unit style="width:150px;flex-shrink:0;">
            <option value="minutes" ${initialUnit === 'minutes' ? 'selected' : ''}>минут</option>
            <option value="hours" ${initialUnit === 'hours' ? 'selected' : ''}>часов</option>
            <option value="days" ${initialUnit === 'days' ? 'selected' : ''}>дней</option>
          </select>
        </div>
        <span class="hint" style="margin-top:6px;display:block;">От 1 минуты до 7 дней</span>
      </div>
    </div>
    <div class="form-group">
      <label class="ann-status-toggle"><input type="checkbox" data-ad-enabled ${draft.enabled ? 'checked' : ''}><span>Включено</span></label>
    </div>
  `;

  const m = modal({ title: draft.isNew ? 'Новое автоудаление' : 'Редактирование автоудаления', body, footer });

  bindChannelPicker(m.bodyEl, { id: 'ad_channel', onSelect: (ch) => { draft.channelId = ch?.id || ''; } });

  if (draft.channelId) {
    const ch = state.channels.find(c => c.id === draft.channelId);
    if (ch) {
      const hidden = m.bodyEl.querySelector('[data-hidden="ad_channel"]');
      const input = m.bodyEl.querySelector('[data-input="ad_channel"]');
      const icon = m.bodyEl.querySelector('.channel-input-icon');
      if (hidden) hidden.value = ch.id;
      if (input) input.value = ch.name;
      if (icon) icon.innerHTML = channelIcon(ch.type);
    }
  }

  const nameInput = m.bodyEl.querySelector('[data-ad-name]');
  nameInput.value = draft.name || '';
  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

  const delayedGroup = m.bodyEl.querySelector('[data-ad-delayed-group]');
  m.bodyEl.querySelectorAll('[data-ad-mode] input').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      draft.mode = r.value;
      delayedGroup.style.display = r.value === 'delayed' ? 'block' : 'none';
    });
  });

  const enabledCheck = m.bodyEl.querySelector('[data-ad-enabled]');
  enabledCheck.addEventListener('change', () => { draft.enabled = enabledCheck.checked; });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      if (!draft.name?.trim()) throw new Error('Введите название');
      const ch = state.channels.find(c => c.id === draft.channelId);
      if (!ch) throw new Error('Выберите канал');

      let minutes;
      if (draft.mode === 'delayed') {
        const rawValue = parseInt(m.bodyEl.querySelector('[data-ad-value]').value);
        if (!rawValue || rawValue < 1) throw new Error('Укажите корректное время удаления');
        minutes = toMinutes(rawValue, m.bodyEl.querySelector('[data-ad-unit]').value);
      }

      const item = {
        id: draft.id, name: draft.name, channelId: draft.channelId, channelName: ch.name,
        mode: draft.mode, enabled: draft.enabled,
        deleteAfterMinutes: minutes,
        createdAt: draft.createdAt || new Date().toISOString()
      };
      if (draft.isNew) state.autodelete.push(item);
      else {
        const idx = state.autodelete.findIndex(x => x.id === draft.id);
        if (idx >= 0) state.autodelete[idx] = { ...state.autodelete[idx], ...item };
      }
      await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
      updateBotStatus();
      renderAutodeleteList();
      toast('Автоудаление сохранено');
      m.close();
    } catch (e) {
      toast(e.message || 'Ошибка сохранения', { type: 'error' });
    }
  });
}

function exportAutodelete(id) {
  const a = state.autodelete.find(x => x.id === id);
  if (!a) return;
  downloadJSON({
    name: a.name, channelId: a.channelId, channelName: a.channelName,
    mode: a.mode, deleteAfterMinutes: a.deleteAfterMinutes, enabled: a.enabled
  }, `${sanitize(a.name || 'autodelete')}.json`);
  toast('Правило экспортировано');
}

async function deleteAutodelete(id) {
  const a = state.autodelete.find(x => x.id === id);
  const ok = await confirmDialog({ title: 'Удаление автоудаления', text: `Удалить «${a?.name || 'Без названия'}»?`, actionText: 'Удалить' });
  if (!ok) return;
  try {
    state.autodelete = state.autodelete.filter(x => x.id !== id);
    await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
    updateBotStatus();
    renderAutodeleteList();
    toast('Правило удалено');
  } catch (e) { toast('Ошибка: ' + e.message, { type: 'error' }); }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}