// public/assets/js/app.js
import { api } from './core/api.js';
import { store } from './core/store.js';
import { Router } from './core/router.js';
import { initTheme } from './core/theme.js';
import { initGlobalTooltips } from './core/tooltip.js';
import { toast } from './core/toast.js';
import { renderSidebar } from './components/sidebar.js';
import { renderTopbar } from './components/topbar.js';

import overview from './views/overview/index.js';
import modules from './views/modules.js';
import bots from './views/bots.js';
import moderation from './views/moderation/index.js';
import commands from './views/commands/index.js';
import members from './views/members.js';
import settings from './views/settings/index.js';
import servers from './views/servers.js';

async function boot() {
  let user;
  try {
    user = await api.get('/auth/me');
  } catch {
    location.href = '/auth.html';
    return;
  }
  store.set('user', user);

  handleBotCallbackResult();

  const botsList = await api.get('/api/bots');
  store.set('bots', botsList);

  const savedBot = localStorage.getItem('activeBotId');
  const activeBotId =
    botsList.find((b) => b.id === savedBot)?.id || botsList[0]?.id || null;
  store.set('activeBotId', activeBotId);

  if (activeBotId) {
    const guilds = await loadGuilds(activeBotId);
    store.set('guilds', guilds);

    const savedGuild = localStorage.getItem('activeGuildId');
    const activeGuildId =
      guilds.find((g) => g.id === savedGuild)?.id || guilds[0]?.id || null;
    store.set('activeGuildId', activeGuildId);

    if (activeGuildId) await refreshModulesCount(activeBotId, activeGuildId);
  }

  initTheme();
  initGlobalTooltips();

  renderSidebar(document.getElementById('sidebar'));
  renderTopbar(document.getElementById('topbar'));

  installGlobalUiHandlers();

  const router = new Router({
    container: document.getElementById('viewRoot'),
    views: { overview, modules, bots, moderation, commands, members, settings, servers },
    defaultView: 'overview',
  });
  window.__router = router;

  store.subscribe(async (key, value) => {
    if (key === 'activeBotId') {
      const guilds = await loadGuilds(value);
      store.set('guilds', guilds);
      const first = guilds[0]?.id || null;
      store.set('activeGuildId', first);
      try { if (first) localStorage.setItem('activeGuildId', first); } catch {}
      if (first) await refreshModulesCount(value, first);
    }
    if (key === 'activeGuildId') {
      const botId = store.get('activeBotId');
      if (botId && value) await refreshModulesCount(botId, value);
      router.rerender();
    }
  });
}

/** Глобальные клики: мобильное меню, оверлей сайдбара */
function installGlobalUiHandlers() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('#menuToggle')) {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebarOverlay')?.classList.toggle('show');
      return;
    }
    if (e.target.closest('#sidebarOverlay')) {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('show');
    }
  });
}

async function refreshModulesCount(botId, guildId) {
  try {
    const list = await api.get(`/api/modules?botId=${botId}&guildId=${guildId}`);
    store.set('modulesEnabledCount', list.filter((m) => m.enabled).length);
  } catch {}
}

function handleBotCallbackResult() {
  const params = new URLSearchParams(location.search);
  const added = params.get('added');
  const error = params.get('error');

  if (added === '1') {
    toast('Бот успешно добавлен на сервер!', 'success');
    if (!location.hash || location.hash === '#overview') location.hash = 'bots';
    history.replaceState(null, '', location.pathname + location.hash);
  }
  if (error) {
    const messages = {
      invalid_state: 'Сессия OAuth истекла. Попробуйте снова.',
      token_exchange: 'Не удалось обменять код на токен.',
      access_denied: 'Вы отменили добавление бота.',
      no_main_bot: 'Главный бот ещё не запущен.',
      unknown: 'Неизвестная ошибка.',
    };
    toast(messages[error] || 'Ошибка: ' + error, 'error');
    if (!location.hash || location.hash === '#overview') location.hash = 'bots';
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

async function loadGuilds(botId) {
  try { return await api.get(`/api/guilds?botId=${botId}`); }
  catch { return []; }
}

boot().catch((err) => {
  console.error('boot failed:', err);
  document.getElementById('viewRoot').innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <strong>Не удалось загрузить панель</strong>
      <span>${err.message || 'Обновите страницу'}</span>
    </div>`;
});