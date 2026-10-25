/* ============================================================
   Extras — дополнительные блоки для модалок создания.

   В модалках announcements/delayed/messages используются
   общие обработчики:
   - extrasBuilder(context, draft) — возвращает { top, tabs }
   - extrasBinder(bodyEl, draft) — навешивает обработчики
   - extrasCollector(bodyEl, draft) — собирает значения обратно

   Так editor.js не знает ничего о специфике каждой секции.
   ============================================================ */

import { state } from './state.js';
import { escapeHtml, uid } from './utils.js';
import {
  channelPickerHTML, bindChannelPicker,
  rolePickerHTML, bindRolePicker,
  memberPickerHTML, bindMemberPicker
} from './pickers.js';

const DEFAULT_ICON = 'fa-bullhorn';

/* ============================================================
   Announcements
   ============================================================ */

/**
 * Черновик нового объявления.
 * @returns {object}
 */
export function makeNewAnnouncementDraft() {
  return {
    id: 'ann_' + uid(),
    name: '',
    channelId: '',
    icon: DEFAULT_ICON,
    enabled: true,
    config: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
    schedule: { type: 'manual', intervalMinutes: 30, time: '12:00', dayOfWeek: 1, dayOfMonth: 1 },
    autoDelete: { enabled: false, minutes: 60 },
    eventTime: { enabled: false, type: 'daily', time: '18:00', dayOfWeek: 1, dayOfMonth: 1 },
    mention: { type: 'none', roleId: '', userId: '' },
    nextRunAt: null,
    lastSentAt: null,
    isNew: true
  };
}

/**
 * HTML верхней панели + вкладок для объявления.
 * @param {string} context
 * @param {object} draft
 * @returns {{ top: string, tabs: string }}
 */
