/* ============================================================
   Отложенные: отправка сообщения в конкретный момент времени.
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
import {
  makeNewDelayedDraft, delayedExtrasHTML, bindDelayedExtras, collectDelayedExtras
} from '../extras.js';
import { updateBotStatus } from './helpers.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const DELAYED_ICON = '<i class="fa-solid fa-clock"></i>';
let delayedToolbar = null;

const SECTION_INTRO = `
  <div class="section-intro">
    <h2><i class="fa-solid fa-clock"></i> Отложенные</h2>
    <p>Отправка сообщения в конкретный момент времени — розыгрыш в 20:00, поздравление к празднику, релиз в определённое время.</p>
    <ul>
      <li>Укажите дату и время — бот отправит один раз в этот момент</li>
      <li>Можно упомянуть роль или пользователя</li>
      <li>Опционально — автоудаление после отправки</li>
    </ul>
  </div>
`;

function getSendStatusText(item) {
  return item.lastSentAt ? `Отправлено: ${formatDateTime(item.lastSentAt)}` : 'Ожидает отправки';
}

function getStatusClass(item) {
  if (item.lastSentAt) return 'sent';
  if (item.publishAt) return 'scheduled';
  return '';
}

/* ============================================================
   Рендер
   ============================================================ */

export function renderDelayedList() {
  const container = document.getElementById('delayedList');
  if (!container) return;

  const parent = container.parentNode;
  if (!parent.querySelector('.section-intro')) {
    parent.insertAdjacentHTML('afterbegin', SECTION_INTRO);
  }

  if (!state.delayed.length) {
    if (delayedToolbar) { delayedToolbar.destroy(); delayedToolbar = null; }
    container.innerHTML = emptyState({
      icon: 'fa-clock',
      title: 'Пока нет отложек',
      text: 'Создайте отложенный пост, указав точную дату и время. Бот отправит его автоматически.',
      ctaLabel: 'Создать отложку',
      ctaAction: 'create-del'
    });
    container.querySelector('[data-create-del]')?.addEventListener('click', createDelayedFlow);
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
            { action: 'delete-discord', icon: ICONS.delete, label: 'Удалить из Discord', danger: true, disabled: !d.lastMessageId },
            { action: 'copy', icon: ICONS.copy, label: 'Копировать' },
            { action: 'export', icon: ICONS.export, label: 'Экспортировать' }
          ])}
        `;

        return renderMessageCard({
          item: d, icon: DELAYED_ICON, title: d.name || 'Без названия',
          actions, metaLeft, metaRight, statusClass, selectable: true
        });
      }).join('');
      bindDelayedActions(container);
      bindActionsDropdown(container);
    },
    searchPlaceholder: 'Поиск по названию…',
    searchKeyFn: (d) => d.name || '',
    filters: [{ id: 'pending', label: 'Ожидают', fn: d => !d.lastSentAt && d.publishAt }],
    actions: [{ id: 'delete', label: 'Удалить', danger: true, handler: bulkDelete }]
  });
  delayedToolbar.refresh();
}

/* ============================================================
   Bulk
   ============================================================ */

async function bulkDelete(ids) {
  const ok = await confirmDialog({
    title: 'Удаление',
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

/* ============================================================
   Действия
   ============================================================ */

function bindDelayedActions(container) {
  container.querySelectorAll('[data-del-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { delAction: action, id } = btn.dataset;
      if (action === 'edit') return openDelayedEditor(id);
      if (action === 'send') return sendDelayedNow(id);
      if (action === 'export') return exportDelayed(id);
      if (action === 'copy') return copyDelayed(id);
      if (action === 'delete') return deleteDelayed(id);
      if (action === 'delete-discord') return deleteDelayedDiscord(id);
    });
  });
}

/* ============================================================
   Создание
   ============================================================ */

export async function createDelayedFlow() {
  const { openCreateChoice } = await import('./create-choice.js');
  openCreateChoice({
    title: 'Создать отложку',
    onCreate: () => openDelayedEditor(null),
    onImport: (data) => importDelayedFlow(data),
    validateSection: 'delayed'
  });
}

function importDelayedFlow(data) {
  try {
    const draft = {
      ...makeNewDelayedDraft(),
      name: data.name || 'Импортированное',
      channelId: data.channelId || '',
      config: data.config || { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
      publishAt: data.publishAt || null,
      mention: data.mention || { type: 'none', roleId: '', userId: '' },
      autoDelete: data.autoDelete || { enabled: false, minutes: 60 }
    };
    openDelayedEditorDraft(draft);
  } catch (e) {
    toast('Ошибка импорта: ' + e.message, { type: 'error' });
  }
}

export function openDelayedEditor(id) {
  const existing = id ? state.delayed.find(d => d.id === id) : null;
  if (existing) {
    openDelayedEditorDraft({ ...existing, config: { ...existing.config }, isNew: false });
  } else {
    openDelayedEditorDraft(makeNewDelayedDraft());
  }
}

function openDelayedEditorDraft(draft) {
  openEditorModal({
    context: 'announcement', draft,
    title: draft.isNew ? 'Создать отложку' : 'Редактирование',
    extrasBuilder: delayedExtrasHTML,
    extrasBinder: bindDelayedExtras,
    extrasCollector: collectDelayedExtras,
    onSave: async (d) => {
      if (!d.name?.trim()) throw new Error('Укажите название');
      const ch = state.channels.find(c => c.id === d.channelId);
      if (!ch) throw new Error('Выберите канал');

      const existing = state.delayed.find(x => x.id === d.id);
      const publishChanged = existing && (existing.publishAt || null) !== (d.publishAt || null);

      const item = {
        id: d.id, name: d.name, channelId: d.channelId, channelName: ch.name,
        config: d.config, mention: d.mention, autoDelete: d.autoDelete,
        publishAt: d.publishAt || null,
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
      toast('Сохранено');
    }
  });
}

/* ============================================================
   Отправка
   ============================================================ */

async function sendDelayedNow(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d) return;
  const ch = findChannel(d.channelId);
  if (!ch) return toast('Канал не найден', { type: 'error' });

  openSendModal({
    title: 'Отправка отложки',
    channel: ch,
    onConfirm: async (clear) => {
      try {
        const r = await api.sendDelayed(state.guildId, id, clear);
        toast(`Отправлено${clear && r.cleared ? ` · очищено ${r.cleared}` : ''}`);
        d.lastSentAt = new Date().toISOString();
        d.lastMessageId = r.messageId;
        d.messageDeleted = false;
        d._autoDeleteAt = null;
        updateBotStatus();
        renderDelayedList();
      } catch (e) {
        toast(e.message, { type: 'error' });
      }
    }
  });
}

/* ============================================================
   Экспорт / копирование
   ============================================================ */

function exportDelayed(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d) return;
  downloadJSON({
    name: d.name, channelId: d.channelId, channelName: d.channelName,
    config: d.config, publishAt: d.publishAt, mention: d.mention, autoDelete: d.autoDelete
  }, `${sanitize(d.name || 'delayed')}.json`);
  toast('Экспортировано');
}

async function copyDelayed(id) {
  const orig = state.delayed.find(x => x.id === id);
  if (!orig) return;

  const copy = {
    ...structuredClone(orig),
    id: 'del_' + uid(),
    name: (orig.name || 'Без названия') + ' (копия)',
    lastSentAt: null, lastMessageId: null, messageDeleted: false,
    _autoDeleteAt: null, _failed: false
  };

  state.delayed.push(copy);
  try {
    await api.setData(state.guildId, 'delayed', { items: state.delayed });
    updateBotStatus();
    renderDelayedList();
    toast('Скопировано');
  } catch (e) {
    state.delayed = state.delayed.filter(x => x.id !== copy.id);
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Удаление
   ============================================================ */

async function deleteDelayed(id) {
  const d = state.delayed.find(x => x.id === id);
  const ok = await confirmDialog({
    title: 'Удаление',
    text: `Удалить «${d?.name || 'Без названия'}»?`,
    actionText: 'Удалить'
  });
  if (!ok) return;

  if (d?.lastMessageId && !d.messageDeleted) {
    try { await api.deleteDiscordMessage(state.guildId, 'delayed', id); } catch {}
  }

  try {
    state.delayed = state.delayed.filter(x => x.id !== id);
    await api.setData(state.guildId, 'delayed', { items: state.delayed });
    updateBotStatus();
    renderDelayedList();
    toast('Удалено');
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function deleteDelayedDiscord(id) {
  const d = state.delayed.find(x => x.id === id);
  if (!d?.lastMessageId) return toast('Не отправлено', { type: 'error' });

  const ok = await confirmDialog({
    title: 'Удалить из Discord',
    text: `Удалить «${d.name || 'Без названия'}»?`,
    actionText: 'Удалить'
  });
  if (!ok) return;

  try {
    await api.deleteDiscordMessage(state.guildId, 'delayed', id);
    d.lastMessageId = null;
    d.messageDeleted = true;
    d._autoDeleteAt = null;
    renderDelayedList();
    toast('Удалено из Discord');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 60) || 'export';
}