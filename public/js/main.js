/* ============================================================
   Точка входа панели.

   Здесь:
   - инициализация (bot-info, список серверов)
   - hash-роутер (переход между разделами)
   - обработчики кнопок в шапке
   - статус бота в сайдбаре (ping каждые 15 с)
   ============================================================ */

import { api } from './api.js';
import { state, resetState } from './state.js';
import { toast } from './ui.js';
import { navigate, onRouteChange, parseHash } from './router.js';
import { escapeHtml } from './utils.js';

/* ============================================================
   Метаданные разделов (заголовок + подзаголовок)
   ============================================================ */

const PAGE_META = {
  dashboard:     { title: 'Дашборд',         sub: 'Обзорная статистика и активность' },
  rules:         { title: 'Правила и роли',  sub: 'Правила сервера и выдача ролей' },
  messages:      { title: 'Сообщения',       sub: 'Закреплённые сообщения для каналов' },
  announcements: { title: 'Объявления',      sub: 'Периодические сообщения по расписанию' },
  delayed:       { title: 'Отложенные',      sub: 'Отправка сообщений в заданный момент' },
  autodelete:    { title: 'Автоудаление',    sub: 'Автоматическая очистка каналов' },
  birthdays:     { title: 'Дни рождения',    sub: 'Поздравления и выдача ролей' },
  profiles:      { title: 'Профили',         sub: 'Информация о пользователях' },
  commands:      { title: 'Команды',         sub: 'Доступность и права' },
  settings:      { title: 'Настройки',       sub: 'Боты, статус и поведение' },
  logs:          { title: 'Логи',            sub: 'Журнал действий и работ бота' }
};

/* Какую «создать»-кнопку показывать в каждом разделе */
const CREATE_BTN = {
  messages:      'createMessageBtn',
  announcements: 'createAnnouncementBtn',
  delayed:       'createDelayedBtn',
  autodelete:    'createAutodeleteBtn',
  profiles:      'createProfileBtn'
};
const ALL_CREATE = [
  'createMessageBtn', 'createAnnouncementBtn', 'createDelayedBtn',
  'createAutodeleteBtn', 'createProfileBtn'
];

/* Разделы, для которых есть история версий */
const BACKUP_SECTIONS = new Set([
  'rules', 'messages', 'announcements', 'delayed',
  'autodelete', 'birthdays', 'profiles'
]);

/* ============================================================
   Переключение раздела
   ============================================================ */

/**
 * Показывает один раздел и обновляет topbar.
 * @param {string} name
 */
export function switchView(name) {
  state.currentSection = name;

  /* Sidebar */
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.view === name);
  });

  /* Views */
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.id === 'view-' + name);
  });

  /* Topbar title */
  const meta = PAGE_META[name] || PAGE_META.dashboard;
  document.getElementById('pageTitle').textContent = meta.title;
  document.getElementById('pageSub').textContent = meta.sub;

  /* Кнопки «создать» */
  ALL_CREATE.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (CREATE_BTN[name]) {
    const el = document.getElementById(CREATE_BTN[name]);
    if (el) el.style.display = 'inline-flex';
  }

  /* Кнопки «экспорт/импорт/отправить» — только для правил */
  const isRules = name === 'rules';
  document.getElementById('exportBtn').style.display = isRules ? 'inline-flex' : 'none';
  document.getElementById('importBtn').style.display = isRules ? 'inline-flex' : 'none';
  document.getElementById('sendRulesBtn').style.display = isRules ? 'inline-flex' : 'none';

  /* «Сохранить» */
  const saveShow = ['rules', 'birthdays', 'profiles', 'commands'].includes(name);
  document.getElementById('saveBtn').style.display = saveShow ? 'inline-flex' : 'none';

  /* «История» */
  const histBtn = document.getElementById('historyBtn');
  if (histBtn) histBtn.style.display = BACKUP_SECTIONS.has(name) ? 'inline-flex' : 'none';

  /* На мобилке закрываем сайдбар */
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');

  /* Ленивая загрузка содержимого */
  const loaders = {
    dashboard:     () => import('./sections/dashboard.js').then(m => m.renderDashboard()),
    rules:         () => import('./sections/rules.js').then(m => m.renderRulesView()),
    messages:      () => import('./sections/messages.js').then(m => m.renderMessagesList()),
    announcements: () => import('./sections/announcements.js').then(m => m.renderAnnouncementsList()),
    delayed:       () => import('./sections/delayed.js').then(m => m.renderDelayedList()),
    autodelete:    () => import('./sections/autodelete.js').then(m => m.renderAutodeleteList()),
    birthdays:     () => import('./sections/birthdays.js').then(m => m.renderBirthdaysView()),
    profiles:      () => import('./sections/profiles.js').then(m => m.renderProfilesView()),
    commands:      () => import('./sections/commands.js').then(m => m.renderCommandsView()),
    settings:      () => import('./sections/settings.js').then(m => m.renderSettingsView()),
    logs:          () => import('./sections/logs.js').then(m => m.renderLogsView())
  };

  loaders[name]?.()?.catch(e => {
    console.error(`[main] render ${name}:`, e);
    toast(`Ошибка загрузки раздела: ${e.message}`, { type: 'error' });
  });
}