export function announcementsExtrasHTML(context, draft) {
  return {
    top: `
      <div class="form-group">
        <label>Название объявления</label>
        <input class="input" data-msg-name placeholder="Например: Ежедневное приветствие">
      </div>
      <div class="form-group">
        <label>Канал отправки</label>
        ${channelPickerHTML({ id: context + '_channel' })}
      </div>
      <div class="form-group">
        <label>Иконка (Font Awesome)</label>
        <input class="input ann-icon-input" data-ann-icon placeholder="fa-bullhorn" value="${escapeHtml(draft.icon || DEFAULT_ICON)}">
        <span class="hint">Например: fa-bullhorn, fa-clock, fa-star, fa-heart, fa-fire</span>
      </div>
      <div class="form-group">
        <label>Активность</label>
        <label class="ann-status-toggle">
          <input type="checkbox" data-ann-enabled>
          <span>Включено</span>
        </label>
      </div>
    `,
    tabs: `
      <div class="card">
        <div class="card-header">
          <div><h2>Расписание и дополнительные настройки</h2></div>
        </div>
        <div class="card-body">
          <div class="ann-tabs">
            <button type="button" class="ann-tab active" data-tab="schedule">Расписание</button>
            <button type="button" class="ann-tab" data-tab="autoDelete">Автоудаление</button>
            <button type="button" class="ann-tab" data-tab="event">Событие ({until})</button>
            <button type="button" class="ann-tab" data-tab="mention">Упоминание</button>
          </div>

          <!-- Расписание -->
          <div class="ann-tab-content active" data-tab="schedule">
            <div class="radio-group" data-sched-type>
              <label class="radio-row"><input type="radio" name="sched" value="manual" checked><span>Вручную</span></label>
              <label class="radio-row"><input type="radio" name="sched" value="interval"><span>Интервал</span></label>
              <label class="radio-row"><input type="radio" name="sched" value="daily"><span>Ежедневно</span></label>
              <label class="radio-row"><input type="radio" name="sched" value="weekly"><span>Еженедельно</span></label>
              <label class="radio-row"><input type="radio" name="sched" value="monthly"><span>Ежемесячно</span></label>
            </div>
            <div class="sched-options" data-for="interval">
              <div class="form-group">
                <label>Интервал</label>
                <select class="input" data-sched-interval>
                  <option value="5">5 мин</option><option value="10">10 мин</option><option value="15">15 мин</option>
                  <option value="20">20 мин</option><option value="30" selected>30 мин</option><option value="60">1 ч</option>
                  <option value="120">2 ч</option><option value="180">3 ч</option><option value="300">5 ч</option>
                  <option value="360">6 ч</option><option value="480">8 ч</option><option value="720">12 ч</option>
                </select>
              </div>
            </div>
            <div class="sched-options" data-for="daily">
              <div class="form-group"><label>Время</label><input type="time" class="input" data-sched-time value="12:00"></div>
            </div>
            <div class="sched-options" data-for="weekly">
              <div class="form-group">
                <label>День недели</label>
                <select class="input" data-sched-dow>
                  <option value="1">Пн</option><option value="2">Вт</option><option value="3">Ср</option>
                  <option value="4">Чт</option><option value="5">Пт</option><option value="6">Сб</option><option value="7">Вс</option>
                </select>
              </div>
              <div class="form-group"><label>Время</label><input type="time" class="input" data-sched-weekly-time value="12:00"></div>
            </div>
            <div class="sched-options" data-for="monthly">
              <div class="form-group"><label>Число</label><input type="number" class="input" data-sched-dom min="1" max="31" value="1"></div>
              <div class="form-group"><label>Время</label><input type="time" class="input" data-sched-monthly-time value="12:00"></div>
            </div>
          </div>

          <!-- Автоудаление -->
          <div class="ann-tab-content" data-tab="autoDelete">
            <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
              <input type="checkbox" data-ad-enabled> Удалять после отправки
            </label>
            <div class="form-group" data-ad-group style="display:none;">
              <label>Через</label>
              <select class="input" data-ad-minutes>
                <option value="5">5 мин</option><option value="10">10 мин</option><option value="15">15 мин</option>
                <option value="20">20 мин</option><option value="30">30 мин</option><option value="60" selected>1 ч</option>
                <option value="120">2 ч</option><option value="180">3 ч</option><option value="300">5 ч</option>
                <option value="360">6 ч</option><option value="480">8 ч</option><option value="720">12 ч</option>
                <option value="1440">1 д</option><option value="2880">2 д</option><option value="4320">3 д</option>
              </select>
            </div>
          </div>

          <!-- Событие -->
          <div class="ann-tab-content" data-tab="event">
            <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
              <input type="checkbox" data-ev-enabled> Отображать {until}
            </label>
            <div data-ev-group style="display:none;">
              <div class="radio-group" data-ev-type>
                <label class="radio-row"><input type="radio" name="ev" value="daily" checked><span>Ежедневно</span></label>
                <label class="radio-row"><input type="radio" name="ev" value="weekly"><span>Еженедельно</span></label>
                <label class="radio-row"><input type="radio" name="ev" value="monthly"><span>Ежемесячно</span></label>
              </div>
              <div class="event-options" data-for="daily">
                <div class="form-group"><label>Время события</label><input type="time" class="input" data-ev-time value="18:00"></div>
              </div>
              <div class="event-options" data-for="weekly">
                <div class="form-group">
                  <label>День недели</label>
                  <select class="input" data-ev-dow>
                    <option value="1">Пн</option><option value="2">Вт</option><option value="3">Ср</option>
                    <option value="4">Чт</option><option value="5">Пт</option><option value="6">Сб</option><option value="7">Вс</option>
                  </select>
                </div>
                <div class="form-group"><label>Время события</label><input type="time" class="input" data-ev-wt value="18:00"></div>
              </div>
              <div class="event-options" data-for="monthly">
                <div class="form-group"><label>Число месяца</label><input type="number" class="input" data-ev-dom min="1" max="31" value="1"></div>
                <div class="form-group"><label>Время события</label><input type="time" class="input" data-ev-mt value="18:00"></div>
              </div>
            </div>
          </div>

          <!-- Упоминание -->
          <div class="ann-tab-content" data-tab="mention">
            <div class="radio-group" data-men-type>
              <label class="radio-row"><input type="radio" name="men" value="none" checked><span>Не упоминать</span></label>
              <label class="radio-row"><input type="radio" name="men" value="everyone"><span>@everyone</span></label>
              <label class="radio-row"><input type="radio" name="men" value="role"><span>Роль</span></label>
              <label class="radio-row"><input type="radio" name="men" value="user"><span>Пользователь</span></label>
            </div>
            <div class="mention-options" data-for="role">${rolePickerHTML({ id: 'ann_mention_role' })}</div>
            <div class="mention-options" data-for="user">${memberPickerHTML({ id: 'ann_mention_user' })}</div>
          </div>
        </div>
      </div>
    `
  };
}

