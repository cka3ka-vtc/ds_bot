/* ============================================================
   Дни рождения: список + настройки + шаблон поздравления.
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, pluralize } from '../utils.js';
import { toast, modal, confirmDialog, emptyState } from '../ui.js';
import {
  channelPickerHTML, bindChannelPicker, channelIcon,
  rolePickerHTML, bindRolePicker,
  memberPickerHTML, bindMemberPicker
} from '../pickers.js';
import { Editor } from '../editor.js';
import { ICONS } from '../card-templates.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const DEFAULT_SINGLE = {
  displayMode: 'embed-color', accentColor: '#5865F2',
  title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
  blocks: [{
    id: 'bd-def-s', type: 'text',
    content: 'Поздравляем! 🎂 Тебе исполняется **{age}**!'
  }]
};

const DEFAULT_NOYEAR = {
  displayMode: 'embed-color', accentColor: '#5865F2',
  title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
  blocks: [{
    id: 'bd-def-n', type: 'text',
    content: 'Поздравляем с днём рождения! 🎉 Всего наилучшего в новом году жизни!'
  }]
};

const BIRTHDAYS_PAGE_SIZE = 6;

let editorInstance = null;
let currentTab = 'single';
let birthdaysToolbar = null;
let currentBirthdayPage = 1;
let currentGuildId = null;

/* ============================================================
   Данные
   ============================================================ */

function getData() {
  const fallback = {
    settings: {
      time: '09:00', roleId: '', channelId: '', enabled: false, lastRunDate: null,
      roleRemoveNextDay: true, autoDeleteMessage: false,
      requiredRoleIds: [], _pending: []
    },
    users: [],
    template: DEFAULT_SINGLE,
    templateNoYear: DEFAULT_NOYEAR
  };
  if (!state.birthdays) return structuredClone(fallback);
  return {
    settings: { ...fallback.settings, ...(state.birthdays.settings || {}) },
    users: Array.isArray(state.birthdays.users) ? state.birthdays.users : [],
    template: state.birthdays.template || DEFAULT_SINGLE,
    templateNoYear: state.birthdays.templateNoYear || DEFAULT_NOYEAR
  };
}

function getMember(userId) {
  return state.members.find(m => m.id === userId);
}

/* ============================================================
   Утилиты
   ============================================================ */

function pluralDays(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a > 10 && a < 20) return 'дней';
  if (l === 1) return 'день';
  if (l > 1 && l < 5) return 'дня';
  return 'дней';
}

function pluralYears(n) {
  const a = Math.abs(n) % 100, l = a % 10;
  if (a > 10 && a < 20) return 'лет';
  if (l > 1 && l < 5) return 'года';
  if (l === 1) return 'год';
  return 'лет';
}

function getAge(user, now = new Date()) {
  if (!user.year) return null;
  return now.getFullYear() - user.year;
}

function daysUntilBirthday(day, month) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86400000);
}

function subtitleFor(user) {
  if (!user.day || !user.month) return 'Дата рождения не указана';
  const age = getAge(user);
  const dateStr = `${user.day} ${MONTHS[user.month - 1]}`;
  return age !== null ? `${age} ${pluralYears(age)} · ${dateStr}` : dateStr;
}

function badgeText(days) {
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  return `Через ${days} ${pluralDays(days)}`;
}

function isBirthdayActive(user, settings) {
  if (user.enabled === false) return false;
  if (!settings.enabled) return false;
  if (!settings.channelId) return false;
  if (!settings.roleId) return false;
  return true;
}

/* ============================================================
   Рендер
   ============================================================ */

