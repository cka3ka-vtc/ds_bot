/* ============================================================
   Автоудаление: правила очистки каналов.
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState, modal } from '../ui.js';
import { channelIcon, channelPickerHTML, bindChannelPicker } from '../pickers.js';
import { renderMessageCard, actionsDivider, ICONS, actionButton } from '../card-templates.js';
import { updateBotStatus } from './helpers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const UNIT_FACTOR = { minutes: 1, hours: 60, days: 1440 };
const MAX_MINUTES = 10080;
const AUTODELETE_ICON = '<i class="fa-solid fa-shield-halved"></i>';
let autodeleteToolbar = null;

const SECTION_INTRO = `
  <div class="section-intro">
    <h2><i class="fa-solid fa-shield-halved"></i> Автоудаление</h2>
    <p>Гигиена каналов: удалять все сообщения сразу или через заданное время. Полезно для чатов-однодневок, флудилок и каналов с эфемерным контентом.</p>
    <ul>
      <li>Мгновенное удаление — все новые сообщения сразу исчезают</li>
      <li>С задержкой — сообщение удалится через N минут/часов/дней</li>
      <li>Не затрагивает сообщения ботов</li>
    </ul>
  </div>
`;

/* ============================================================
   Утилиты
   ============================================================ */

function splitMinutes(total) {
  if (!total || total <= 0) return { value: 60, unit: 'minutes' };
  if (total % 1440 === 0) return { value: total / 1440, unit: 'days' };
  if (total % 60 === 0) return { value: total / 60, unit: 'hours' };
  return { value: total, unit: 'minutes' };
}

function toMinutes(v, u) {
  return Math.max(1, Math.min(MAX_MINUTES, Math.round(Number(v) * (UNIT_FACTOR[u] || 1))));
}

function formatMinutes(m) {
  if (!m) return '—';
  if (m < 60) return `${m} мин`;
  if (m < 1440) return `${Math.round(m / 60)} ч`;
  return `${Math.round(m / 1440)} дн`;
}

/* ============================================================
   Рендер
   ============================================================ */

export function renderAutodeleteList() {
  const container = document.getElementById('autodeleteList');
  if (!container) return;

  const parent = container.parentNode;
  if (!parent.querySelector('.section-intro')) {
    parent.insertAdjacentHTML('afterbegin', SECTION_INTRO);
  }

  if (!state.autodelete.length) {
    if (autodeleteToolbar) { autodeleteToolbar.destroy(); autodeleteToolbar = null; }
    container.innerHTML = emptyState({
      icon: 'fa-shield-halved',
      title: 'Пока нет правил',
      text: 'Правило автоудаления очищает канал от сообщений. Создайте одно — например, для канала-флудилки.',
      ctaLabel: 'Создать правило',
      ctaAction: 'create-ad'
    });
    container.querySelector('[data-create-ad]')?.addEventListener('click', createAutodeleteFlow);
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
          ? 'Мгновенное удаление'
          : `Через ${formatMinutes(a.deleteAfterMinutes)}`;
        const metaLeft = `<span class="list-meta-item">${escapeHtml(modeText)}</span>`;
        const actions = `
          <button type="button" class="switch ${a.enabled ? 'on' : ''}" data-ad-toggle="${a.id}"></button>
          ${actionsDivider()}
          ${actionButton('edit', ICONS.edit, 'Редактировать', 'data-ad-action', a.id)}
          ${actionButton('delete', ICONS.delete, 'Удалить', 'data-ad-action', a.id, true)}
        `;
        return renderMessageCard({
          item: a, icon: AUTODELETE_ICON, title: a.name || 'Без названия',
          actions, metaLeft, metaRight: '',
          statusClass: a.enabled ? 'active' : '', selectable: true
        });
      }).join('');
      bindActions(container);
    },
    searchPlaceholder: 'Поиск по названию…',
    searchKeyFn: (a) => a.name || '',
    filters: [{ id: 'on', label: 'Только включённые', fn: a => a.enabled }],
    actions: [
      { id: 'enable', label: 'Включить', handler: ids => bulkToggle(ids, true) },
      { id: 'disable', label: 'Выключить', handler: ids => bulkToggle(ids, false) },
      { id: 'delete', label: 'Удалить', danger: true, handler: bulkDelete }
    ]
  });
  autodeleteToolbar.refresh();
}