/**
 * Навешивает обработчики на extras объявления.
 * @param {HTMLElement} body
 * @param {object} draft
 */
export function bindAnnouncementExtras(body, draft) {
  /* Включено */
  const enabledCheckbox = body.querySelector('[data-ann-enabled]');
  if (enabledCheckbox) {
    enabledCheckbox.checked = draft.enabled !== false;
    enabledCheckbox.addEventListener('change', () => { draft.enabled = enabledCheckbox.checked; });
  }

  /* Иконка */
  const iconInput = body.querySelector('[data-ann-icon]');
  if (iconInput) {
    iconInput.value = draft.icon || DEFAULT_ICON;
    iconInput.addEventListener('input', e => {
      draft.icon = e.target.value.trim() || DEFAULT_ICON;
    });
  }

  /* Вкладки */
  body.querySelectorAll('.ann-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      body.querySelectorAll('.ann-tab').forEach(t => t.classList.toggle('active', t === tab));
      body.querySelectorAll('.ann-tab-content').forEach(c => c.classList.toggle('active', c.dataset.tab === tab.dataset.tab));
    });
  });

  /* Расписание — тип */
  const schedType = body.querySelector('[data-sched-type]');
  schedType.querySelectorAll('input').forEach(r => {
    r.checked = r.value === draft.schedule.type;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      draft.schedule.type = r.value;
      body.querySelectorAll('.sched-options').forEach(o => o.classList.toggle('active', o.dataset.for === r.value));
    });
  });
  body.querySelectorAll('.sched-options').forEach(o => o.classList.toggle('active', o.dataset.for === draft.schedule.type));

  /* Расписание — поля */
  const setVal = (sel, val) => {
    const el = body.querySelector(sel);
    if (el) el.value = val;
  };

  setVal('[data-sched-interval]', draft.schedule.intervalMinutes || 30);
  setVal('[data-sched-time]', draft.schedule.time || '12:00');
  setVal('[data-sched-weekly-time]', draft.schedule.time || '12:00');
  setVal('[data-sched-monthly-time]', draft.schedule.time || '12:00');
  setVal('[data-sched-dow]', draft.schedule.dayOfWeek || 1);
  setVal('[data-sched-dom]', draft.schedule.dayOfMonth || 1);

  body.querySelector('[data-sched-interval]')?.addEventListener('change', e => { draft.schedule.intervalMinutes = parseInt(e.target.value); });
  body.querySelector('[data-sched-time]')?.addEventListener('input', e => { draft.schedule.time = e.target.value; });
  body.querySelector('[data-sched-weekly-time]')?.addEventListener('input', e => { draft.schedule.time = e.target.value; });
  body.querySelector('[data-sched-monthly-time]')?.addEventListener('input', e => { draft.schedule.time = e.target.value; });
  body.querySelector('[data-sched-dow]')?.addEventListener('change', e => { draft.schedule.dayOfWeek = parseInt(e.target.value); });
  body.querySelector('[data-sched-dom]')?.addEventListener('input', e => { draft.schedule.dayOfMonth = parseInt(e.target.value) || 1; });

  /* Автоудаление */
  const adCheck = body.querySelector('[data-ad-enabled]');
  adCheck.checked = !!draft.autoDelete.enabled;
  adCheck.addEventListener('change', () => {
    draft.autoDelete.enabled = adCheck.checked;
    body.querySelector('[data-ad-group]').style.display = adCheck.checked ? 'block' : 'none';
  });
  body.querySelector('[data-ad-group]').style.display = draft.autoDelete.enabled ? 'block' : 'none';
  setVal('[data-ad-minutes]', draft.autoDelete.minutes || 60);
  body.querySelector('[data-ad-minutes]')?.addEventListener('change', e => {
    draft.autoDelete.minutes = parseInt(e.target.value);
  });

  /* Событие */
  const evCheck = body.querySelector('[data-ev-enabled]');
  evCheck.checked = !!draft.eventTime.enabled;
  evCheck.addEventListener('change', () => {
    draft.eventTime.enabled = evCheck.checked;
    body.querySelector('[data-ev-group]').style.display = evCheck.checked ? 'block' : 'none';
  });
  body.querySelector('[data-ev-group]').style.display = draft.eventTime.enabled ? 'block' : 'none';

  const evType = body.querySelector('[data-ev-type]');
  evType.querySelectorAll('input').forEach(r => {
    r.checked = r.value === draft.eventTime.type;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      draft.eventTime.type = r.value;
      body.querySelectorAll('.event-options').forEach(o => o.classList.toggle('active', o.dataset.for === r.value));
    });
  });
  body.querySelectorAll('.event-options').forEach(o => o.classList.toggle('active', o.dataset.for === draft.eventTime.type));

  const evTimeVal = draft.eventTime.time || '18:00';
  setVal('[data-ev-time]', evTimeVal);
  setVal('[data-ev-wt]', evTimeVal);
  setVal('[data-ev-mt]', evTimeVal);

  body.querySelector('[data-ev-time]')?.addEventListener('input', e => { draft.eventTime.time = e.target.value; });
  body.querySelector('[data-ev-wt]')?.addEventListener('input', e => { draft.eventTime.time = e.target.value; });
  body.querySelector('[data-ev-mt]')?.addEventListener('input', e => { draft.eventTime.time = e.target.value; });

  setVal('[data-ev-dow]', draft.eventTime.dayOfWeek || 1);
  setVal('[data-ev-dom]', draft.eventTime.dayOfMonth || 1);
  body.querySelector('[data-ev-dow]')?.addEventListener('change', e => { draft.eventTime.dayOfWeek = parseInt(e.target.value); });
  body.querySelector('[data-ev-dom]')?.addEventListener('input', e => { draft.eventTime.dayOfMonth = parseInt(e.target.value) || 1; });

  /* Упоминание */
  const menType = body.querySelector('[data-men-type]');
  menType.querySelectorAll('input').forEach(r => {
    r.checked = r.value === draft.mention.type;
    r.addEventListener('change', () => {
      if (!r.checked) return;
      draft.mention.type = r.value;
      body.querySelectorAll('.mention-options').forEach(o => o.classList.toggle('active', o.dataset.for === r.value));
    });
  });
  body.querySelectorAll('.mention-options').forEach(o => o.classList.toggle('active', o.dataset.for === draft.mention.type));

  bindRolePicker(body, { id: 'ann_mention_role', onSelect: (role) => { draft.mention.roleId = role?.id || ''; } });
  bindMemberPicker(body, { id: 'ann_mention_user', onSelect: (m) => { draft.mention.userId = m?.id || ''; } });

  /* Восстанавливаем значения role/user пикеров */
  if (draft.mention.roleId) {
    const role = state.roles.find(r => r.id === draft.mention.roleId);
    if (role) {
      const el = body.querySelector('[data-role-input="ann_mention_role"]');
      const hid = body.querySelector('[data-role-hidden="ann_mention_role"]');
      if (el) el.value = role.name;
      if (hid) hid.value = role.id;
    }
  }
  if (draft.mention.userId) {
    const m = state.members.find(x => x.id === draft.mention.userId);
    if (m) {
      const el = body.querySelector('[data-member-input="ann_mention_user"]');
      const hid = body.querySelector('[data-member-hidden="ann_mention_user"]');
      if (el) el.value = m.displayName;
      if (hid) hid.value = m.id;
    }
  }
}

