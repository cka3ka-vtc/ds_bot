/* ============================================================
   Профили: настройка канала/ролей/шаблона + карточки пользователей.

   ВАЖНО: удаление профиля очищает только `user.profile`
   (ссылки и дата в компании), но НЕ сам ДР.
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, formatDuration } from '../utils.js';
import { toast, modal, confirmDialog, emptyState } from '../ui.js';
import {
  channelPickerHTML, bindChannelPicker, channelIcon,
  rolePickerHTML, bindRolePicker,
  memberPickerHTML, bindMemberPicker
} from '../pickers.js';
import { ICONS } from '../card-templates.js';
import { createListToolbar, noResultsHTML } from '../list-toolbar.js';
import { Editor } from '../editor.js';

const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

const DEFAULT_PROFILE_CONFIG = {
  displayMode: 'flat',
  accentColor: '#5865F2',
  title: '',
  subtitle: '',
  thumbnail: '',
  blocks: [
    { id: 'prof-def-1', type: 'text', content: '**{mention}**' },
    { id: 'prof-def-2', type: 'text', content: '🎂 Дата рождения: {birthday}' },
    { id: 'prof-def-3', type: 'text', content: '🔗 Ссылки: {links}' },
    { id: 'prof-def-4', type: 'text', content: '📅 В компании с: {companySince}\n⏳ Стаж: {companyDuration}' }
  ]
};

let profilesToolbar = null;
let editorInstance = null;
let draftSettings = null;
let draftGuildId = null;

/* ============================================================
   Данные
   ============================================================ */

function getBirthdaysData() {
  const fallback = {
    settings: {
      time: '09:00', roleId: '', channelId: '', enabled: false, lastRunDate: null,
      roleRemoveNextDay: true, autoDeleteMessage: false,
      requiredRoleIds: [], _pending: []
    },
    users: [], template: null, templateNoYear: null
  };
  if (!state.birthdays) return structuredClone(fallback);
  return {
    settings: { ...fallback.settings, ...(state.birthdays.settings || {}) },
    users: Array.isArray(state.birthdays.users) ? state.birthdays.users : [],
    template: state.birthdays.template,
    templateNoYear: state.birthdays.templateNoYear
  };
}

function getProfilesSettings() {
  const base = { channelId: '', requiredRoleIds: [], template: null };
  if (!state.profiles) return { ...base };
  const tpl = state.profiles.settings?.template;
  return {
    channelId: state.profiles.settings?.channelId || '',
    requiredRoleIds: Array.isArray(state.profiles.settings?.requiredRoleIds) ? [...state.profiles.settings.requiredRoleIds] : [],
    template: (tpl && typeof tpl === 'object' && Array.isArray(tpl.blocks)) ? structuredClone(tpl) : null
  };
}

function getMember(userId) {
  return state.members.find(m => m.id === userId);
}

function ensureProfile(user) {
  return user.profile || { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };
}

function hasAnyProfileData(profile) {
  if (!profile) return false;
  return !!(profile.vtc || profile.steam || profile.haulmp || profile.truckersmp || profile.companySince);
}

function subtitleFor(user) {
  if (!user.day || !user.month) return 'Дата рождения не указана';
  const dateStr = `${user.day} ${MONTHS[user.month - 1]}${user.year ? ` ${user.year}` : ''}`;
  return `ДР: ${dateStr}`;
}

/* ============================================================
   Рендер
   ============================================================ */