/* ============================================================
   Роутер
   ============================================================ */

/**
 * Применяет маршрут: показывает либо экран выбора, либо панель.
 * @param {{ guildId: string|null, section: string|null }} route
 */
async function applyRoute(route) {
  /* Нет гильдии — экран выбора */
  if (!route.guildId) {
    resetState();
    document.getElementById('app').style.display = 'none';
    document.getElementById('serverSelect').style.display = 'flex';

    const { renderServerSelect } = await import('./sections/server-select.js');
    renderServerSelect();
    return;
  }

  /* Гильдия есть, но данные ещё не загружены — загружаем */
  if (state.guildId !== route.guildId) {
    const { enterGuild } = await import('./sections/server-select.js');
    await enterGuild(route.guildId);
  } else {
    /* Данные в памяти — просто показываем app */
    document.getElementById('serverSelect').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  }

  switchView(route.section || 'dashboard');
}

onRouteChange(applyRoute);

/* ============================================================
   Инициализация
   ============================================================ */

(async () => {
  /* Инфо о боте */
  try { state.bot = await api.botInfo(); }
  catch { state.bot = { username: 'Ckaзka Dev', avatar: null }; }

  /* Список серверов */
  try {
    const { renderServerSelect } = await import('./sections/server-select.js');
    await renderServerSelect();
  } catch (e) {
    console.error('[main] renderServerSelect failed:', e);
    const grid = document.getElementById('serverGrid');
    if (grid) {
      grid.innerHTML = `<div class="empty-state"><p>Ошибка загрузки серверов</p><span>${escapeHtml(e.message)}</span></div>`;
    }
  }

  await refreshBotStats();

  /* Если в URL есть гильдия — сразу туда */
  const initial = parseHash();
  if (initial.guildId) await applyRoute(initial);
})();

/* ============================================================
   Статистика бота
   ============================================================ */

async function refreshBotStats() {
  try {
    const stats = await api.botStats();
    const $ = (id) => document.getElementById(id);
    if ($('statGuilds')) $('statGuilds').textContent = stats.guilds ?? '—';
    if ($('statUsers'))  $('statUsers').textContent  = stats.users  ?? '—';
    if ($('statPing'))   $('statPing').textContent   = stats.ping >= 0 ? stats.ping : '—';
    if ($('statUptime')) $('statUptime').textContent = formatUptime(stats.uptimeMs);
  } catch {}
}

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

setInterval(refreshBotStats, 30_000);

/* ============================================================
   Навигация
   ============================================================ */

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    if (!state.guildId) return;
    navigate(state.guildId, item.dataset.view);
  });
});

document.getElementById('currentServerBtn').addEventListener('click', () => {
  navigate(null, null);
});

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});

document.getElementById('overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
});

/* ============================================================
   Кнопки в шапке
   ============================================================ */

document.getElementById('saveBtn').addEventListener('click', async () => {
  const s = state.currentSection;
  try {
    if (s === 'rules') {
      const m = await import('./sections/rules.js');
      m.saveRules();
    } else if (s === 'birthdays') {
      const m = await import('./sections/birthdays.js');
      m.saveBirthdays();
    } else if (s === 'profiles') {
      const m = await import('./sections/profiles.js');
      m.saveProfiles();
    } else if (s === 'commands') {
      const m = await import('./sections/commands.js');
      m.saveCommands();
    }
  } catch (e) {
    toast('Ошибка сохранения: ' + e.message, { type: 'error' });
  }
});

