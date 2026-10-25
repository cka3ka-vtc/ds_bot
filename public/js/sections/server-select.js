/* ============================================================
   Экран выбора сервера + вход в гильдию.

   Отвечает за:
   - рендер карточек серверов с поиском
   - загрузку всех данных гильдии при входе (Promise.all)
   - запуск SSE и онбординга
   - нормализацию структуры данных (если на сервере
     старые данные без некоторых полей)
   ============================================================ */

import { api } from '../api.js';
import { state, setGuildData, clearCollapsed } from '../state.js';
import { escapeHtml, formatNumber, formatMembers } from '../utils.js';
import { toast, skeletonCards, emptyState } from '../ui.js';
import { startEvents, stopEvents } from '../events.js';
import { navigate } from '../router.js';
import { maybeShowWelcome } from '../welcome.js';

/* Градиенты для аватарок — циклически по индексу */
const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5865f2,#8b5cf6)',
  'linear-gradient(135deg,#16a34a,#4ade80)',
  'linear-gradient(135deg,#db2777,#f472b6)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)'
];

/* Кэш списка серверов и текущий поисковый запрос */
let allGuilds = [];
let searchQuery = '';

/* ============================================================
   Рендер экрана выбора
   ============================================================ */

export async function renderServerSelect() {
  const grid = document.getElementById('serverGrid');
  if (!grid) return;

  maybeShowWelcome(document.getElementById('serverSelect'));

  grid.innerHTML = skeletonCards(3);

  try {
    allGuilds = await api.guilds();

    if (!allGuilds.length) {
      grid.innerHTML = emptyState({
        icon: 'fa-server',
        title: 'Нет серверов',
        text: 'Добавьте бота на сервер через Discord Developer Portal.'
      });
      return;
    }

    renderGuilds();
    bindSearch();
  } catch (e) {
    console.error('[server-select]', e);
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3 class="empty-state-title">Ошибка</h3>
        <p class="empty-state-text">${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}

/**
 * Перерисовывает карточки с учётом поиска.
 */
function renderGuilds() {
  const grid = document.getElementById('serverGrid');
  if (!grid) return;

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? allGuilds.filter(g => g.name.toLowerCase().includes(q) || g.id.includes(q))
    : allGuilds;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
        <h3 class="empty-state-title">Ничего не найдено</h3>
        <p class="empty-state-text">Попробуйте другой запрос</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map((g, i) => {
    const initial = (g.name || '?').charAt(0).toUpperCase();
    const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
    const avatarInner = g.icon ? `<img src="${g.icon}" alt="">` : initial;
    const statusBadge = g.status === 'active'
      ? '<span class="badge online">Активен</span>'
      : '<span class="badge offline">Выключен</span>';

    return `
      <button type="button" class="server-card" data-guild-id="${g.id}">
        <span class="server-glow-card" aria-hidden="true"></span>
        <div class="server-card-head">
          <div class="server-card-avatar" style="background:${grad}">${avatarInner}</div>
          <div>
            <div class="server-card-name">${escapeHtml(g.name)}</div>
            <div class="server-card-id">ID: ${g.id}</div>
          </div>
        </div>
        <div class="server-card-stats">
          <div class="server-stat">
            <span class="server-stat-value">${formatNumber(g.memberCount)}</span>
            <span class="server-stat-label">Участников</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value" data-online>—</span>
            <span class="server-stat-label">Онлайн</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value">${new Date(g.createdAt).toLocaleDateString('ru-RU')}</span>
            <span class="server-stat-label">Создан</span>
          </div>
        </div>
        <div class="server-card-footer">
          ${statusBadge}
          <span class="server-card-cta">Открыть <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </button>
    `;
  }).join('');

  grid.querySelectorAll('[data-guild-id]').forEach(card => {
    card.addEventListener('click', () => navigate(card.dataset.guildId, 'dashboard'));
  });

  /* Догружаем online-счётчик асинхронно */
  for (const g of filtered) {
    api.guild(g.id).then(detail => {
      const el = grid.querySelector(`[data-guild-id="${g.id}"] [data-online]`);
      if (el) el.textContent = formatNumber(detail.onlineCount);
    }).catch(() => {});
  }
}

function bindSearch() {
  const input = document.getElementById('serverSearchInput');
  if (!input || input._bound) return;
  input._bound = true;
  input.addEventListener('input', () => {
    searchQuery = input.value;
    renderGuilds();
  });
}

/* ============================================================
   Текущий сервер в сайдбаре
   ============================================================ */

export function updateCurrentServerUI() {
  const g = state.guild;
  if (!g) return;

  const av = document.getElementById('curAv');
  const initial = (g.name || '?').charAt(0).toUpperCase();

  if (g.icon) {
    av.innerHTML = `<img src="${g.icon}" alt="">`;
    av.style.background = 'transparent';
  } else {
    av.innerHTML = initial;
    av.style.background = AVATAR_GRADIENTS[0];
  }

  document.getElementById('curName').textContent = g.name;
  document.getElementById('curMembers').textContent = formatMembers(g.memberCount);
}

/* ============================================================
   Вход в гильдию
   ============================================================ */

/**
 * Загружает все данные гильдии параллельно и заполняет state.
 * @param {string} guildId
 */
export async function enterGuild(guildId) {
  if (!guildId) return;

  try {
    state.guildId = guildId;
    clearCollapsed();

    /* Загружаем всё параллельно — ошибки отдельных запросов не критичны */
    const [
      guild, settings, rules, channels, roles, members,
      messagesData, announcementsData, delayedData, autodeleteData,
      birthdaysData, profilesData, logsData
    ] = await Promise.all([
      api.guild(guildId),
      api.getData(guildId, 'settings').catch(() => null),
      api.getData(guildId, 'rules').catch(() => null),
      api.channels(guildId).catch(() => []),
      api.roles(guildId).catch(() => []),
      api.members(guildId).catch(() => []),
      api.getData(guildId, 'messages').catch(() => null),
      api.getData(guildId, 'announcements').catch(() => null),
      api.getData(guildId, 'delayed').catch(() => null),
      api.getData(guildId, 'autodelete').catch(() => null),
      api.getData(guildId, 'birthdays').catch(() => null),
      api.getData(guildId, 'profiles').catch(() => null),
      api.logs(guildId).catch(() => ({ items: [], groups: [] }))
    ]);

    setGuildData({
      guild,
      settings: settings || {
        botEnabled: true,
        modules: { announcements: true, autodelete: true, birthdays: true, profiles: true }
      },
      rules: normalizeRules(rules),
      channels: channels || [],
      roles: roles || [],
      members: members || [],
      messages: messagesData?.items || [],
      announcements: announcementsData?.items || [],
      delayed: delayedData?.items || [],
      autodelete: autodeleteData?.items || [],
      birthdays: normalizeBirthdays(birthdaysData),
      profiles: normalizeProfiles(profilesData),
      logs: logsData.items || []
    });

    /* Переключаем экраны */
    document.getElementById('serverSelect').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    /* Шапка */
    updateCurrentServerUI();
    const helpers = await import('./helpers.js');
    helpers.updateBotStatus();
    helpers.updateLogsBadge();

    /* Предзагружаем основные секции.
       ВАЖНО: имена модулей с суффиксом "Module" — иначе конфликт
       с переменными из Promise.all (rules, messages, announcements…). */
    const rulesModule = await import('./rules.js');
    const messagesModule = await import('./messages.js');
    const announcementsModule = await import('./announcements.js');
    const delayedModule = await import('./delayed.js');
    const autodeleteModule = await import('./autodelete.js');
    const birthdaysModule = await import('./birthdays.js');

    const safeRender = async (fn) => {
      try { await fn(); }
      catch (e) { console.error('[enterGuild] render failed:', e); }
    };

    await safeRender(() => rulesModule.renderRulesView());
    await safeRender(() => messagesModule.renderMessagesList());
    await safeRender(() => announcementsModule.renderAnnouncementsList());
    await safeRender(() => delayedModule.renderDelayedList());
    await safeRender(() => autodeleteModule.renderAutodeleteList());
    await safeRender(() => birthdaysModule.renderBirthdaysView());

    /* SSE + онбординг */
    startEvents(guildId);

    try {
      const { maybeShowOnboarding } = await import('../onboarding.js');
      const { switchView } = await import('../main.js');
      await maybeShowOnboarding(switchView);
    } catch (e) {
      console.warn('[enterGuild] onboarding:', e);
    }
  } catch (e) {
    console.error('[enterGuild]', e);
    toast('Ошибка загрузки: ' + e.message, { type: 'error' });
  }
}

/* ============================================================
   Нормализация данных (защита от старых форматов)
   ============================================================ */

function normalizeRules(r) {
  const base = {
    channelId: '',
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: []
  };
  if (!r || typeof r !== 'object') return base;
  const m = { ...base, ...r };
  if (!Array.isArray(m.blocks)) m.blocks = [];
  return m;
}

function normalizeBirthdays(d) {
  const base = {
    settings: {
      time: '09:00', roleId: '', channelId: '', enabled: false, lastRunDate: null,
      roleRemoveNextDay: true, autoDeleteMessage: false,
      requiredRoleIds: [], _pending: []
    },
    users: [],
    template: null,
    templateNoYear: null
  };
  if (!d || typeof d !== 'object') return base;

  return {
    settings: { ...base.settings, ...(d.settings || {}) },
    users: Array.isArray(d.users)
      ? d.users.map(u => ({
        ...u,
        profile: u.profile || { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null }
      }))
      : [],
    template: d.template || base.template,
    templateNoYear: d.templateNoYear || base.templateNoYear
  };
}

function normalizeProfiles(d) {
  const base = { settings: { channelId: '', requiredRoleIds: [], template: null } };
  if (!d || typeof d !== 'object') return base;

  const tpl = d.settings?.template;
  return {
    settings: {
      channelId: d.settings?.channelId || '',
      requiredRoleIds: Array.isArray(d.settings?.requiredRoleIds) ? d.settings.requiredRoleIds : [],
      template: (tpl && typeof tpl === 'object' && Array.isArray(tpl.blocks)) ? tpl : null
    }
  };
}

/* ============================================================
   Выход на главную
   ============================================================ */

export function switchServer() {
  stopEvents();
  navigate(null, null);
}