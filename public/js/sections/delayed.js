import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, pickJSONFile, formatDateTime, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';
import {
  findChannel, renderMessageCard, actionsDropdown, actionsDivider, sendButton,
  bindActionsDropdown, ICONS, actionButton
} from '../card-templates.js';
import { openSendModal, openEditorModal } from './rules.js';
import { makeNewDelayedDraft, delayedExtrasHTML, bindDelayedExtras, collectDelayedExtras } from '../extras.js';
import { updateBotStatus } from './helpers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const DELAYED_ICON = '<i class="fa-solid fa-clock"></i>';
let delayedToolbar = null;

function getSendStatusText(item) {
  return item.lastSentAt ? `Отправлено: ${formatDateTime(item.lastSentAt)}` : 'Ожидает отправки';
}
function getStatusClass(item) {
  if (item.lastSentAt) return 'sent';
  if (item.publishAt) return 'scheduled';
  return '';
}

export function renderDelayedList() {
  const container = document.getElementById('delayedList');
  if (!container) return;

  if (!state.delayed.length) {
    if (delayedToolbar) { delayedToolbar.destroy(); delayedToolbar = null; }
    container.innerHTML = emptyState(
      '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      'Пока нет отложенных', 'Нажмите «Создать отложенный пост»'
    );
    return;
  }

  if (delayedToolbar && delayedToolbar.el.isConnected) {
    delayedToolbar.refresh();
    return;
  }

  delayedToolbar = createListToolbar({
    listEl: container,
    getAllItems: () => state.delayed,
    renderList: (items) => {
      if (!items.length) { container.innerHTML = noResultsHTML(); return; }
      container.innerHTML = items.map(d => {
        const publishText = d.publishAt ? formatDateTime(d.publishAt) : 'Не задано';
        const statusText = getSendStatusText(d);
        const statusClass = getStatusClass(d);
        const metaLeft = `
          <span class="list-meta-item">${ICONS.calendar}${escapeHtml(publishText)}</span>
          <span class="info-sep">·</span>
          <span class="list-meta-item">${escapeHtml(statusText)}</span>
        `;
        const metaRight = sendButton(d.id, 'data-del-action');
        const actions = `
          ${actionButton('edit', ICONS.edit, 'Редактировать', 'data-del-action', d.id)}
          ${actionButton('delete', ICONS.delete, 'Удалить', 'data-del-action', d.id, true)}
          ${actionsDivider()}
          ${actionsDropdown(d.id, 'data-del-action', [
            { action: 'delete-discord', icon: ICONS.delete, label: 'Удалить в Discord', danger: true, disabled: !d.lastMessageId },
            { action: 'copy', icon: ICONS.copy, label: 'Копировать' },
            { action: 'export', icon: ICONS.export, label: 'Экспортировать' }
          ])}
        `;
        return renderMessageCard({
          item: d, icon: DELAYED_ICON,
          title: d.name || 'Без названия',
          actions, metaLeft, metaRight, statusClass,
          selectable: true
        });
      }).join('');
      bindDelayedActions(container);
      bindActionsDropdown(container);
    },
    searchPlaceholder: 'Поиск по названию…',
    searchKeyFn: (d) => d.name || '',
    filters: [
      { id: 'pending', label: 'Ожидают отправки', fn: d => !d.lastSentAt && d.publishAt }
    ],
    actions: [
      { id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteDelayed }
    ]
  });
  delayedToolbar.refresh();
}

