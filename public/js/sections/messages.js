/* ============================================================
   Сообщения: закреплённые сообщения для каналов.
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, uid, downloadJSON, formatDateTime, pluralize } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';
import {
  findChannel, renderMessageCard, actionsDropdown, actionsDivider,
  sendButton, bindActionsDropdown, ICONS, actionButton
} from '../card-templates.js';
import { openSendModal, openEditorModal } from './rules.js';
import { channelPickerHTML } from '../pickers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const MESSAGE_ICON = '<i class="fa-solid fa-comment-dots"></i>';
let messagesToolbar = null;

const SECTION_INTRO = `
  <div class="section-intro">
    <h2><i class="fa-solid fa-comment-dots"></i> Сообщения</h2>
    <p>Закреплённые сообщения — приветствие, навигация по каналам, важные ссылки. Отправляются вручную одной кнопкой и могут быть обновлены без потери истории.</p>
    <ul>
      <li>Создайте шаблон с текстом, кнопками-ссылками и медиа</li>
      <li>Отправьте в нужный канал — появится кнопка «Отправить» в карточке</li>
      <li>Обновляйте шаблон и отправляйте заново — старое сообщение можно удалить</li>
    </ul>
  </div>
`;

/* ============================================================
   Черновики
   ============================================================ */

function makeNewMessageDraft() {
  return {
    id: 'msg_' + uid(),
    name: '',
    channelId: '',
    config: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
    lastSentAt: null,
    isNew: true
  };
}

function messagesExtrasHTML(context) {
  return {
    top: `
      <div class="form-group">
        <label>Название сообщения</label>
        <input class="input" data-msg-name placeholder="Например: Приветствие">
      </div>
      <div class="form-group">
        <label>Канал отправки</label>
        ${channelPickerHTML({ id: context + '_channel' })}
      </div>
    `,
    tabs: ''
  };
}

function getMessageStatus(m) {
  if (!m.lastSentAt) return { text: 'Ещё не отправлено', cls: 'scheduled' };
  if (m.messageDeleted) return { text: 'Удалено из Discord', cls: 'deleted' };
  return { text: `Отправлено: ${formatDateTime(m.lastSentAt)}`, cls: 'sent' };
}

/* ============================================================
   Рендер
   ============================================================ */