export function renderBirthdaysView() {
  const root = document.getElementById('view-birthdays');
  if (!root) return;

  if (state.guildId !== currentGuildId) {
    currentBirthdayPage = 1;
    currentGuildId = state.guildId;
  }

  const data = getData();

  root.innerHTML = `
    <div class="birthdays-layout">
      <div class="birthdays-two-col">
        <div class="card">
          <div class="card-header">
            <div><h2>Настройки поздравлений</h2><p>Время, канал и роль</p></div>
          </div>
          <div class="card-body">
            <div class="editor-grid">
              <div class="form-group">
                <label>Время поздравления</label>
                <input type="time" class="input" data-bd-time value="${escapeHtml(data.settings.time || '09:00')}">
                <span class="hint">Опрос раз в час</span>
              </div>
              <div class="form-group">
                <label>Опоздравление</label>
                <label class="ann-status-toggle">
                  <input type="checkbox" data-bd-enabled ${data.settings.enabled ? 'checked' : ''}>
                  <span>Включено</span>
                </label>
              </div>
            </div>
            <div class="form-group">
              <label>Роль именинника</label>
              ${rolePickerHTML({ id: 'bd_role', value: data.settings.roleId || '' })}
              <span class="hint">Выдаётся в день рождения</span>
            </div>
            <div class="form-group">
              <label>Канал для поздравлений</label>
              ${channelPickerHTML({ id: 'bd_channel' })}
            </div>
            <div class="form-group">
              <label>Требуемые роли (проверка)</label>
              <span class="hint" style="display:block;margin-bottom:8px;">Поздравляем только участников с одной из этих ролей. Пусто — без проверки.</span>
              <div class="bd-role-chips" data-bd-role-chips></div>
              ${rolePickerHTML({ id: 'bd_required_role', placeholder: 'Добавить роль...' })}
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <strong>Снимать роль на следующий день</strong>
                <span>Роль будет снята после праздника</span>
              </div>
              <button type="button" class="switch ${data.settings.roleRemoveNextDay !== false ? 'on' : ''}" data-bd-role-remove></button>
            </div>
            <div class="toggle-row">
              <div class="toggle-info">
                <strong>Удалять сообщение на следующий день</strong>
                <span>Сообщение-поздравление удалится</span>
              </div>
              <button type="button" class="switch ${data.settings.autoDeleteMessage ? 'on' : ''}" data-bd-delete-msg></button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div><h2>Список дней рождения</h2><p>Все пользователи с ДР</p></div>
            <button type="button" class="btn btn-sm btn-bd-add" data-bd-add>
              <i class="fa-solid fa-plus"></i>
              <span>Добавить</span>
            </button>
          </div>
          <div class="card-body">
            <div class="birthday-list" data-bd-list></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div><h2>Шаблон поздравления</h2><p>Используйте плейсхолдеры для персонализации</p></div>
        </div>
        <div class="card-body">
          <div class="bd-template-hint">
            <code>{user}</code> — упоминание
            <code>{age}</code> — возраст (только для года)
          </div>
          <div class="bd-template-tabs">
            <button type="button" data-tpl-tab="single" class="${currentTab === 'single' ? 'active' : ''}">С годом</button>
            <button type="button" data-tpl-tab="noYear" class="${currentTab === 'noYear' ? 'active' : ''}">Без года</button>
          </div>
          <div class="rules-layout" data-bd-editor></div>
        </div>
      </div>
    </div>
  `;

  /* ---- Настройки ---- */
  const timeInput = root.querySelector('[data-bd-time]');
  timeInput.addEventListener('input', () => { data.settings.time = timeInput.value; });

  const enabledCheck = root.querySelector('[data-bd-enabled]');
  enabledCheck.addEventListener('change', () => { data.settings.enabled = enabledCheck.checked; });

  bindRolePicker(root, { id: 'bd_role', onSelect: (role) => { data.settings.roleId = role?.id || ''; } });
  bindChannelPicker(root, { id: 'bd_channel', onSelect: (ch) => { data.settings.channelId = ch?.id || ''; } });

  if (data.settings.channelId) {
    const ch = state.channels.find(c => c.id === data.settings.channelId);
    if (ch) {
      const hidden = root.querySelector('[data-hidden="bd_channel"]');
      const input = root.querySelector('[data-input="bd_channel"]');
      const icon = root.querySelector('.channel-input-icon');
      if (hidden) hidden.value = ch.id;
      if (input) input.value = ch.name;
      if (icon) icon.innerHTML = channelIcon(ch.type);
    }
  }

  /* ---- Роли ---- */
  const chipsContainer = root.querySelector('[data-bd-role-chips]');

  function renderRoleChips() {
    const ids = data.settings.requiredRoleIds || [];
    if (!ids.length) {
      chipsContainer.innerHTML = '<span class="bd-role-empty">Не задано — поздравляем всех</span>';
      return;
    }
    chipsContainer.innerHTML = ids.map(rid => {
      const role = state.roles.find(r => r.id === rid);
      const color = role?.color || '#99aab5';
      const name = role?.name || rid;
      return `
        <span class="bd-role-chip" data-role-id="${rid}">
          <span class="bd-role-chip-dot" style="background:${color};"></span>
          <span>${escapeHtml(name)}</span>
          <button type="button" data-remove-role="${rid}" aria-label="Удалить">✕</button>
        </span>
      `;
    }).join('');
  }
  renderRoleChips();

  chipsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-role]');
    if (!btn) return;
    const rid = btn.dataset.removeRole;
    data.settings.requiredRoleIds = (data.settings.requiredRoleIds || []).filter(x => x !== rid);
    renderRoleChips();
  });

  bindRolePicker(root, {
    id: 'bd_required_role',
    onSelect: (role) => {
      if (!role) return;
      const ids = new Set(data.settings.requiredRoleIds || []);
      ids.add(role.id);
      data.settings.requiredRoleIds = [...ids];
      renderRoleChips();
      const picker = root.querySelector('[data-role-picker="bd_required_role"]');
      if (picker) {
        const inp = picker.querySelector('[data-role-input="bd_required_role"]');
        const hid = picker.querySelector('[data-role-hidden="bd_required_role"]');
        const ico = picker.querySelector('.role-input-icon');
        if (inp) inp.value = '';
        if (hid) hid.value = '';
        if (ico) ico.innerHTML = '';
      }
    }
  });

  /* ---- Toggles ---- */
  const roleRemoveBtn = root.querySelector('[data-bd-role-remove]');
  roleRemoveBtn.addEventListener('click', () => {
    data.settings.roleRemoveNextDay = !(data.settings.roleRemoveNextDay !== false);
    roleRemoveBtn.classList.toggle('on', data.settings.roleRemoveNextDay);
  });

  const deleteMsgBtn = root.querySelector('[data-bd-delete-msg]');
  deleteMsgBtn.addEventListener('click', () => {
    data.settings.autoDeleteMessage = !data.settings.autoDeleteMessage;
    deleteMsgBtn.classList.toggle('on', data.settings.autoDeleteMessage);
  });

  /* ---- Список ---- */
  const listContainer = root.querySelector('[data-bd-list]');
  const listParent = listContainer.parentNode;
  listParent.querySelectorAll('.list-toolbar, .bulk-panel').forEach(el => el.remove());

  if (birthdaysToolbar) { birthdaysToolbar.destroy(); birthdaysToolbar = null; }

  if (data.users.length) {
    birthdaysToolbar = createListToolbar({
      listEl: listContainer,
      getAllItems: () => getData().users,
      renderList: (items) => renderBirthdayListItems(listContainer, items),
      searchPlaceholder: 'Поиск по имени…',
      searchKeyFn: (u) => {
        const m = getMember(u.userId);
        return `${m?.displayName || ''} ${m?.username || ''}`.trim();
      },
      filters: [
        { id: 'upcoming', label: 'Ближайшие', fn: u => daysUntilBirthday(u.day, u.month) <= 30 },
        { id: 'enabled', label: 'Только включённые', fn: u => u.enabled !== false }
      ],
      actions: [
        { id: 'enable', label: 'Включить', handler: ids => bulkToggleBirthdays(ids, true) },
        { id: 'disable', label: 'Выключить', handler: ids => bulkToggleBirthdays(ids, false) },
        { id: 'delete', label: 'Удалить', danger: true, handler: bulkDeleteBirthdays }
      ],
      selectableSelector: '.birthday-card',
      onFilterChange: () => { currentBirthdayPage = 1; }
    });
    birthdaysToolbar.refresh();
  } else {
    renderBirthdayListItems(listContainer, []);
  }

  /* ---- Добавление ---- */
  root.querySelector('[data-bd-add]').addEventListener('click', () => {
    openBirthdayModal(data, () => renderBirthdaysView());
  });

  /* ---- Редактор шаблона ---- */
  const editorContainer = root.querySelector('[data-bd-editor]');

  function getTemplateFor(tab) {
    if (tab === 'single') return data.template || DEFAULT_SINGLE;
    return data.templateNoYear || DEFAULT_NOYEAR;
  }

  function saveCurrentTabTemplate() {
    if (!editorInstance) return;
    const cfg = editorInstance.getConfig();
    if (currentTab === 'single') data.template = cfg;
    else if (currentTab === 'noYear') data.templateNoYear = cfg;
  }

  function mountEditor() {
    if (editorInstance) { editorInstance.unmount(); editorInstance = null; }
    editorInstance = new Editor('birthdays', {
      getRoleName: () => null,
      previewUser: '<span class="dp-mention">@Иван</span>',
      previewAge: currentTab === 'single' ? '30' : null,
      allowAge: currentTab === 'single'
    });
    editorInstance.mount(editorContainer);
    editorInstance.load(getTemplateFor(currentTab));
  }

  mountEditor();

  root.querySelectorAll('[data-tpl-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tplTab;
      if (tab === currentTab) return;
      saveCurrentTabTemplate();
      currentTab = tab;
      root.querySelectorAll('[data-tpl-tab]').forEach(b => b.classList.toggle('active', b === btn));
      mountEditor();
    });
  });

  root._bdSaveCurrentTemplate = saveCurrentTabTemplate;

  state.birthdays = data;
}