document.getElementById('sendRulesBtn').addEventListener('click', async () => {
  try {
    const m = await import('./sections/rules.js');
    m.triggerSendRules();
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  if (!state.guildId) return;
  const url = `${location.origin}${location.pathname}#/guilds/${state.guildId}/${state.currentSection}`;
  navigator.clipboard?.writeText(url)
    .then(() => toast('Ссылка скопирована'))
    .catch(() => toast(url, { duration: 8000 }));
});

document.getElementById('historyBtn').addEventListener('click', async () => {
  const section = state.currentSection;
  if (!BACKUP_SECTIONS.has(section)) return;
  try {
    const { openBackupsModal } = await import('./backups.js');
    await openBackupsModal(section);
  } catch (e) {
    toast('Модуль истории не загружен: ' + e.message, { type: 'error' });
  }
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const m = await import('./sections/rules.js');
    const ed = m.getRulesEditor();
    if (!ed) return;
    const { downloadJSON } = await import('./utils.js');
    const safeName = (state.guild?.name || 'guild').replace(/[^a-z0-9]/gi, '_');
    downloadJSON(ed.getConfig(), `${safeName}_rules.json`);
    toast('JSON экспортирован');
  } catch (e) {
    toast('Ошибка экспорта: ' + e.message, { type: 'error' });
  }
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const { pickJSONFile } = await import('./utils.js');
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран', { type: 'error' });

  /* Валидация через сервер */
  try {
    const r = await api.validateData(state.guildId, 'rules', data);
    if (!r.ok) {
      const lines = r.errors.slice(0, 4).map(e => `• ${e.path || 'root'}: ${e.message}`).join('\n');
      return toast(`Файл не прошёл валидацию:\n${lines}`, { type: 'error', duration: 8000 });
    }
  } catch (e) {
    return toast('Ошибка валидации: ' + e.message, { type: 'error' });
  }

  try {
    const m = await import('./sections/rules.js');
    state.rules = m.normalizeRules(data);
    m.renderRulesView();
    await api.setData(state.guildId, 'rules', state.rules);
    toast('Правила импортированы');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
});

/* ============================================================
   Кнопки «Создать»
   ============================================================ */

document.getElementById('createMessageBtn').addEventListener('click', async () => {
  const m = await import('./sections/messages.js');
  m.createMessageFlow();
});

document.getElementById('createAnnouncementBtn').addEventListener('click', async () => {
  const m = await import('./sections/announcements.js');
  m.createAnnouncementFlow();
});

document.getElementById('createDelayedBtn').addEventListener('click', async () => {
  const m = await import('./sections/delayed.js');
  m.createDelayedFlow();
});

document.getElementById('createAutodeleteBtn').addEventListener('click', async () => {
  const m = await import('./sections/autodelete.js');
  m.createAutodeleteFlow();
});

document.getElementById('createProfileBtn').addEventListener('click', async () => {
  const m = await import('./sections/profiles.js');
  m.createProfileFlow();
});

document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  const m = await import('./sections/logs.js');
  m.clearAllLogs();
});

/* ============================================================
   Ctrl+S
   ============================================================ */

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && state.guildId) {
    e.preventDefault();
    document.getElementById('saveBtn')?.click();
  }
});

/* ============================================================
   beforeunload
   ============================================================ */

window.addEventListener('beforeunload', (e) => {
  if (!document.querySelector('.modal .unsaved-dot')) return;
  e.preventDefault();
  e.returnValue = '';
});

/* ============================================================
   Автообновление статуса бота в сайдбаре
   ============================================================ */

setInterval(async () => {
  try {
    const stats = await api.botStats();
    const el = document.getElementById('botStatus');
    const txt = document.getElementById('botStatusText');
    const ping = document.getElementById('botStatusPing');
    if (!el || !txt) return;

    el.classList.toggle('on', stats.online);
    txt.textContent = stats.online ? (stats.tag || 'Подключён') : 'Выключен';
    if (ping) ping.textContent = stats.online && stats.ping >= 0 ? `${stats.ping} мс` : '';
  } catch {}
}, 15_000);

/* ============================================================
   Закрытие dropdown-менюшек по клику снаружи
   ============================================================ */

document.addEventListener('click', (e) => {
  if (!e.target.closest('.actions-dropdown')) {
    document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
  }
});