export function renderMessagesList() {
  const container = document.getElementById('messagesList');
  if (!container) return;

  /* Section-intro один раз */
  const parent = container.parentNode;
  if (!parent.querySelector('.section-intro')) {
    parent.insertAdjacentHTML('afterbegin', SECTION_INTRO);
  }

  if (!state.messages.length) {
    if (messagesToolbar) { messagesToolbar.destroy(); messagesToolbar = null; }
    container.innerHTML = emptyState({
      icon: 'fa-comment-dots',
      title: 'Пока нет сообщений',
      text: 'Создайте первое сообщение — например, приветствие с кнопками навигации. Шаблон можно отправить в любой канал.',
      ctaLabel: 'Создать сообщение',
      ctaAction: 'create-msg',
      exampleLabel: 'Загрузить пример',
      exampleAction: 'example-msg'
    });
    bindEmptyActions(container);
    return;
  }

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
            { action: 'delete-discord', icon: ICONS.delete, label: 'Удалить из Discord', danger: true, disabled: !m.lastMessageId },
            { action: 'copy', icon: ICONS.copy, label: 'Копировать' },
            { action: 'export', icon: ICONS.export, label: 'Экспортировать' }
          ])}
        `;
        return renderMessageCard({
          item: m, icon: MESSAGE_ICON, title: m.name || 'Без названия',
          actions, metaLeft, metaRight, statusClass: status.cls, selectable: true
        });
      }).join('');
      bindMessageActions(container);
      bindActionsDropdown(container);
    },
    searchPlaceholder: 'Поиск по названию…',
    searchKeyFn: (m) => m.name || '',
    actions: [{ id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteMessages }]
  });
  messagesToolbar.refresh();
}

function bindEmptyActions(container) {
  container.querySelector('[data-create-msg]')?.addEventListener('click', createMessageFlow);
  container.querySelector('[data-example-msg]')?.addEventListener('click', () => {
    const draft = makeNewMessageDraft();
    draft.name = 'Приветствие';
    draft.config.title = '👋 Добро пожаловать!';
    draft.config.blocks = [
      { id: 'ex1', type: 'text', content: 'Рады видеть тебя на сервере!' },
      { id: 'ex2', type: 'text', content: 'Читай правила и знакомься с другими участниками.' }
    ];
    openMessageEditorDraft(draft);
  });
}

/* ============================================================
   Bulk
   ============================================================ */

async function bulkDeleteMessages(ids) {
  const ok = await confirmDialog({
    title: 'Удаление',
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
   Действия
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

/* ============================================================
   Создание / редактирование
   ============================================================ */

export async function createMessageFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Создать сообщение',
    onCreate: () => openMessageEditor(null),
    onImport: (data) => importMessageFlow(data),
    validateSection: 'messages'
  });
}

function importMessageFlow(data) {
  try {
    const draft = {
      id: 'msg_' + uid(),
      name: data.name || 'Импортированное',
      channelId: data.channelId || '',
      config: data.config || { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
      lastSentAt: null, lastMessageId: null, messageDeleted: false, isNew: true
    };
    openMessageEditorDraft(draft);
  } catch (e) {
    toast('Ошибка импорта: ' + e.message, { type: 'error' });
  }
}

export function openMessageEditor(id) {
  const existing = id ? state.messages.find(m => m.id === id) : null;
  if (existing) {
    openMessageEditorDraft({ ...existing, config: { ...existing.config }, isNew: false });
  } else {
    openMessageEditorDraft(makeNewMessageDraft());
  }
}

function openMessageEditorDraft(draft) {
  openEditorModal({
    context: 'message', draft,
    title: draft.isNew ? 'Создать сообщение' : 'Редактирование',
    extrasBuilder: messagesExtrasHTML,
    onSave: async (d) => {
      const ch = state.channels.find(c => c.id === d.channelId);
      if (!ch) throw new Error('Выберите канал');
      if (!d.name?.trim()) throw new Error('Укажите название');

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
      toast('Сохранено');
    }
  });
}

/* ============================================================
   Отправка
   ============================================================ */

async function sendMessageNow(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  const ch = findChannel(m.channelId);
  if (!ch) return toast('Канал не найден', { type: 'error' });

  openSendModal({
    title: 'Отправка сообщения',
    channel: ch,
    onConfirm: async (clear) => {
      try {
        const r = await api.sendMessage(state.guildId, id, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        m.lastSentAt = new Date().toISOString();
        m.lastMessageId = r.messageId;
        m.messageDeleted = false;
        m._autoDeleteAt = null;
        renderMessagesList();
      } catch (e) {
        toast(e.message, { type: 'error' });
      }
    }
  });
}

/* ============================================================
   Экспорт / копирование
   ============================================================ */

function exportMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;
  downloadJSON({
    name: m.name, channelId: m.channelId, channelName: m.channelName, config: m.config
  }, `${sanitize(m.name || 'message')}.json`);
  toast('Экспортировано');
}

async function copyMessage(id) {
  const original = state.messages.find(x => x.id === id);
  if (!original) return;

  const copy = {
    ...structuredClone(original),
    id: 'msg_' + uid(),
    name: (original.name || 'Без названия') + ' (копия)',
    lastSentAt: null, lastMessageId: null, messageDeleted: false, _autoDeleteAt: null
  };

  state.messages.push(copy);
  try {
    await api.setData(state.guildId, 'messages', { items: state.messages });
    renderMessagesList();
    toast('Скопировано');
  } catch (e) {
    state.messages = state.messages.filter(x => x.id !== copy.id);
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Удаление
   ============================================================ */

async function deleteMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m) return;

  if (m.lastMessageId && !m.messageDeleted) {
    const ok = await confirmDialog({
      title: 'Удаление',
      text: `«${m.name || 'Без названия'}» уже отправлено. Удалить и из Discord?`,
      actionText: 'Удалить и из Discord'
    });
    if (!ok) return;
    try { await api.deleteDiscordMessage(state.guildId, 'messages', id); }
    catch (e) { toast('Discord: ' + e.message, { type: 'error' }); }
  } else {
    const ok = await confirmDialog({
      title: 'Удаление',
      text: `Удалить «${m.name || 'Без названия'}»?`,
      actionText: 'Удалить'
    });
    if (!ok) return;
  }

  try {
    state.messages = state.messages.filter(x => x.id !== id);
    await api.setData(state.guildId, 'messages', { items: state.messages });
    renderMessagesList();
    toast('Удалено');
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function deleteDiscordMessage(id) {
  const m = state.messages.find(x => x.id === id);
  if (!m?.lastMessageId) return toast('Не отправлено в Discord', { type: 'error' });

  const ok = await confirmDialog({
    title: 'Удалить из Discord',
    text: `Удалить опубликованное «${m.name || 'Без названия'}»?`,
    actionText: 'Удалить'
  });
  if (!ok) return;

  try {
    await api.deleteDiscordMessage(state.guildId, 'messages', id);
    m.lastMessageId = null;
    m.messageDeleted = true;
    m._autoDeleteAt = null;
    renderMessagesList();
    toast('Удалено из Discord');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}