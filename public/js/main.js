import { api } from './api.js';
import { state } from './state.js';
import { toast } from './ui.js';
import { renderServerSelect, switchServer } from './sections/server-select.js';
import { saveRules, getRulesEditor, triggerSendRules } from './sections/rules.js';
import { createMessageFlow } from './sections/messages.js';
import { createAnnouncementFlow } from './sections/announcements.js';
import { createDelayedFlow } from './sections/delayed.js';
import { createAutodeleteFlow } from './sections/autodelete.js';
import { saveBirthdays } from './sections/birthdays.js';
import { saveProfiles } from './sections/profiles.js';
import { clearAllLogs } from './sections/logs.js';
import { downloadJSON, pickJSONFile } from './utils.js';

const PAGE_META = {
  dashboard:     { title: 'Дашборд', sub: 'Обзор активности и статистика сервера' },
  rules:         { title: 'Правила', sub: 'Описание правил сервера, и выдача ролей' },
  messages:      { title: 'Сообщения', sub: 'Закрепленное сообщение для канала' },
  announcements: { title: 'Анонсы', sub: 'Автоматические сообщения по расписанию' },
  delayed:       { title: 'Отложенные', sub: 'Автоматическая отправка отложенных сообщений' },
  autodelete:    { title: 'Автоудаление', sub: 'Автоматическое удаление сообщений в канале' },
  birthdays:     { title: 'Дни рождения', sub: 'Поздравления и ближайшие события' },
  profiles:      { title: 'Пользователи', sub: 'Профили, ссылки и информация о вступлении' },
  logs:          { title: 'Логи', sub: 'Журнал действий и работы бота' }
};

const CREATE_BTN_BY_SECTION = {
  messages: 'createMessageBtn',
  announcements: 'createAnnouncementBtn',
  delayed: 'createDelayedBtn',
  autodelete: 'createAutodeleteBtn',
  profiles: 'createProfileBtn'
};

const ALL_CREATE_BTNS = [
  'createMessageBtn', 'createAnnouncementBtn', 'createDelayedBtn',
  'createAutodeleteBtn', 'createProfileBtn'
];

export function switchView(name) {
  state.currentSection = name;
  document.querySelectorAll('.nav-item').forEach(i => {
    const active = i.dataset.view === name;
    i.classList.toggle('active', active);
    if (active) i.setAttribute('aria-current', 'page');
    else i.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  const meta = PAGE_META[name];
  if (meta) {
    document.getElementById('pageTitle').textContent = meta.title;
    document.getElementById('pageSub').textContent = meta.sub;
  }

  ALL_CREATE_BTNS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const createId = CREATE_BTN_BY_SECTION[name];
  if (createId) {
    const el = document.getElementById(createId);
    if (el) el.style.display = 'inline-flex';
  }

  const rulesShow = name === 'rules' ? 'inline-flex' : 'none';
  document.getElementById('exportBtn').style.display = rulesShow;
  document.getElementById('importBtn').style.display = rulesShow;
  document.getElementById('sendRulesBtn').style.display = rulesShow;

  const saveShow = (name === 'rules' || name === 'birthdays' || name === 'profiles') ? 'inline-flex' : 'none';
  document.getElementById('saveBtn').style.display = saveShow;

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');

  if (name === 'dashboard') import('./sections/dashboard.js').then(m => m.renderDashboard());
  if (name === 'messages') import('./sections/messages.js').then(m => m.renderMessagesList());
  if (name === 'announcements') import('./sections/announcements.js').then(m => m.renderAnnouncementsList());
  if (name === 'delayed') import('./sections/delayed.js').then(m => m.renderDelayedList());
  if (name === 'autodelete') import('./sections/autodelete.js').then(m => m.renderAutodeleteList());
  if (name === 'birthdays') import('./sections/birthdays.js').then(m => m.renderBirthdaysView());
  if (name === 'profiles') import('./sections/profiles.js').then(m => m.renderProfilesView());
  if (name === 'logs') import('./sections/logs.js').then(m => m.renderLogsView());
}

(async () => {
  try { state.bot = await api.botInfo(); }
  catch { state.bot = { username: 'Ckaзka Dev', avatar: null }; }
  renderServerSelect();
})();

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(item.dataset.view);
  });
});

document.getElementById('currentServerBtn').addEventListener('click', switchServer);

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});
document.getElementById('overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
});

document.getElementById('saveBtn').addEventListener('click', () => {
  if (state.currentSection === 'rules') return saveRules();
  if (state.currentSection === 'birthdays') return saveBirthdays();
  if (state.currentSection === 'profiles') return saveProfiles();
});

document.getElementById('sendRulesBtn').addEventListener('click', () => triggerSendRules());

document.getElementById('exportBtn').addEventListener('click', () => {
  const ed = getRulesEditor();
  if (!ed) return;
  downloadJSON(ed.getConfig(), `${(state.guild?.name || 'guild').replace(/[^a-z0-9]/gi,'_')}_rules.json`);
  toast('JSON экспортирован');
});

document.getElementById('importBtn').addEventListener('click', async () => {
  const data = await pickJSONFile();
  if (!data) return toast('Файл не выбран или повреждён', { type: 'error' });
  try {
    const { renderRulesView } = await import('./sections/rules.js');
    state.rules = normalizeRules(data);
    renderRulesView();
    await api.setData(state.guildId, 'rules', state.rules);
    toast('Правила импортированы');
  } catch (e) { toast(e.message, { type: 'error' }); }
});

function normalizeRules(rules) {
  const base = { channelId: '', displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] };
  if (!rules || typeof rules !== 'object') return base;
  const merged = { ...base, ...rules };
  if (!Array.isArray(merged.blocks)) merged.blocks = [];
  return merged;
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && state.guildId) {
    e.preventDefault();
    if (state.currentSection === 'rules') saveRules();
    else if (state.currentSection === 'birthdays') saveBirthdays();
    else if (state.currentSection === 'profiles') saveProfiles();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.actions-dropdown')) {
    document.querySelectorAll('.actions-dropdown-menu').forEach(m => m.setAttribute('hidden', ''));
  }
});

document.getElementById('createMessageBtn').addEventListener('click', createMessageFlow);
document.getElementById('createAnnouncementBtn').addEventListener('click', createAnnouncementFlow);
document.getElementById('createDelayedBtn').addEventListener('click', createDelayedFlow);
document.getElementById('createAutodeleteBtn').addEventListener('click', createAutodeleteFlow);
document.getElementById('createProfileBtn').addEventListener('click', async () => {
  const m = await import('./sections/profiles.js');
  m.createProfileFlow?.();
});
document.getElementById('clearLogsBtn').addEventListener('click', clearAllLogs);