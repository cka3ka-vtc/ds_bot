/* ============================================================
   Чек-лист настройки на дашборде.

   Показывает прогресс: какие каналы и роли уже выбраны,
   есть ли контент. Пользователь видит, что осталось.

   Скрывается автоматически при 100% или вручную.
   ============================================================ */

import { state } from './state.js';

const HIDE_KEY = (guildId) => `checklist_hidden_${guildId}`;

/**
 * Считает прогресс настройки по данным гильдии.
 * @returns {{ items: Array, total: number, completed: number }}
 */
export function computeChecklist() {
  const g = state;

  const items = [
    {
      id: 'rules-channel',
      label: 'Канал для правил',
      value: g.rules?.channelId ? findChannelName(g.rules.channelId) : null,
      done: !!g.rules?.channelId,
      goto: 'rules'
    },
    {
      id: 'rules-sent',
      label: 'Правила отправлены',
      value: g.rules?.lastSentAt
        ? new Date(g.rules.lastSentAt).toLocaleDateString('ru-RU')
        : null,
      done: !!g.rules?.lastSentAt,
      goto: 'rules'
    },
    {
      id: 'profiles-channel',
      label: 'Канал для профилей',
      value: g.profiles?.settings?.channelId ? findChannelName(g.profiles.settings.channelId) : null,
      done: !!g.profiles?.settings?.channelId,
      goto: 'profiles'
    },
    {
      id: 'birthdays-channel',
      label: 'Канал для ДР',
      value: g.birthdays?.settings?.channelId ? findChannelName(g.birthdays.settings.channelId) : null,
      done: !!g.birthdays?.settings?.channelId,
      goto: 'birthdays'
    },
    {
      id: 'birthdays-role',
      label: 'Роль именинника',
      value: g.birthdays?.settings?.roleId ? findRoleName(g.birthdays.settings.roleId) : null,
      done: !!g.birthdays?.settings?.roleId,
      goto: 'birthdays'
    },
    {
      id: 'content',
      label: 'Хотя бы один контент-элемент',
      value: ((g.messages?.length || 0) + (g.announcements?.length || 0)) + ' шт',
      done: ((g.messages?.length || 0) + (g.announcements?.length || 0)) > 0,
      goto: 'messages'
    }
  ];

  const completed = items.filter(i => i.done).length;
  return { items, total: items.length, completed };
}

function findChannelName(id) {
  const ch = state.channels.find(c => c.id === id);
  return ch ? `#${ch.name}` : id;
}

function findRoleName(id) {
  const r = state.roles.find(x => x.id === id);
  return r ? r.name : id;
}

/**
 * Возвращает HTML чек-листа. Пустая строка — если всё готово
 * или чек-лист скрыт пользователем.
 */
export function buildOnboardingChecklist() {
  const guildId = state.guildId;
  if (!guildId) return '';
  if (localStorage.getItem(HIDE_KEY(guildId)) === '1') return '';

  const { items, total, completed } = computeChecklist();
  if (completed === total) return '';

  const pct = Math.round((completed / total) * 100);

  return `
    <div class="checklist" data-checklist>
      <div class="checklist-header">
        <div>
          <h3><i class="fa-solid fa-rocket"></i> Настройка сервера</h3>
          <span class="checklist-progress-text">${completed} из ${total} готово</span>
        </div>
        <div class="checklist-header-right">
          <div class="checklist-progress" aria-hidden="true"><span style="width:${pct}%"></span></div>
          <button class="btn btn-ghost btn-xs" data-hide-checklist title="Скрыть">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <ul class="checklist-items">
        ${items.map(it => `
          <li class="checklist-item ${it.done ? 'done' : ''}">
            <span class="checklist-check">
              <i class="fa-solid ${it.done ? 'fa-circle-check' : 'fa-circle'}"></i>
            </span>
            <span class="checklist-label">${it.label}</span>
            <span class="checklist-value">${it.value || '—'}</span>
            ${!it.done ? `<button class="checklist-action" data-goto="${it.goto}">Настроить <i class="fa-solid fa-arrow-right"></i></button>` : ''}
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

/**
 * Вешает обработчики на чек-лист. Вызывать после вставки HTML.
 * @param {HTMLElement} root
 */
export function bindChecklist(root) {
  const el = root.querySelector('[data-checklist]');
  if (!el) return;

  el.querySelector('[data-hide-checklist]')?.addEventListener('click', () => {
    const guildId = state.guildId;
    if (guildId) localStorage.setItem(HIDE_KEY(guildId), '1');
    el.remove();
  });

  el.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { navigate } = await import('./router.js');
      navigate(state.guildId, btn.dataset.goto);
    });
  });
}

/**
 * Сбрасывает «скрыто» (для настроек).
 * @param {string} guildId
 */
export function resetChecklistHidden(guildId) {
  localStorage.removeItem(HIDE_KEY(guildId));
}