/* ============================================================
   Bulk
   ============================================================ */

async function bulkToggle(ids, enabled) {
  const affected = state.autodelete.filter(a => ids.includes(a.id));
  const prev = affected.map(a => ({ id: a.id, enabled: a.enabled }));
  for (const a of affected) a.enabled = enabled;

  try {
    await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
    updateBotStatus();
    renderAutodeleteList();
    toast(`${enabled ? 'Включено' : 'Выключено'}: ${affected.length}`);
  } catch (e) {
    for (const p of prev) {
      const a = state.autodelete.find(x => x.id === p.id);
      if (a) a.enabled = p.enabled;
    }
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function bulkDelete(ids) {
  const ok = await confirmDialog({
    title: 'Удаление',
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

/* ============================================================
   Действия
   ============================================================ */

function bindActions(container) {
  container.querySelectorAll('[data-ad-toggle]').forEach(sw => {
    sw.addEventListener('click', async (e) => {
      e.stopPropagation();
      const a = state.autodelete.find(x => x.id === sw.dataset.adToggle);
      if (!a) return;
      const prev = a.enabled;
      a.enabled = !a.enabled;

      try {
        await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
        updateBotStatus();
        renderAutodeleteList();
        toast(a.enabled ? 'Включено' : 'Выключено');
      } catch (err) {
        a.enabled = prev;
        toast('Ошибка: ' + err.message, { type: 'error' });
      }
    });
  });

  container.querySelectorAll('[data-ad-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { adAction: action, id } = btn.dataset;
      if (action === 'edit') return openAutodeleteEditor(id);
      if (action === 'export') return exportAutodelete(id);
      if (action === 'delete') return deleteAutodelete(id);
    });
  });
}

/* ============================================================
   Создание
   ============================================================ */

export async function createAutodeleteFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Создать правило',
    onCreate: () => openAutodeleteEditor(null),
    onImport: (data) => importAutodeleteFlow(data),
    validateSection: 'autodelete'
  });
}