async function bulkDeleteDelayed(ids) {
  const ok = await confirmDialog({
    title: 'Удаление отложенных',
    text: `Удалить ${ids.length} ${pluralize(ids.length, ['пост', 'поста', 'постов'])}?`,
    actionText: 'Удалить'
  });
  if (!ok) return;
  try {
    state.delayed = state.delayed.filter(d => !ids.includes(d.id));
    await api.setData(state.guildId, 'delayed', { items: state.delayed });
    updateBotStatus();
    renderDelayedList();
    toast(`Удалено: ${ids.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

function bindDelayedActions(container) {
  container.querySelectorAll('[data-del-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.delAction;
      const id = btn.dataset.id;
      if (action === 'edit') return openDelayedEditor(id);
      if (action === 'send') return sendDelayedNow(id);
      if (action === 'export') return exportDelayed(id);
      if (action === 'copy') return copyDelayed(id);
      if (action === 'delete') return deleteDelayed(id);
      if (action === 'delete-discord') return deleteDelayedDiscord(id);
    });
  });
}

export async function createDelayedFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Новый отложенный пост',
    onCreate: () => openDelayedEditor(null),
    onImport: () => importDelayedFlow()
  });
}

async function importDelayedFlow() {
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран или повреждён', { type: 'error' });
  try {
    const draft = {
      ...makeNewDelayedDraft(),
      name: data.name || 'Импортированный пост',
      channelId: data.channelId || '',
      config: data.config || { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
      publishAt: data.publishAt || null,
      mention: data.mention || { type: 'none', roleId: '', userId: '' },
      autoDelete: data.autoDelete || { enabled: false, minutes: 60 }
    };
    openDelayedEditorDraft(draft);
  } catch (e) { toast('Ошибка импорта: ' + e.message, { type: 'error' }); }
}

export function openDelayedEditor(id) {
  const existing = id ? state.delayed.find(d => d.id === id) : null;
  if (existing) openDelayedEditorDraft({ ...existing, config: { ...existing.config }, isNew: false });
  else openDelayedEditorDraft(makeNewDelayedDraft());
}

function openDelayedEditorDraft(draft) {
  openEditorModal({
    context: 'announcement', draft,
    title: draft.isNew ? 'Новый отложенный пост' : 'Редактирование отложенного',
    extrasBuilder: delayedExtrasHTML,
    extrasBinder: bindDelayedExtras,
    extrasCollector: collectDelayedExtras,
    onSave: async (d) => {
      if (!d.name?.trim()) throw new Error('Введите название');
      const ch = state.channels.find(c => c.id === d.channelId);
      if (!ch) throw new Error('Выберите канал');

      const existingItem = state.delayed.find(x => x.id === d.id);
      const oldPublish = existingItem?.publishAt || null;
      const newPublish = d.publishAt || null;
      const publishChanged = !!existingItem && oldPublish !== newPublish;

      const item = {
        id: d.id, name: d.name, channelId: d.channelId, channelName: ch.name,
        config: d.config, mention: d.mention, autoDelete: d.autoDelete,
        publishAt: newPublish,
        lastSentAt: publishChanged ? null : (d.lastSentAt || null),
        lastMessageId: publishChanged ? null : (d.lastMessageId || null),
        messageDeleted: publishChanged ? false : !!d.messageDeleted,
        _autoDeleteAt: publishChanged ? null : (d._autoDeleteAt || null)
      };

      if (d.isNew) state.delayed.push(item);
      else {
        const idx = state.delayed.findIndex(x => x.id === d.id);
        if (idx >= 0) state.delayed[idx] = item;
      }
      await api.setData(state.guildId, 'delayed', { items: state.delayed });
      updateBotStatus();
      renderDelayedList();
      toast('Отложенный сохранён');
    }
  });
}

async function sendDelayedNow(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d) return;
  const ch = findChannel(d.channelId);
  if (!ch) return toast('Канал не найден', { type: 'error' });
  openSendModal({
    title: 'Отправка отложенного', channel: ch,
    onConfirm: async (clear) => {
      try {
        const r = await api.sendDelayed(state.guildId, id, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        d.lastSentAt = new Date().toISOString();
        d.lastMessageId = r.messageId;
        d.messageDeleted = false;
        updateBotStatus();
        renderDelayedList();
      } catch (e) { toast(e.message, { type: 'error' }); }
    }
  });
}

function exportDelayed(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d) return;
  downloadJSON({
    name: d.name, channelId: d.channelId, channelName: d.channelName,
    config: d.config, publishAt: d.publishAt, mention: d.mention, autoDelete: d.autoDelete
  }, `${sanitize(d.name || 'delayed')}.json`);
  toast('Отложенный экспортирован');
}

async function copyDelayed(id) {
  const original = state.delayed.find(x => x.id === id);
  if (!original) return;
  const copy = {
    ...structuredClone(original),
    id: 'del_' + uid(),
    name: (original.name || 'Без названия') + ' (копия)',
    lastSentAt: null, lastMessageId: null, messageDeleted: false,
    _autoDeleteAt: null, _failed: false
  };
  state.delayed.push(copy);
  try {
    await api.setData(state.guildId, 'delayed', { items: state.delayed });
    updateBotStatus();
    renderDelayedList();
    toast('Отложенный скопирован');
  } catch (e) {
    state.delayed = state.delayed.filter(x => x.id !== copy.id);
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function deleteDelayed(id) {
  const d = state.delayed.find(x => x.id === id);
  const ok = await confirmDialog({ title: 'Удаление отложенного', text: `Удалить «${d?.name || ''}»?`, actionText: 'Удалить' });
  if (!ok) return;
  try {
    state.delayed = state.delayed.filter(x => x.id !== id);
    await api.setData(state.guildId, 'delayed', { items: state.delayed });
    updateBotStatus();
    renderDelayedList();
    toast('Удалено');
  } catch (e) { toast('Ошибка: ' + e.message, { type: 'error' }); }
}

async function deleteDelayedDiscord(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d) return;
  if (!d.lastMessageId) return toast('Сообщение не отправлено в Discord', { type: 'error' });
  const ok = await confirmDialog({
    title: 'Удаление в Discord',
    text: `Удалить опубликованное сообщение «${d.name || 'Без названия'}» из канала Discord?`,
    actionText: 'Удалить в Discord'
  });
  if (!ok) return;
  try {
    await api.deleteDiscordMessage(state.guildId, 'delayed', id);
    d.lastMessageId = null;
    d.messageDeleted = true;
    renderDelayedList();
    toast('Сообщение удалено в Discord');
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}