export function renderProfilesView() {
  const root = document.getElementById('view-profiles');
  if (!root) return;

  if (state.guildId !== draftGuildId) {
    draftSettings = getProfilesSettings();
    draftGuildId = state.guildId;
  } else if (!draftSettings) {
    draftSettings = getProfilesSettings();
  }

  const bdays = getBirthdaysData();

  root.innerHTML = `
    <div class="profiles-layout">
      <div class="card">
        <div class="card-header">
          <div><h2>Настройки профилей</h2><p>Канал, роли и шаблон вывода</p></div>
        </div>
        <div class="card-body">
          <div class="editor-grid">
            <div class="form-group">
              <label>Канал для профилей</label>
              ${channelPickerHTML({ id: 'profiles_channel', hintId: 'profiles_channel_hint' })}
              <span class="hint">Только в этом канале работают команды профиля</span>
            </div>
          </div>

          <div class="form-group">
            <label>Требуемые роли</label>
            <span class="hint" style="display:block;margin-bottom:8px;">Если не заданы — доступно всем. Если заданы — только участникам с одной из ролей.</span>
            <div class="bd-role-chips" data-prof-role-chips></div>
            ${rolePickerHTML({ id: 'profiles_required_role', placeholder: 'Добавить роль...' })}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div><h2>Шаблон вывода информации</h2><p>Используйте плейсхолдеры</p></div>
        </div>
        <div class="card-body">
          <div class="prof-template-hint">
            Токены: <code>{mention}</code> <code>{displayName}</code> <code>{username}</code> <code>{userId}</code>
            <code>{birthday}</code> <code>{age}</code> <code>{links}</code>
            <code>{vtc}</code> <code>{steam}</code> <code>{haulmp}</code> <code>{truckersmp}</code>
            <code>{companySince}</code> <code>{companyDuration}</code>
          </div>
          <div class="prof-template-hint-small">
            💡 В URL кнопок можно указать <code>{vtc}</code>, <code>{steam}</code>, <code>{haulmp}</code>, <code>{truckersmp}</code> — подставится ссылка пользователя.
          </div>
          <div class="rules-layout" data-prof-editor></div>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="profiles-list" data-prof-list></div>
        </div>
      </div>
    </div>
  `;

  /* ---- Канал ---- */
  const chanHint = root.querySelector('#profiles_channel_hint');
  const chanHidden = root.querySelector('[data-hidden="profiles_channel"]');
  const chanInput = root.querySelector('[data-input="profiles_channel"]');
  const chanIcon = root.querySelector('.channel-input-icon');

  if (draftSettings.channelId) {
    const ch = state.channels.find(c => c.id === draftSettings.channelId);
    if (ch) {
      if (chanHidden) chanHidden.value = ch.id;
      if (chanInput) chanInput.value = ch.name;
      if (chanIcon) chanIcon.innerHTML = channelIcon(ch.type);
      if (chanHint) chanHint.textContent = `Выбран: ${ch.name}`;
    }
  } else if (chanHint) {
    chanHint.textContent = 'Канал не выбран';
  }

  bindChannelPicker(root, {
    id: 'profiles_channel',
    onSelect: (ch) => {
      draftSettings.channelId = ch?.id || '';
      if (chanHint) chanHint.textContent = ch ? `Выбран: ${ch.name}` : 'Канал не выбран';
    }
  });

  /* ---- Роли ---- */
  const chipsContainer = root.querySelector('[data-prof-role-chips]');

  function renderChips() {
    const ids = draftSettings.requiredRoleIds || [];
    if (!ids.length) {
      chipsContainer.innerHTML = '<span class="bd-role-empty">Не задано — доступно всем</span>';
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
  renderChips();

  chipsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-role]');
    if (!btn) return;
    const rid = btn.dataset.removeRole;
    draftSettings.requiredRoleIds = (draftSettings.requiredRoleIds || []).filter(x => x !== rid);
    renderChips();
  });

  bindRolePicker(root, {
    id: 'profiles_required_role',
    onSelect: (role) => {
      if (!role) return;
      const ids = new Set(draftSettings.requiredRoleIds || []);
      ids.add(role.id);
      draftSettings.requiredRoleIds = [...ids];
      renderChips();
      const picker = root.querySelector('[data-role-picker="profiles_required_role"]');
      if (picker) {
        const inp = picker.querySelector('[data-role-input="profiles_required_role"]');
        const hid = picker.querySelector('[data-role-hidden="profiles_required_role"]');
        const ico = picker.querySelector('.role-input-icon');
        if (inp) inp.value = '';
        if (hid) hid.value = '';
        if (ico) ico.innerHTML = '';
      }
    }
  });

  /* ---- Editor ---- */
  const editorContainer = root.querySelector('[data-prof-editor]');
  if (editorInstance) { editorInstance.unmount(); editorInstance = null; }
  editorInstance = new Editor('profiles', { getRoleName: () => null });
  editorInstance.mount(editorContainer);
  editorInstance.load(draftSettings.template || DEFAULT_PROFILE_CONFIG);

  /* ---- Список ---- */
  const listContainer = root.querySelector('[data-prof-list]');
  const listParent = listContainer.parentNode;
  listParent.querySelectorAll('.list-toolbar, .bulk-panel').forEach(el => el.remove());

  if (profilesToolbar) { profilesToolbar.destroy(); profilesToolbar = null; }

  if (bdays.users.length) {
    profilesToolbar = createListToolbar({
      listEl: listContainer,
      getAllItems: () => getBirthdaysData().users,
      renderList: (items) => renderProfileList(listContainer, items),
      searchPlaceholder: 'Поиск по имени…',
      searchKeyFn: (u) => {
        const m = getMember(u.userId);
        return `${m?.displayName || ''} ${m?.username || ''}`.trim();
      },
      filters: [
        { id: 'birthday', label: 'С ДР', fn: u => u.day && u.month },
        { id: 'links', label: 'Со ссылками', fn: u => {
          const p = ensureProfile(u);
          return !!(p.vtc || p.steam || p.haulmp || p.truckersmp);
        }},
        { id: 'company', label: 'В компании', fn: u => !!ensureProfile(u).companySince }
      ],
      actions: [],
      selectableSelector: '.profile-card'
    });
    profilesToolbar.refresh();
  } else {
    renderProfileList(listContainer, []);
  }

  state.profiles = { ...(state.profiles || {}), settings: { ...draftSettings } };
}