/**
 * Собирает финальные значения из extras объявления.
 * @param {HTMLElement} body
 * @param {object} draft
 */
export function collectAnnouncementExtras(body, draft) {
  draft.name = body.querySelector('[data-msg-name]')?.value || draft.name;
  draft.enabled = body.querySelector('[data-ann-enabled]')?.checked ?? draft.enabled;
  const iconInput = body.querySelector('[data-ann-icon]');
  if (iconInput) draft.icon = iconInput.value.trim() || DEFAULT_ICON;
}

/* ============================================================
   Delayed
   ============================================================ */

/**
 * Черновик нового отложенного поста.
 * @returns {object}
 */
export function makeNewDelayedDraft() {
  return {
    id: 'del_' + uid(),
    name: '',
    channelId: '',
    config: { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] },
    publishAt: null,
    mention: { type: 'none', roleId: '', userId: '' },
    autoDelete: { enabled: false, minutes: 60 },
    lastSentAt: null,
    lastMessageId: null,
    isNew: true
  };
}

/**
 * HTML верхней панели + вкладок для отложки.
 * @param {string} context
 * @returns {{ top: string, tabs: string }}
 */
export function delayedExtrasHTML(context) {
  return {
    top: `
      <div class="form-group">
        <label>Название отложенного</label>
        <input class="input" data-msg-name placeholder="Например: Коворкинг ивент">
      </div>
      <div class="form-group">
        <label>Канал отправки</label>
        ${channelPickerHTML({ id: context + '_channel' })}
      </div>
    `,
    tabs: `
      <div class="card">
        <div class="card-header">
          <div><h2>Настройки отложки</h2></div>
        </div>
        <div class="card-body">
          <div class="form-section">
            <div class="form-section-title">Публикация</div>
            <div class="form-group">
              <label>Дата и время публикации</label>
              <input type="datetime-local" class="input" data-delay-publish>
              <span class="hint">После публикации сообщение не изменится</span>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">Автоудаление</div>
            <label style="display:flex;gap:10px;align-items:center;margin-bottom:14px;">
              <input type="checkbox" data-delay-ad-enabled> Удалять после отправки
            </label>
            <div class="form-group" data-delay-ad-group style="display:none;">
              <label>Через</label>
              <select class="input" data-delay-ad-minutes>
                <option value="5">5 мин</option><option value="10">10 мин</option><option value="15">15 мин</option>
                <option value="20">20 мин</option><option value="30">30 мин</option><option value="60" selected>1 ч</option>
                <option value="120">2 ч</option><option value="180">3 ч</option><option value="300">5 ч</option>
                <option value="360">6 ч</option><option value="480">8 ч</option><option value="720">12 ч</option>
                <option value="1440">1 д</option><option value="2880">2 д</option><option value="4320">3 д</option>
              </select>
            </div>
          </div>

          <div class="form-section">
            <div class="form-section-title">Упоминание</div>
            <div class="radio-group" data-delay-men-type>
              <label class="radio-row"><input type="radio" name="delay-men" value="none" checked><span>Не упоминать</span></label>
              <label class="radio-row"><input type="radio" name="delay-men" value="everyone"><span>@everyone</span></label>
              <label class="radio-row"><input type="radio" name="delay-men" value="role"><span>Роль</span></label>
              <label class="radio-row"><input type="radio" name="delay-men" value="user"><span>Пользователь</span></label>
            </div>
            <div class="mention-options" data-for="role">${rolePickerHTML({ id: 'delay_mention_role' })}</div>
            <div class="mention-options" data-for="user">${memberPickerHTML({ id: 'delay_mention_user' })}</div>
          </div>
        </div>
      </div>
    `
  };
}

