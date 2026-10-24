import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, pickJSONFile, formatDateTime, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';
import {
  findChannel, renderMessageCard, actionsDropdown, actionsDivider, sendButton,
  bindActionsDropdown, ICONS, actionButton
} from '../card-templates.js';
import { openSendModal, openEditorModal } from './rules.js';
import { channelPickerHTML } from '../pickers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const MESSAGE_ICON = '<i class="fa-solid fa-file-lines"></i>';

let messagesToolbar = null;

function makeNewMessageDraft() {
  return {
    id: 'msg_' + uid(), name: '', channelId: '',
    config: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
    lastSentAt: null, isNew: true
  };
}

function messagesExtrasHTML(context) {
  return {
    top: `
      <div class="form-group"><label>Название сообщения</label><input class="input" data-msg-name placeholder="Например: Приветствие"></div>
      <div class="form-group"><label>Канал отправки</label>${channelPickerHTML({ id: context + '_channel' })}</div>
    `,
    tabs: ''
  };
}

function getMessageStatus(m) {
  if (!m.lastSentAt) return { text: 'Ожидает отправки', cls: 'scheduled' };
  if (m.messageDeleted) return { text: 'Сообщение удалено', cls: 'deleted' };
  return { text: `Отправлено: ${formatDateTime(m.lastSentAt)}`, cls: 'sent' };
}

/* ============================================================
   Список
   ============================================================ */
export function renderMessagesList() {
  const container = document.getElementById('messagesList');
  if (!container) return;

  /* Пустой список → убрать тулбар и показать заглушку */
  if (!state.messages.length) {
    if (messagesToolbar) { messagesToolbar.destroy(); messagesToolbar = null; }
    container.innerHTML = emptyState(
      '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      'Пока нет сообщений',
      'Нажмите «Создать сообщение»'
    );
    return;
  }

  /* Тулбар уже создан и в DOM → просто обновляем */
  if (messagesToolbar && messagesToolbar.el.isConnected) {
    messagesToolbar.refresh();
    return;
  }

  messagesToolbar = createListToolbar({
    listEl: container,
    getAllItems: () => state.messages,
    renderList: (items) => {
      if (!items.length) { container.innerHTML = noResultsHTML(); return; }
      container.innerHTML = items.map(m => {
        const status = getMessageStatus(m);
        const metaLeft = `<span class="list-meta-item">${escapeHtml(status.text)}</span>`;
        const metaRight = sendButton(m.id, 'data-msg-action');
        const actions = `
          ${actionButton('edit', ICONS.edit, 'Редактировать', 'data-msg-action', m.id)}
          ${actionButton('delete', ICONS.delete, 'Удалить', 'data-msg-action', m.id, true)}
          ${actionsDivider()}
          ${actionsDropdown(m.id, 'data-msg-action', [
            { action: 'delete-discord', icon: ICONS.delete, label: 'Удалить в Discord', danger: true, disabled: !m.lastMessageId },
            { action: 'copy', icon: ICONS.copy, label: 'Копировать' },
            { action: 'export', icon: ICONS.export, label: 'Экспортировать' }
          ])}
        `;
        return renderMessageCard({
          item: m, icon: MESSAGE_ICON,
          title: m.name || 'Без названия',
          actions, metaLeft, metaRight,
          statusClass: status.cls,
          selectable: true
        });
      }).join('');
      bindMessageActions(container);
      bindActionsDropdown(container);
    },
    searchPlaceholder: 'Поиск по названию сообщения…',
    searchKeyFn: (m) => m.name || '',
    actions: [
      { id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteMessages }
    ]
  });
  messagesToolbar.refresh();
}

/* ============================================================
   Массовые действия
   ============================================================ */
