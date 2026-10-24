import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, pickJSONFile, formatDateTime, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';
import {
  findChannel, renderMessageCard, actionsDropdown, actionsDivider, sendButton,
  bindActionsDropdown, ICONS, actionButton
} from '../card-templates.js';
import { openSendModal, openEditorModal } from './rules.js';
import {
  makeNewAnnouncementDraft, announcementsExtrasHTML,
  bindAnnouncementExtras, collectAnnouncementExtras
} from '../extras.js';
import { updateBotStatus } from './helpers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const DEFAULT_ICON = 'fa-bullhorn';

let announcementsToolbar = null;

function renderAnnouncementIcon(icon) {
  const ic = (icon && /^fa-[a-z0-9-]+$/i.test(icon)) ? icon : DEFAULT_ICON;
  return `<i class="fa-solid ${escapeHtml(ic)}" aria-hidden="true"></i>`;
}

function formatSchedule(s) {
  if (!s || s.type === 'manual') return 'Вручную';
  if (s.type === 'interval') return `Каждые ${s.intervalMinutes < 60 ? s.intervalMinutes + ' мин' : (s.intervalMinutes/60) + ' ч'}`;
  if (s.type === 'daily') return `Ежедневно в ${s.time}`;
  if (s.type === 'weekly') { const d = ['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'][s.dayOfWeek] || '?'; return `${d} в ${s.time}`; }
  if (s.type === 'monthly') return `${s.dayOfMonth} числа в ${s.time}`;
  return '—';
}

export function renderAnnouncementsList() {
  const container = document.getElementById('announcementsList');
  if (!container) return;

  if (!state.announcements.length) {
    if (announcementsToolbar) { announcementsToolbar.destroy(); announcementsToolbar = null; }
    container.innerHTML = emptyState(
      '<path d="M3 11l18-8v18l-18-8z"/><line x1="11.6" y1="11.6" x2="8" y2="18"/>',
      'Пока нет анонсов', 'Нажмите «Создать анонс»'
    );
    return;
  }

  if (announcementsToolbar && announcementsToolbar.el.isConnected) {
    announcementsToolbar.refresh();
    return;
  }

  announcementsToolbar = createListToolbar({
    listEl: container,
    getAllItems: () => state.announcements,
    renderList: (items) => {
      if (!items.length) { container.innerHTML = noResultsHTML(); return; }
      container.innerHTML = items.map(a => {
        const sched = formatSchedule(a.schedule);
        const lastSentText = a.lastSentAt ? `Последняя отправка: ${formatDateTime(a.lastSentAt)}` : 'Ещё не отправлялось';

        const metaLeft = `
          <span class="list-meta-item">${ICONS.clock}${escapeHtml(sched)}</span>
          <span class="info-sep">·</span>
          <span class="list-meta-item">${escapeHtml(lastSentText)}</span>
        `;
        const metaRight = sendButton(a.id, 'data-ann-action');

        const actions = `
          <button type="button" class="switch ${a.enabled ? 'on' : ''}" data-ann-toggle="${a.id}" aria-label="Включить/отключить"></button>
          ${actionsDivider()}
          ${actionButton('edit', ICONS.edit, 'Редактировать', 'data-ann-action', a.id)}
          ${actionButton('delete', ICONS.delete, 'Удалить', 'data-ann-action', a.id, true)}
          ${actionsDivider()}
          ${actionsDropdown(a.id, 'data-ann-action', [
            { action: 'delete-discord', icon: ICONS.delete, label: 'Удалить в Discord', danger: true, disabled: !a.lastMessageId },
            { action: 'copy', icon: ICONS.copy, label: 'Копировать' },
            { action: 'export', icon: ICONS.export, label: 'Экспортировать' }
          ])}
        `;

        return renderMessageCard({
          item: a, icon: renderAnnouncementIcon(a.icon),
          title: a.name || 'Без названия',
          actions, metaLeft, metaRight,
          statusClass: a.enabled ? 'active' : '',
          selectable: true
        });
      }).join('');
      bindAnnouncementActions(container);
      bindActionsDropdown(container);
    },
    searchPlaceholder: 'Поиск по названию анонса…',
    searchKeyFn: (a) => a.name || '',
    filters: [
      { id: 'on', label: 'Только включённые', fn: a => a.enabled }
    ],
    actions: [
      { id: 'enable', label: 'Включить', handler: ids => bulkToggleAnnouncements(ids, true) },
      { id: 'disable', label: 'Отключить', handler: ids => bulkToggleAnnouncements(ids, false) },
      { id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteAnnouncements }
    ]
  });
  announcementsToolbar.refresh();
}