/* ============================================================
   Список
   ============================================================ */

function renderBirthdayListItems(container, items) {
  const data = getData();

  if (!items.length) {
    if (!data.users.length) {
      container.innerHTML = emptyState({
        icon: 'fa-cake-candles',
        title: 'Пока нет дней рождения',
        text: 'Добавьте первого именинника — кнопка «Добавить» в шапке.',
        ctaLabel: 'Добавить',
        ctaAction: 'add-bd'
      });
      container.querySelector('[data-add-bd]')?.addEventListener('click', () => {
        openBirthdayModal(data, () => renderBirthdaysView());
      });
    } else {
      container.innerHTML = noResultsHTML();
    }
    return;
  }

  /* Сортировка по близости */
  const sorted = [...items]
    .filter(u => u.day && u.month)
    .map(u => ({ ...u, _days: daysUntilBirthday(u.day, u.month) }))
    .sort((a, b) => a._days - b._days);

  const totalPages = Math.max(1, Math.ceil(sorted.length / BIRTHDAYS_PAGE_SIZE));
  if (currentBirthdayPage > totalPages) currentBirthdayPage = totalPages;
  if (currentBirthdayPage < 1) currentBirthdayPage = 1;

  const start = (currentBirthdayPage - 1) * BIRTHDAYS_PAGE_SIZE;
  const pageItems = sorted.slice(start, start + BIRTHDAYS_PAGE_SIZE);

  const cardsHTML = pageItems.map(u => renderBirthdayCard(u, data)).join('');
  const paginationHTML = totalPages > 1 ? renderPagination(totalPages) : '';

  container.innerHTML = cardsHTML + paginationHTML;

  bindCardActions(container, data);
  if (totalPages > 1) bindPagination(container, totalPages);
}

