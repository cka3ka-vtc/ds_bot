import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, formatNumber, formatMembers } from '../utils.js';
import { toast, skeletonCards, emptyState } from '../ui.js';
import { startEvents, stopEvents } from '../events.js';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#5865f2,#8b5cf6)',
  'linear-gradient(135deg,#16a34a,#4ade80)',
  'linear-gradient(135deg,#db2777,#f472b6)',
  'linear-gradient(135deg,#d97706,#fbbf24)',
  'linear-gradient(135deg,#0891b2,#22d3ee)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)'
];

export async function renderServerSelect() {
  const grid = document.getElementById('serverGrid');
  grid.innerHTML = skeletonCards(3);
  try {
    const guilds = await api.guilds();
    if (!guilds.length) {
      grid.innerHTML = emptyState('<circle cx="12" cy="12" r="10"/>', 'Нет серверов', 'Добавьте бота на сервер');
      return;
    }
    grid.innerHTML = guilds.map((g, i) => {
      const initial = (g.name || '?').charAt(0).toUpperCase();
      const grad = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
      const avatarInner = g.icon ? `<img src="${g.icon}" alt="">` : initial;
      const statusBadge = g.status === 'active' ? '<span class="badge online">Активен</span>' : '<span class="badge offline">Выключен</span>';
      return `
        <button type="button" class="server-card" data-guild-id="${g.id}" aria-label="Открыть ${escapeHtml(g.name)}">
          <span class="server-glow-card" aria-hidden="true"></span>
          <div class="server-card-head">
            <div class="server-card-avatar" style="background:${grad}">${avatarInner}</div>
            <div>
              <div class="server-card-name">${escapeHtml(g.name)}</div>
              <div class="server-card-id">ID: ${g.id}</div>
            </div>
          </div>
          <div class="server-card-stats">
            <div class="server-stat"><span class="server-stat-value">${formatNumber(g.memberCount)}</span><span class="server-stat-label">Участников</span></div>
            <div class="server-stat"><span class="server-stat-value" data-online>—</span><span class="server-stat-label">Онлайн</span></div>
            <div class="server-stat"><span class="server-stat-value">${new Date(g.createdAt).toLocaleDateString('ru-RU')}</span><span class="server-stat-label">Создан</span></div>
          </div>
          <div class="server-card-footer">
            ${statusBadge}
            <span class="server-card-cta">Управлять <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
          </div>
        </button>
      `;
    }).join('');

    grid.querySelectorAll('[data-guild-id]').forEach(card => {
      card.addEventListener('click', () => enterGuild(card.dataset.guildId));
    });

    for (const g of guilds) {
      try {
        const detail = await api.guild(g.id);
        const el = grid.querySelector(`[data-guild-id="${g.id}"] [data-online]`);
        if (el) el.textContent = formatNumber(detail.onlineCount);
      } catch {}
    }
  } catch (e) {
    toast('Ошибка загрузки серверов: ' + e.message, { type: 'error' });
  }
}

export function updateCurrentServerUI() {
  const g = state.guild;
  if (!g) return;
  const av = document.getElementById('curAv');
  const initial = (g.name || '?').charAt(0).toUpperCase();
  if (g.icon) { av.innerHTML = `<img src="${g.icon}" alt="">`; av.style.background = 'transparent'; }
  else { av.innerHTML = initial; av.style.background = AVATAR_GRADIENTS[0]; }
  document.getElementById('curName').textContent = g.name;
  document.getElementById('curMembers').textContent = formatMembers(g.memberCount);
}

export async function enterGuild(guildId) {
  const { setGuildData, clearCollapsed } = await import('../state.js');
  const { renderRulesView } = await import('./rules.js');
  const { renderMessagesList } = await import('./messages.js');
  const { renderAnnouncementsList } = await import('./announcements.js');
  const { renderDelayedList } = await import('./delayed.js');
  const { renderAutodeleteList } = await import('./autodelete.js');
  const { renderBirthdaysView } = await import('./birthdays.js');
  const { renderLogsView } = await import('./logs.js');
  const { switchView } = await import('../main.js');
  const { updateBotStatus, updateLogsBadge } = await import('./helpers.js');

  try {
    state.guildId = guildId;
    clearCollapsed();
    const [guild, settings, rules, channels, roles, members, messagesData, announcementsData, delayedData, autodeleteData, birthdaysData, profilesData, logsData] = await Promise.all([
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
      settings: settings || { botEnabled: true, modules: { announcements: true, autodelete: true, birthdays: true, profiles: true } },
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

    document.getElementById('serverSelect').style.display = 'none';
    document.getElementById('app').style.display = 'block';

    updateCurrentServerUI();
    updateBotStatus();
    updateLogsBadge();
    renderRulesView();
    renderMessagesList();
    renderAnnouncementsList();
    renderDelayedList();
    renderAutodeleteList();
    renderBirthdaysView();

    switchView('dashboard');
    window.scrollTo({ top: 0, behavior: 'instant' });

    /* Запускаем SSE после того, как всё отрисовано */
    startEvents(guildId);
  } catch (e) {
    console.error('[enterGuild]', e);
    toast('Ошибка загрузки сервера: ' + e.message, { type: 'error' });
  }
}

function normalizeRules(rules) {
  const base = { channelId: '', displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] };
  if (!rules || typeof rules !== 'object') return base;
  const merged = { ...base, ...rules };
  if (!Array.isArray(merged.blocks)) merged.blocks = [];
  return merged;
}

function normalizeBirthdays(data) {
  const base = {
    settings: {
      time: '09:00', roleId: '', channelId: '', enabled: false, lastRunDate: null,
      roleRemoveNextDay: true, autoDeleteMessage: false,
      requiredRoleIds: [], _pending: []
    },
    users: [],
    template: {
      displayMode: 'embed-color', accentColor: '#5865F2',
      title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
      blocks: [{ id: 'bd-def-s', type: 'text', content: 'Поздравляем! 🎂 Тебе исполнилось **{age}**!' }]
    },
    templateNoYear: {
      displayMode: 'embed-color', accentColor: '#5865F2',
      title: 'С днём рождения, {user}!', subtitle: '', thumbnail: '',
      blocks: [{ id: 'bd-def-n', type: 'text', content: 'Поздравляем с днём рождения! 🎉 Всего наилучшего в новом году жизни!' }]
    }
  };
  if (!data || typeof data !== 'object') return base;

  const users = (Array.isArray(data.users) ? data.users : []).map(u => ({
    ...u,
    profile: u.profile || { vtc: '', steam: '', haulmp: '', truckersmp: '', companySince: null }
  }));

  return {
    settings: { ...base.settings, ...(data.settings || {}) },
    users,
    template: data.template || base.template,
    templateNoYear: data.templateNoYear || base.templateNoYear
  };
}

function normalizeProfiles(data) {
  const base = {
    settings: {
      channelId: '',
      requiredRoleIds: [],
      template: null
    }
  };
  if (!data || typeof data !== 'object') return base;

  const tpl = data.settings?.template;
  return {
    settings: {
      channelId: data.settings?.channelId || '',
      requiredRoleIds: Array.isArray(data.settings?.requiredRoleIds) ? data.settings.requiredRoleIds : [],
      template: (tpl && typeof tpl === 'object' && Array.isArray(tpl.blocks)) ? tpl : null
    }
  };
}

export function switchServer() {
  stopEvents();
  document.getElementById('app').style.display = 'none';
  document.getElementById('serverSelect').style.display = 'flex';
  renderServerSelect();
}