/* ============================================================
   Массовые действия
   ============================================================ */
async function bulkToggleAnnouncements(ids, enabled) {
  const affected = state.announcements.filter(a => ids.includes(a.id));
  const prev = affected.map(a => ({ id: a.id, enabled: a.enabled }));
  for (const a of affected) a.enabled = enabled;
  try {
    await api.setData(state.guildId, 'announcements', { items: state.announcements });
    updateBotStatus();
    renderAnnouncementsList();
    toast(`${enabled ? 'Включено' : 'Отключено'}: ${affected.length}`);
  } catch (e) {
    /* откат */
    for (const p of prev) {
      const a = state.announcements.find(x => x.id === p.id);
      if (a) a.enabled = p.enabled;
    }
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function bulkDeleteAnnouncements(ids) {
  const ok = await confirmDialog({
    title: 'Удаление анонсов',
    text: `Удалить ${ids.length} ${pluralize(ids.length, ['анонс', 'анонса', 'анонсов'])}?`,
    actionText: 'Удалить'
  });
  if (!ok) return;
  try {
    state.announcements = state.announcements.filter(a => !ids.includes(a.id));
    await api.setData(state.guildId, 'announcements', { items: state.announcements });
    updateBotStatus();
    renderAnnouncementsList();
    toast(`Удалено: ${ids.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Индивидуальные действия
   ============================================================ */
function bindAnnouncementActions(container) {
  container.querySelectorAll('[data-ann-toggle]').forEach(sw => {
    sw.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = sw.dataset.annToggle;
      const a = state.announcements.find(x => x.id === id);
      if (!a) return;
      const prev = a.enabled;
      a.enabled = !a.enabled;
      try {
        await api.setData(state.guildId, 'announcements', { items: state.announcements });
        updateBotStatus();
        renderAnnouncementsList();
        toast(a.enabled ? 'Анонс включён' : 'Анонс отключён');
      } catch (err) {
        a.enabled = prev;
        toast('Ошибка: ' + err.message, { type: 'error' });
      }
    });
  });

  container.querySelectorAll('[data-ann-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.annAction;
      const id = btn.dataset.id;
      if (action === 'edit') return openAnnouncementEditor(id);
      if (action === 'send') return sendAnnouncementNow(id);
      if (action === 'export') return exportAnnouncement(id);
      if (action === 'copy') return copyAnnouncement(id);
      if (action === 'delete') return deleteAnnouncement(id);
      if (action === 'delete-discord') return deleteAnnouncementDiscord(id);
    });
  });
}

export async function createAnnouncementFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Новый анонс',
    onCreate: () => openAnnouncementEditor(null),
    onImport: () => importAnnouncementFlow()
  });
}

async function importAnnouncementFlow() {
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран или повреждён', { type: 'error' });
  try {
    const draft = {
      ...makeNewAnnouncementDraft(),
      name: data.name || 'Импортированный анонс',
      channelId: data.channelId || '',
      icon: data.icon || DEFAULT_ICON,
      config: data.config || { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
      schedule: data.schedule || { type: 'manual', intervalMinutes: 30, time: '12:00', dayOfWeek: 1, dayOfMonth: 1 },
      autoDelete: data.autoDelete || { enabled: false, minutes: 60 },
      eventTime: data.eventTime || { enabled: false, type: 'daily', time: '18:00', dayOfWeek: 1, dayOfMonth: 1 },
      mention: data.mention || { type: 'none', roleId: '', userId: '' }
    };
    openAnnouncementEditorDraft(draft);
  } catch (e) { toast('Ошибка импорта: ' + e.message, { type: 'error' }); }
}

export function openAnnouncementEditor(id) {
  const existing = id ? state.announcements.find(a => a.id === id) : null;
  if (existing) {
    const initialIcon = (existing.icon && /^fa-[a-z0-9-]+$/i.test(existing.icon)) ? existing.icon : DEFAULT_ICON;
    openAnnouncementEditorDraft({ ...existing, config: { ...existing.config }, icon: initialIcon, isNew: false });
  } else {
    openAnnouncementEditorDraft(makeNewAnnouncementDraft());
  }
}

function openAnnouncementEditorDraft(draft) {
  openEditorModal({
    context: 'announcement', draft,
    title: draft.isNew ? 'Новый анонс' : 'Редактирование анонса',
    extrasBuilder: announcementsExtrasHTML,
    extrasBinder: bindAnnouncementExtras,
    extrasCollector: collectAnnouncementExtras,
    onSave: async (d) => {
      if (!d.name?.trim()) throw new Error('Введите название');
      const ch = state.channels.find(c => c.id === d.channelId);
      if (!ch) throw new Error('Выберите канал');
      const item = {
        id: d.id, name: d.name, channelId: d.channelId, channelName: ch.name,
        icon: d.icon || DEFAULT_ICON,
        enabled: d.enabled, config: d.config, schedule: d.schedule, autoDelete: d.autoDelete,
        eventTime: d.eventTime, mention: d.mention,
        lastSentAt: d.lastSentAt, lastMessageId: d.lastMessageId, messageDeleted: !!d.messageDeleted,
        nextRunAt: d.nextRunAt, _autoDeleteAt: d._autoDeleteAt
      };
      if (d.isNew) state.announcements.push(item);
      else {
        const idx = state.announcements.findIndex(a => a.id === d.id);
        if (idx >= 0) state.announcements[idx] = item;
      }
      await api.setData(state.guildId, 'announcements', { items: state.announcements });
      updateBotStatus();
      renderAnnouncementsList();
      toast('Анонс сохранён');
    }
  });
}

async function sendAnnouncementNow(id) {
  const a = state.announcements.find(x => x.id === id);
  if (!a) return;
  const ch = findChannel(a.channelId);
  if (!ch) return toast('Канал не найден', { type: 'error' });
  openSendModal({
    title: 'Отправка анонса', channel: ch,
    onConfirm: async (clear) => {
      try {
        const r = await api.sendAutopost(state.guildId, id, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        a.lastSentAt = new Date().toISOString();
        a.lastMessageId = r.messageId;
        a.messageDeleted = false;
        renderAnnouncementsList();
      } catch (e) { toast(e.message, { type: 'error' }); }
    }
  });
}

function exportAnnouncement(id) {
  const a = state.announcements.find(x => x.id === id);
  if (!a) return;
  downloadJSON({
    name: a.name, channelId: a.channelId, channelName: a.channelName,
    icon: a.icon, config: a.config, schedule: a.schedule,
    autoDelete: a.autoDelete, eventTime: a.eventTime, mention: a.mention
  }, `${sanitize(a.name || 'announcement')}.json`);
  toast('Анонс экспортирован');
}

async function copyAnnouncement(id) {
  const original = state.announcements.find(x => x.id === id);
  if (!original) return;
  const copy = {
    ...structuredClone(original),
    id: 'ann_' + uid(),
    name: (original.name || 'Без названия') + ' (копия)',
    enabled: false,
    lastSentAt: null, lastMessageId: null, messageDeleted: false,
    nextRunAt: null, _autoDeleteAt: null
  };
  state.announcements.push(copy);
  try {
    await api.setData(state.guildId, 'announcements', { items: state.announcements });
    updateBotStatus();
    renderAnnouncementsList();
    toast('Анонс скопирован');
  } catch (e) {
    state.announcements = state.announcements.filter(x => x.id !== copy.id);
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function deleteAnnouncement(id) {
  const a = state.announcements.find(x => x.id === id);
  const ok = await confirmDialog({ title: 'Удаление анонса', text: `Удалить «${a?.name || 'Без названия'}»?`, actionText: 'Удалить' });
  if (!ok) return;
  try {
    state.announcements = state.announcements.filter(x => x.id !== id);
    await api.setData(state.guildId, 'announcements', { items: state.announcements });
    updateBotStatus();
    renderAnnouncementsList();
    toast('Анонс удалён');
  } catch (e) { toast('Ошибка: ' + e.message, { type: 'error' }); }
}

async function deleteAnnouncementDiscord(id) {
  const a = state.announcements.find(x => x.id === id);
  if (!a) return;
  if (!a.lastMessageId) return toast('Анонс не отправлялся в Discord', { type: 'error' });

  const ok = await confirmDialog({
    title: 'Удаление в Discord',
    text: `Удалить опубликованный анонс «${a.name || 'Без названия'}» из канала Discord?`,
    actionText: 'Удалить в Discord'
  });
  if (!ok) return;

  try {
    await api.deleteDiscordMessage(state.guildId, 'announcements', id);
    a.lastMessageId = null;
    a.messageDeleted = true;
    renderAnnouncementsList();
    toast('Анонс удалён в Discord');
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}