function renderBirthdayCard(u, data) {
  const member = getMember(u.userId);
  const initial = (member?.displayName || member?.username || '?').charAt(0).toUpperCase();
  const avatarInner = member?.avatar ? `<img src="${member.avatar}" alt="">` : initial;
  const name = member?.displayName || member?.username || `ID: ${u.userId}`;
  const sub = subtitleFor(u);
  const isDisabled = u.enabled === false;
  const isActive = isBirthdayActive(u, data.settings);

  const classes = ['birthday-card'];
  if (isDisabled) classes.push('disabled');
  else if (isActive) classes.push('active');

  const badgeClass = u._days === 0 ? 'today' : (u._days <= 7 ? 'soon' : '');
  const badgeHTML = isDisabled
    ? '<span class="birthday-badge off">Отключено</span>'
    : `<span class="birthday-badge ${badgeClass}">${badgeText(u._days)}</span>`;

  return `
    <div class="${classes.join(' ')}" data-bd-id="${u.userId}">
      <input type="checkbox" class="card-checkbox" data-select-id="${u.userId}" aria-label="Выбрать">
      <div class="birthday-card-avatar">${avatarInner}</div>
      <div class="birthday-card-info">
        <div class="birthday-card-title">${escapeHtml(name)}</div>
        <div class="birthday-card-sub">${escapeHtml(sub)}</div>
      </div>
      ${badgeHTML}
      <div class="birthday-card-actions">
        <button type="button" class="icon-btn" data-bd-edit="${u.userId}" title="Редактировать">${ICONS.edit}</button>
        <button type="button" class="icon-btn danger" data-bd-remove="${u.userId}" title="Удалить">${ICONS.delete}</button>
      </div>
    </div>
  `;
}