/* ============================================================
   Создание профиля из шапки
   ============================================================ */

export function createProfileFlow() {
  openProfileModal(null, () => renderProfilesView());
}

/* ============================================================
   Сохранение
   ============================================================ */

export async function saveProfiles() {
  if (!draftSettings) draftSettings = getProfilesSettings();

  let template = draftSettings.template;
  if (editorInstance) template = editorInstance.getConfig();

  try {
    const payload = {
      settings: {
        channelId: draftSettings.channelId || '',
        requiredRoleIds: Array.isArray(draftSettings.requiredRoleIds) ? draftSettings.requiredRoleIds : [],
        template: (template && Array.isArray(template.blocks) && template.blocks.length) ? template : null
      }
    };

    await api.setData(state.guildId, 'profiles', payload);
    state.profiles = payload;
    draftSettings = { ...payload.settings };
    if (editorInstance) editorInstance.markSaved();
    toast('Настройки профилей сохранены');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}

/* ============================================================
   Список
   ============================================================ */

function renderProfileList(container, items) {
  const data = getBirthdaysData();

  if (!items.length) {
    if (!data.users.length) {
      container.innerHTML = emptyState({
        icon: 'fa-users',
        title: 'Пока нет пользователей',
        text: 'Нажмите «Добавить профиль» в шапке.',
        ctaLabel: 'Добавить',
        ctaAction: 'add-prof'
      });
      container.querySelector('[data-add-prof]')?.addEventListener('click', createProfileFlow);
    } else {
      container.innerHTML = noResultsHTML();
    }
    return;
  }

  const sorted = [...items]
    .map(u => ({ ...u, _days: (u.day && u.month) ? daysUntilBirthday(u.day, u.month) : null }))
    .sort((a, b) => {
      if (a._days === null && b._days === null) return 0;
      if (a._days === null) return 1;
      if (b._days === null) return -1;
      return a._days - b._days;
    });

  container.innerHTML = sorted.map(u => renderProfileCard(u)).join('');
  bindProfileActions(container, data);
}

function renderProfileCard(u) {
  const member = getMember(u.userId);
  const initial = (member?.displayName || member?.username || '?').charAt(0).toUpperCase();
  const avatarInner = member?.avatar ? `<img src="${member.avatar}" alt="">` : initial;
  const name = member?.displayName || member?.username || `ID: ${u.userId}`;
  const sub = subtitleFor(u);
  const profile = ensureProfile(u);

  const links = [];
  if (profile.vtc) links.push({ icon: 'fa-link', url: profile.vtc, label: 'VTC' });
  if (profile.steam) links.push({ icon: 'fa-steam', url: profile.steam, label: 'Steam' });
  if (profile.haulmp) links.push({ icon: 'fa-truck', url: profile.haulmp, label: 'HaulMP' });
  if (profile.truckersmp) links.push({ icon: 'fa-truck', url: profile.truckersmp, label: 'TruckersMP' });

  const linksHtml = links.length
    ? `<div class="profile-links">${links.map(l => `
        <a class="profile-link" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="profile-link-icon"><i class="fa-${l.icon === 'fa-steam' ? 'brands' : 'solid'} ${l.icon}"></i></span>
          <span>${l.label}</span>
        </a>
      `).join('')}</div>`
    : '';

  const companyHtml = profile.companySince
    ? `<div class="profile-company">
        ${ICONS.calendar}
        <span>В компании с <strong>${formatDate(profile.companySince)}</strong></span>
        <span class="profile-duration">${escapeHtml(formatDuration(profile.companySince) || '')}</span>
      </div>`
    : '';

  const hasData = hasAnyProfileData(profile);
  const deleteBtn = hasData
    ? `<button type="button" class="icon-btn danger" data-prof-remove="${u.userId}" title="Очистить профиль">${ICONS.delete}</button>`
    : '';

  return `
    <div class="profile-card" data-prof-id="${u.userId}">
      <div class="profile-card-head">
        <div class="profile-card-avatar">${avatarInner}</div>
        <div class="profile-card-info">
          <div class="profile-card-name">${escapeHtml(name)}</div>
          <div class="profile-card-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="profile-card-actions">
          <button type="button" class="icon-btn" data-prof-edit="${u.userId}" title="Редактировать">${ICONS.edit}</button>
          ${deleteBtn}
        </div>
      </div>
      ${linksHtml}
      ${companyHtml}
    </div>
  `;
}

function bindProfileActions(container, data) {
  container.querySelectorAll('[data-prof-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = data.users.find(x => x.userId === btn.dataset.profEdit);
      if (u) openProfileModal(u, () => renderProfilesView());
    });
  });

  container.querySelectorAll('[data-prof-remove]').forEach(btn => {
    btn.addEventListener('click', () => deleteProfile(btn.dataset.profRemove));
  });
}