/**
 * Навешивает обработчики на extras отложки.
 * @param {HTMLElement} body
 * @param {object} draft
 */
export function bindDelayedExtras(body, draft) {
  /* Дата публикации */
  const publishInput = body.querySelector('[data-delay-publish]');
  if (publishInput) {
    if (draft.publishAt) {
      const d = new Date(draft.publishAt);
      const pad = n => String(n).padStart(2, '0');
      publishInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    publishInput.addEventListener('input', () => {
      draft.publishAt = publishInput.value ? new Date(publishInput.value).toISOString() : null;
    });
  }

  /* Автоудаление */
  const adCheck = body.querySelector('[data-delay-ad-enabled]');
  if (adCheck) {
    adCheck.checked = !!draft.autoDelete.enabled;
    adCheck.addEventListener('change', () => {
      draft.autoDelete.enabled = adCheck.checked;
      body.querySelector('[data-delay-ad-group]').style.display = adCheck.checked ? 'block' : 'none';
    });
    body.querySelector('[data-delay-ad-group]').style.display = draft.autoDelete.enabled ? 'block' : 'none';
    body.querySelector('[data-delay-ad-minutes]').value = draft.autoDelete.minutes || 60;
    body.querySelector('[data-delay-ad-minutes]').addEventListener('change', e => {
      draft.autoDelete.minutes = parseInt(e.target.value);
    });
  }

  /* Упоминание */
  const menType = body.querySelector('[data-delay-men-type]');
  if (menType) {
    menType.querySelectorAll('input').forEach(r => {
      r.checked = r.value === draft.mention.type;
      r.addEventListener('change', () => {
        if (!r.checked) return;
        draft.mention.type = r.value;
        body.querySelectorAll('.mention-options').forEach(o => o.classList.toggle('active', o.dataset.for === r.value));
      });
    });
    body.querySelectorAll('.mention-options').forEach(o => o.classList.toggle('active', o.dataset.for === draft.mention.type));

    bindRolePicker(body, { id: 'delay_mention_role', onSelect: (role) => { draft.mention.roleId = role?.id || ''; } });
    bindMemberPicker(body, { id: 'delay_mention_user', onSelect: (m) => { draft.mention.userId = m?.id || ''; } });

    if (draft.mention.roleId) {
      const role = state.roles.find(r => r.id === draft.mention.roleId);
      if (role) {
        const el = body.querySelector('[data-role-input="delay_mention_role"]');
        const hid = body.querySelector('[data-role-hidden="delay_mention_role"]');
        if (el) el.value = role.name;
        if (hid) hid.value = role.id;
      }
    }
    if (draft.mention.userId) {
      const m = state.members.find(x => x.id === draft.mention.userId);
      if (m) {
        const el = body.querySelector('[data-member-input="delay_mention_user"]');
        const hid = body.querySelector('[data-member-hidden="delay_mention_user"]');
        if (el) el.value = m.displayName;
        if (hid) hid.value = m.id;
      }
    }
  }
}

/**
 * Собирает финальные значения из extras отложки.
 * @param {HTMLElement} body
 * @param {object} draft
 */
export function collectDelayedExtras(body, draft) {
  draft.name = body.querySelector('[data-msg-name]')?.value || draft.name;
  const publishInput = body.querySelector('[data-delay-publish]');
  if (publishInput) {
    draft.publishAt = publishInput.value ? new Date(publishInput.value).toISOString() : null;
  }
}