async function bulkDeleteMessages(ids) {
  const ok = await confirmDialog({
    title: 'Удаление сообщений',
    text: `Удалить ${ids.length} ${pluralize(ids.length, ['сообщение', 'сообщения', 'сообщений'])}?`,
    actionText: 'Удалить'
  });
  if (!ok) return;
  try {
    state.messages = state.messages.filter(m => !ids.includes(m.id));
    await api.setData(state.guildId, 'messages', { items: state.messages });
    renderMessagesList();
    toast(`Удалено: ${ids.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Индивидуальные действия
   ============================================================ */
function bindMessageActions(container) {
  container.querySelectorAll('[data-msg-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.dataset.msgAction;
      const id = btn.dataset.id;
      if (action === 'edit') return openMessageEditor(id);
      if (action === 'send') return sendMessageNow(id);
      if (action === 'export') return exportMessage(id);
      if (action === 'copy') return copyMessage(id);
      if (action === 'delete') return deleteMessage(id);
      if (action === 'delete-discord') return deleteDiscordMessage(id);
    });
  });
}

export async function createMessageFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Новое сообщение',
    onCreate: () => openMessageEditor(null),
    onImport: () => importMessageFlow()
  });
}

async function importMessageFlow() {
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран или повреждён', { type: 'error' });
  try {
    const draft = {
      id: 'msg_' + uid(),
      name: data.name || 'Импортированное сообщение',
      channelId: data.channelId || '',
      channelName: data.channelName || '',
      config: data.config || { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
      lastSentAt: null, lastMessageId: null, messageDeleted: false, isNew: true
    };
    openMessageEditorDraft(draft);
  } catch (e) { toast('Ошибка импорта: ' + e.message, { type: 'error' }); }
}

export function openMessageEditor(id) {
  const existing = id ? state.messages.find(m => m.id === id) : null;
  if (existing) openMessageEditorDraft({ ...existing, config: { ...existing.config }, isNew: false });
  else openMessageEditorDraft(makeNewMessageDraft());
}

function openMessageEditorDraft(draft) {
  openEditorModal({
    context: 'message', draft,
    title: draft.isNew ? 'Новое сообщение' : 'Редактирование сообщения',
    extrasBuilder: messagesExtrasHTML,
    onSave: async (d) => {
      const ch = state.channels.find(c => c.id === d.channelId);
      if (!ch) throw new Error('Выберите канал');
      if (!d.name?.trim()) throw new Error('Введите название');
      const item = {
        id: d.id, name: d.name, channelId: d.channelId, channelName: ch.name,
        config: d.config,
        lastSentAt: d.lastSentAt || null,
        lastMessageId: d.lastMessageId || null,
        messageDeleted: !!d.messageDeleted
      };
      if (d.isNew) state.messages.push(item);
      else {
        const idx = state.messages.findIndex(m => m.id === d.id);
        if (idx >= 0) state.messages[idx] = { ...state.messages[idx], ...item };
      }
      await api.setData(state.guildId, 'messages', { items: state.messages });
      renderMessagesList();
      toast('Сообщение сохранено');
    }
  });
}

async function sendMessageNow(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  const ch = findChannel(m.channelId);
  if (!ch) return toast('Канал не найден', { type: 'error' });
  openSendModal({
    title: 'Отправка сообщения', channel: ch,
    onConfirm: async (clear) => {
      try {
        const r = await api.sendMessage(state.guildId, id, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        m.lastSentAt = new Date().toISOString();
        m.lastMessageId = r.messageId;
        m.messageDeleted = false;
        renderMessagesList();
      } catch (e) { toast(e.message, { type: 'error' }); }
    }
  });
}

function exportMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  downloadJSON({
    name: m.name, channelId: m.channelId, channelName: m.channelName, config: m.config
  }, `${sanitize(m.name || 'message')}.json`);
  toast('Сообщение экспортировано');
}

async function copyMessage(id) {
  const original = state.messages.find(x => x.id === id);
  if (!original) return;
  const copy = {
    ...structuredClone(original),
    id: 'msg_' + uid(),
    name: (original.name || 'Без названия') + ' (копия)',
    lastSentAt: null, lastMessageId: null, messageDeleted: false
  };
  state.messages.push(copy);
  try {
    await api.setData(state.guildId, 'messages', { items: state.messages });
    renderMessagesList();
    toast('Сообщение скопировано');
  } catch (e) {
    state.messages = state.messages.filter(x => x.id !== copy.id);
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function deleteMessage(id) {
  const m = state.messages.find(x => x.id === id);
  const ok = await confirmDialog({ title: 'Удаление сообщения', text: `Удалить «${m?.name || 'Без названия'}»?`, actionText: 'Удалить' });
  if (!ok) return;
  try {
    state.messages = state.messages.filter(x => x.id !== id);
    await api.setData(state.guildId, 'messages', { items: state.messages });
    renderMessagesList();
    toast('Сообщение удалено');
  } catch (e) { toast('Ошибка: ' + e.message, { type: 'error' }); }
}

async function deleteDiscordMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  if (!m.lastMessageId) return toast('Сообщение не отправлено в Discord', { type: 'error' });

  const ok = await confirmDialog({
    title: 'Удаление в Discord',
    text: `Удалить опубликованное сообщение «${m.name || 'Без названия'}» из канала Discord?`,
    actionText: 'Удалить в Discord'
  });
  if (!ok) return;

  try {
    await api.deleteDiscordMessage(state.guildId, 'messages', id);
    m.lastMessageId = null;
    m.messageDeleted = true;
    renderMessagesList();
    toast('Сообщение удалено в Discord');
  } catch (e) { toast(e.message, { type: 'error' }); }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}