function bindCardActions(container, data) {
  container.querySelectorAll('[data-bd-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = data.users.find(x => x.userId === btn.dataset.bdEdit);
      if (u) openBirthdayModal(data, () => renderBirthdaysView(), u);
    });
  });
  container.querySelectorAll('[data-bd-remove]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.bdRemove;
      const member = getMember(userId);
      const name = member?.displayName || member?.username || userId;

      const ok = await confirmDialog({
        title: 'Удаление ДР',
        text: `Удалить ДР «${name}»?`,
        actionText: 'Удалить'
      });
      if (!ok) return;

      const fresh = getData();
      fresh.users = fresh.users.filter(x => x.userId !== userId);
      state.birthdays = fresh;

      try {
        await api.setData(state.guildId, 'birthdays', fresh);
        renderBirthdaysView();
        toast('Удалено');
      } catch (e) {
        toast(e.message, { type: 'error' });
      }
    });
  });
}

/* ============================================================
   Пагинация
   ============================================================ */

function renderPagination(totalPages) {
  const btn = (page, label, extraClass = '', disabled = false) =>
    `<button type="button" class="bd-pagination-btn ${extraClass}" data-page-btn="${page}" ${disabled ? 'disabled' : ''}>${label}</button>`;

  const items = [];
  items.push(btn('prev', '‹', '', currentBirthdayPage === 1));

  for (const p of getPageWindow(currentBirthdayPage, totalPages)) {
    if (p === '...') items.push('<span class="bd-pagination-ellipsis">…</span>');
    else items.push(btn(p, String(p), p === currentBirthdayPage ? 'active' : ''));
  }

  items.push(btn('next', '›', '', currentBirthdayPage === totalPages));

  return `<div class="bd-pagination">${items.join('')}</div>`;
}

function getPageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

function bindPagination(container, totalPages) {
  container.querySelectorAll('[data-page-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.pageBtn;
      let newPage;
      if (val === 'prev') newPage = currentBirthdayPage - 1;
      else if (val === 'next') newPage = currentBirthdayPage + 1;
      else newPage = parseInt(val, 10);

      if (!newPage || newPage < 1 || newPage > totalPages || newPage === currentBirthdayPage) return;
      currentBirthdayPage = newPage;

      if (birthdaysToolbar && birthdaysToolbar.el.isConnected) {
        birthdaysToolbar.refresh();
      } else {
        renderBirthdayListItems(container, getData().users);
      }
    });
  });
}

/* ============================================================
   SSE-обновление
   ============================================================ */

export function refreshBirthdaysList() {
  if (birthdaysToolbar && birthdaysToolbar.el.isConnected) {
    birthdaysToolbar.refresh();
  } else {
    const root = document.getElementById('view-birthdays');
    const container = root?.querySelector('[data-bd-list]');
    if (container) renderBirthdayListItems(container, getData().users);
  }
}

/* ============================================================
   Bulk
   ============================================================ */