function importAutodeleteFlow(data) {
  try {
    const draft = {
      id: 'ad_' + uid(),
      name: data.name || 'Импортированное',
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
  if (existing) {
    openAutodeleteEditorDraft({ ...existing, isNew: false });
  } else {
    openAutodeleteEditorDraft({
      id: 'ad_' + uid(), name: '', channelId: '',
      mode: 'instant', deleteAfterMinutes: 60, enabled: true, isNew: true
    });
  }
}

function openAutodeleteEditorDraft(draft) {
  const { value: initV, unit: initU } = splitMinutes(draft.deleteAfterMinutes || 60);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-close>Отмена</button>
    <button type="button" class="btn btn-primary" data-save>Сохранить</button>
  `;

  const body = `
    <div class="form-group">
      <label>Название правила</label>
      <input class="input" data-ad-name placeholder="Например: Удаление из #general">
    </div>
    <div class="form-group">
      <label>Канал</label>
      ${channelPickerHTML({ id: 'ad_channel' })}
    </div>
    <div class="form-group">
      <label>Режим</label>
      <div class="radio-group" data-ad-mode>
        <label class="radio-row"><input type="radio" name="ad-mode" value="instant" ${draft.mode === 'instant' ? 'checked' : ''}><span>Удалять все новые сообщения</span></label>
        <label class="radio-row"><input type="radio" name="ad-mode" value="delayed" ${draft.mode === 'delayed' ? 'checked' : ''}><span>Удалять спустя заданное время</span></label>
      </div>
      <div data-ad-delayed-group style="display:${draft.mode === 'delayed' ? 'block' : 'none'};">
        <label style="margin-bottom:7px;display:block;">Через</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="number" class="input" data-ad-value min="1" value="${initV}" style="flex:1;">
          <select class="input" data-ad-unit style="width:150px;">
            <option value="minutes" ${initU === 'minutes' ? 'selected' : ''}>минут</option>
            <option value="hours" ${initU === 'hours' ? 'selected' : ''}>часов</option>
            <option value="days" ${initU === 'days' ? 'selected' : ''}>дней</option>
          </select>
        </div>
        <span class="hint" style="margin-top:6px;display:block;">До 7 дней</span>
      </div>
    </div>
    <div class="form-group">
      <label class="ann-status-toggle"><input type="checkbox" data-ad-enabled ${draft.enabled ? 'checked' : ''}><span>Включено</span></label>
    </div>
  `;

  const m = modal({ title: draft.isNew ? 'Создать правило' : 'Редактирование', body, footer });

  bindChannelPicker(m.bodyEl, { id: 'ad_channel', onSelect: (ch) => { draft.channelId = ch?.id || ''; } });

  if (draft.channelId) {
    const ch = state.channels.find(c => c.id === draft.channelId);
    if (ch) {
      const h = m.bodyEl.querySelector('[data-hidden="ad_channel"]');
      const i = m.bodyEl.querySelector('[data-input="ad_channel"]');
      const ic = m.bodyEl.querySelector('.channel-input-icon');
      if (h) h.value = ch.id;
      if (i) i.value = ch.name;
      if (ic) ic.innerHTML = channelIcon(ch.type);
    }
  }

  const nameInput = m.bodyEl.querySelector('[data-ad-name]');
  nameInput.value = draft.name || '';
  nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

  const dg = m.bodyEl.querySelector('[data-ad-delayed-group]');
  m.bodyEl.querySelectorAll('[data-ad-mode] input').forEach(r => {
    r.addEventListener('change', () => {
      if (!r.checked) return;
      draft.mode = r.value;
      dg.style.display = r.value === 'delayed' ? 'block' : 'none';
    });
  });

  const ec = m.bodyEl.querySelector('[data-ad-enabled]');
  ec.addEventListener('change', () => { draft.enabled = ec.checked; });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      if (!draft.name?.trim()) throw new Error('Укажите название');
      const ch = state.channels.find(c => c.id === draft.channelId);
      if (!ch) throw new Error('Выберите канал');

      let minutes;
      if (draft.mode === 'delayed') {
        const v = parseInt(m.bodyEl.querySelector('[data-ad-value]').value);
        if (!v || v < 1) throw new Error('Укажите время');
        minutes = toMinutes(v, m.bodyEl.querySelector('[data-ad-unit]').value);
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
      toast('Сохранено');
      m.close();
    } catch (e) {
      toast(e.message || 'Ошибка', { type: 'error' });
    }
  });
}

/* ============================================================
   Экспорт / удаление
   ============================================================ */

function exportAutodelete(id) {
  const a = state.autodelete.find(x => x.id === id);
  if (!a) return;
  downloadJSON({
    name: a.name, channelId: a.channelId, channelName: a.channelName,
    mode: a.mode, deleteAfterMinutes: a.deleteAfterMinutes, enabled: a.enabled
  }, `${sanitize(a.name || 'autodelete')}.json`);
  toast('Экспортировано');
}

async function deleteAutodelete(id) {
  const a = state.autodelete.find(x => x.id === id);
  const ok = await confirmDialog({
    title: 'Удаление',
    text: `Удалить «${a?.name || 'Без названия'}»?`,
    actionText: 'Удалить'
  });
  if (!ok) return;

  try {
    state.autodelete = state.autodelete.filter(x => x.id !== id);
    await api.setData(state.guildId, 'autodelete', { items: state.autodelete });
    updateBotStatus();
    renderAutodeleteList();
    toast('Удалено');
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}