/**
 * Очищает ТОЛЬКО user.profile — сам ДР и запись пользователя сохраняются.
 */
async function deleteProfile(userId) {
  const member = getMember(userId);
  const name = member?.displayName || member?.username || userId;

  const ok = await confirmDialog({
    title: 'Очистить профиль?',
    text: `Очистить профиль пользователя «${name}»?\n\nДень рождения и запись пользователя сохранятся — удаляются только ссылки (VTC, Steam, HaulMP, TruckersMP) и дата вступления в компанию.`,
    actionText: 'Очистить'
  });
  if (!ok) return;

  try {
    const fresh = getBirthdaysData();
    const idx = fresh.users.findIndex(u => u.userId === userId);
    if (idx < 0) return toast('Пользователь не найден', { type: 'error' });

    fresh.users[idx].profile = {
      vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null
    };

    state.birthdays = { ...(state.birthdays || {}), ...fresh };
    await api.setData(state.guildId, 'birthdays', fresh);
    renderProfilesView();
    toast('Профиль очищен');
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Модалка добавления/редактирования профиля
   ============================================================ */

function openProfileModal(existing, onSaved) {
  const isEdit = !!existing;
  const profile = existing ? ensureProfile(existing) : { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null };

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button type="button" class="btn btn-ghost" data-close>Отмена</button>
    <button type="button" class="btn btn-primary" data-save>${isEdit ? 'Сохранить' : 'Добавить'}</button>
  `;

  const dayOptions = '<option value="">—</option>' + Array.from({ length: 31 }, (_, i) => {
    const v = i + 1;
    return `<option value="${v}" ${existing?.day === v ? 'selected' : ''}>${v}</option>`;
  }).join('');

  const monthOptions = '<option value="">—</option>' + MONTHS.map((m, i) => {
    const v = i + 1;
    return `<option value="${v}" ${existing?.month === v ? 'selected' : ''}>${m}</option>`;
  }).join('');

  const companySinceVal = profile.companySince
    ? new Date(profile.companySince).toISOString().slice(0, 10)
    : '';

  const body = `
    <div class="form-group">
      <label>Пользователь</label>
      ${memberPickerHTML({ id: 'prof_member', value: existing?.userId || '' })}
    </div>

    <div class="form-section">
      <div class="form-section-title">Дата рождения</div>
      <span class="hint" style="display:block;margin-bottom:10px;">Необязательно. Если не указана — поздравление не отправится, но профиль сохранится.</span>
      <div class="editor-grid" style="grid-template-columns:1fr 1fr 1fr;">
        <div class="form-group"><label>День</label><select class="input" data-prof-day>${dayOptions}</select></div>
        <div class="form-group"><label>Месяц</label><select class="input" data-prof-month>${monthOptions}</select></div>
        <div class="form-group"><label>Год</label><input type="number" class="input" data-prof-year placeholder="Необязательно" min="1900" max="2100" value="${existing?.year || ''}"></div>
      </div>
      <label class="check-row" style="margin-top:0;">
        <input type="checkbox" data-prof-bday-enabled ${existing?.enabled !== false ? 'checked' : ''}>
        <div class="check-row-info">
          <strong>Поздравлять</strong>
          <span>Если выключено — бот не поздравит и не выдаст роль</span>
        </div>
      </label>
    </div>

    <div class="form-section">
      <div class="form-section-title">Ссылки</div>
      <div class="form-group"><label>VTC</label><input class="input" data-prof-vtc placeholder="https://..." value="${escapeHtml(profile.vtc)}"></div>
      <div class="form-group"><label>Steam</label><input class="input" data-prof-steam placeholder="https://steamcommunity.com/id/..." value="${escapeHtml(profile.steam)}"></div>
      <div class="form-group"><label>HaulMP</label><input class="input" data-prof-haulmp placeholder="https://..." value="${escapeHtml(profile.haulmp)}"></div>
      <div class="form-group"><label>TruckersMP</label><input class="input" data-prof-truckersmp placeholder="https://truckersmp.com/user/..." value="${escapeHtml(profile.truckersmp)}"></div>
    </div>

    <div class="form-section">
      <div class="form-section-title">В компании</div>
      <div class="form-group">
        <label>Дата вступления</label>
        <input type="date" class="input" data-prof-company-since value="${companySinceVal}">
        <span class="hint" data-prof-company-hint>
          ${profile.companySince ? `Стаж: ${escapeHtml(formatDuration(profile.companySince) || '—')}` : 'Заполните, чтобы отображать стаж'}
        </span>
      </div>
    </div>
  `;

  const m = modal({ title: isEdit ? 'Редактировать профиль' : 'Добавить профиль', body, footer });

  if (existing?.userId) {
    const member = getMember(existing.userId);
    m._selectedUser = member || { id: existing.userId, displayName: `ID: ${existing.userId}`, avatar: null };
    const input = m.bodyEl.querySelector('[data-member-input="prof_member"]');
    const hidden = m.bodyEl.querySelector('[data-member-hidden="prof_member"]');
    if (input && member) input.value = member.displayName || member.username;
    if (hidden) hidden.value = existing.userId;
  }

  bindMemberPicker(m.bodyEl, { id: 'prof_member', onSelect: (member) => { m._selectedUser = member; } });

  const companyInput = m.bodyEl.querySelector('[data-prof-company-since]');
  const companyHint = m.bodyEl.querySelector('[data-prof-company-hint]');
  companyInput.addEventListener('input', () => {
    if (!companyInput.value) {
      companyHint.textContent = 'Заполните, чтобы отображать стаж';
      return;
    }
    const iso = new Date(companyInput.value + 'T00:00:00').toISOString();
    const dur = formatDuration(iso);
    companyHint.textContent = dur ? `Стаж: ${dur}` : 'Некорректная дата';
  });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());
  footer.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const user = m._selectedUser;
      if (!user) throw new Error('Выберите пользователя');

      const dayRaw = m.bodyEl.querySelector('[data-prof-day]').value;
      const monthRaw = m.bodyEl.querySelector('[data-prof-month]').value;
      const yearRaw = m.bodyEl.querySelector('[data-prof-year]').value.trim();

      const day = dayRaw ? parseInt(dayRaw, 10) : null;
      const month = monthRaw ? parseInt(monthRaw, 10) : null;
      const year = yearRaw ? parseInt(yearRaw, 10) : null;

      if ((day && !month) || (!day && month)) throw new Error('Укажите и день, и месяц (или оставьте оба пустыми)');
      if (year !== null && (year < 1900 || year > 2100)) throw new Error('Некорректный год');

      const profileData = {
        vtc: m.bodyEl.querySelector('[data-prof-vtc]').value.trim(),
        steam: m.bodyEl.querySelector('[data-prof-steam]').value.trim(),
        haulmp: m.bodyEl.querySelector('[data-prof-haulmp]').value.trim(),
        truckersmp: m.bodyEl.querySelector('[data-prof-truckersmp]').value.trim(),
        companySince: companyInput.value ? new Date(companyInput.value + 'T00:00:00').toISOString() : null
      };

      const enabled = m.bodyEl.querySelector('[data-prof-bday-enabled]').checked;

      const fresh = getBirthdaysData();
      const entry = { userId: user.id, day, month, year, enabled, profile: profileData };

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

      state.birthdays = { ...(state.birthdays || {}), ...fresh };
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
   SSE-обновление
   ============================================================ */

export function refreshProfilesList() {
  if (profilesToolbar && profilesToolbar.el.isConnected) {
    profilesToolbar.refresh();
  } else {
    const root = document.getElementById('view-profiles');
    const container = root?.querySelector('[data-prof-list]');
    if (container) renderProfileList(container, getBirthdaysData().users);
  }
}

/* ============================================================
   Утилиты
   ============================================================ */

function daysUntilBirthday(day, month) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(now.getFullYear(), month - 1, day);
  if (target < today) target = new Date(now.getFullYear() + 1, month - 1, day);
  return Math.round((target - today) / 86400000);
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}