async function bulkToggleBirthdays(userIds, enabled) {
  const fresh = getData();
  const affected = fresh.users.filter(u => userIds.includes(u.userId));
  for (const u of affected) u.enabled = enabled;

  try {
    state.birthdays = fresh;
    await api.setData(state.guildId, 'birthdays', fresh);
    renderBirthdaysView();
    toast(`${enabled ? 'Включено' : 'Выключено'}: ${affected.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

async function bulkDeleteBirthdays(userIds) {
  const ok = await confirmDialog({
    title: 'Удаление',
    text: `Удалить ${userIds.length} ${pluralize(userIds.length, ['запись', 'записи', 'записей'])}?`,
    actionText: 'Удалить'
  });
  if (!ok) return;

  try {
    const fresh = getData();
    fresh.users = fresh.users.filter(u => !userIds.includes(u.userId));
    state.birthdays = fresh;
    await api.setData(state.guildId, 'birthdays', fresh);
    renderBirthdaysView();
    toast(`Удалено: ${userIds.length}`);
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Модалка добавления/редактирования
   ============================================================ */

function openBirthdayModal(data, onSaved, existing = null) {
  const isEdit = !!existing;
  const isEnabled = existing?.enabled !== false;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-close>Отмена</button>
    <button type="button" class="btn btn-primary" data-save>${isEdit ? 'Сохранить' : 'Добавить'}</button>
  `;

  const dayOptions = Array.from({ length: 31 }, (_, i) => {
    const v = i + 1;
    return `<option value="${v}" ${existing?.day === v ? 'selected' : ''}>${v}</option>`;
  }).join('');

  const monthOptions = MONTHS.map((m, i) => {
    const v = i + 1;
    return `<option value="${v}" ${existing?.month === v ? 'selected' : ''}>${m}</option>`;
  }).join('');

  const body = `
    <div class="form-group">
      <label>Пользователь</label>
      ${memberPickerHTML({ id: 'bd_member', value: existing?.userId || '' })}
    </div>
    <div class="editor-grid" style="grid-template-columns:1fr 1fr 1fr;">
      <div class="form-group"><label>День</label><select class="input" data-bd-day>${dayOptions}</select></div>
      <div class="form-group"><label>Месяц</label><select class="input" data-bd-month>${monthOptions}</select></div>
      <div class="form-group"><label>Год</label><input type="number" class="input" data-bd-year placeholder="Необязательно" min="1900" max="2100" value="${existing?.year || ''}"></div>
    </div>
    <span class="hint" style="display:block;margin-top:-10px;margin-bottom:14px;">Год нужен только для расчёта возраста.</span>
    <label class="check-row">
      <input type="checkbox" data-bd-user-enabled ${isEnabled ? 'checked' : ''}>
      <div class="check-row-info">
        <strong>Поздравлять</strong>
        <span>Если выключено — бот не поздравит и не выдаст роль</span>
      </div>
    </label>
  `;

  const m = modal({
    title: isEdit ? 'Редактировать ДР' : 'Добавить ДР',
    body, footer
  });

  if (existing?.userId) {
    const member = getMember(existing.userId);
    m._selectedUser = member || { id: existing.userId, displayName: `ID: ${existing.userId}`, avatar: null };
    const input = m.bodyEl.querySelector('[data-member-input="bd_member"]');
    const hidden = m.bodyEl.querySelector('[data-member-hidden="bd_member"]');
    if (input && member) input.value = member.displayName || member.username;
    if (hidden) hidden.value = existing.userId;
  }

  bindMemberPicker(m.bodyEl, { id: 'bd_member', onSelect: (member) => { m._selectedUser = member; } });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const user = m._selectedUser;
      if (!user) throw new Error('Выберите пользователя');

      const day = parseInt(m.bodyEl.querySelector('[data-bd-day]').value);
      const month = parseInt(m.bodyEl.querySelector('[data-bd-month]').value);
      const yearStr = m.bodyEl.querySelector('[data-bd-year]').value.trim();
      const year = yearStr ? parseInt(yearStr) : null;
      const enabled = m.bodyEl.querySelector('[data-bd-user-enabled]').checked;

      if (!day || !month) throw new Error('Укажите дату');
      if (year !== null && (year < 1900 || year > 2100)) throw new Error('Некорректный год');

      const fresh = getData();
      const entry = { userId: user.id, day, month, year, enabled };

      if (isEdit) {
        const idx = fresh.users.findIndex(u => u.userId === existing.userId);
        if (idx >= 0) {
          const dup = fresh.users.findIndex(u => u.userId === user.id && u.userId !== existing.userId);
          if (dup >= 0) fresh.users.splice(dup, 1);
          const finalIdx = fresh.users.findIndex(u => u.userId === existing.userId);
          fresh.users[finalIdx >= 0 ? finalIdx : idx] = entry;
        } else {
          fresh.users.push(entry);
        }
      } else {
        const idx = fresh.users.findIndex(u => u.userId === user.id);
        if (idx >= 0) fresh.users[idx] = entry;
        else fresh.users.push(entry);
      }

      state.birthdays = fresh;
      await api.setData(state.guildId, 'birthdays', fresh);
      m.close();
      onSaved?.();
      toast(isEdit ? 'Обновлено' : 'Добавлено');
    } catch (e) {
      toast(e.message || 'Ошибка', { type: 'error' });
    }
  });
}

/* ============================================================
   Сохранение
   ============================================================ */

export async function saveBirthdays() {
  const data = getData();
  const root = document.getElementById('view-birthdays');
  if (root?._bdSaveCurrentTemplate) root._bdSaveCurrentTemplate();

  if (editorInstance) {
    const cfg = editorInstance.getConfig();
    if (currentTab === 'single') data.template = cfg;
    else if (currentTab === 'noYear') data.templateNoYear = cfg;
  }

  try {
    await api.setData(state.guildId, 'birthdays', data);
    state.birthdays = data;
    if (editorInstance) editorInstance.markSaved();
    toast('Дни рождения сохранены');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}