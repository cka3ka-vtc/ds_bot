// public/assets/js/landing/action.js
/**
 * Discord-симулятор на лендинге («В действии»).
 *  - TABS         — данные 8 сценариев
 *  - SCENARIOS    — сценарии сообщений
 *  - renderers    — превращают объекты в DOM
 *  - player       — проигрывает сценарий с таймингами
 */
import { escapeHtml } from '../core/utils.js';

const escHtml = escapeHtml;

/* ---------- 1. Табы ---------- */
const TABS = [
  { key: 'welcome',    icon: 'fa-hand',            title: 'Приветствие',    sub: 'Диалог новых',     channel: 'welcome' },
  { key: 'moderation', icon: 'fa-shield-halved',   title: 'Модерация',      sub: 'Удаляет спам',     channel: 'general' },
  { key: 'levels',     icon: 'fa-ranking-star',    title: 'Уровни',         sub: 'Награждает',       channel: 'levels' },
  { key: 'commands',   icon: 'fa-terminal',        title: 'Команды',        sub: '/serverinfo',      channel: 'general' },
  { key: 'messages',   icon: 'fa-message',         title: 'Сообщения',      sub: 'Опрос и картинки', channel: 'announcements' },
  { key: 'tickets',    icon: 'fa-ticket',          title: 'Тикеты',         sub: 'Поддержка',        channel: 'tickets' },
  { key: 'autodelete', icon: 'fa-trash',           title: 'Автоудаление',   sub: 'Чистка канала',    channel: 'general' },
  { key: 'birthdays',  icon: 'fa-cake-candles',    title: 'Дни рождения',   sub: 'Поздравляет',      channel: 'birthdays' },
];

/* ---------- 2. Сценарии ---------- */
const IMG_STEAM =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 340 160'>" +
  "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='%231b2838'/><stop offset='1' stop-color='%232a475e'/>" +
  "</linearGradient></defs>" +
  "<rect width='340' height='160' fill='url(%23g)'/>" +
  "<circle cx='170' cy='70' r='30' fill='%2366c0f4' opacity='0.15'/>" +
  "<path d='M155 60 L155 80 L175 70 Z' fill='%2366c0f4'/>" +
  "<text x='50%25' y='130' font-family='Arial,sans-serif' font-size='16' font-weight='bold' fill='%2366c0f4' text-anchor='middle'>STEAM COMMUNITY</text>" +
  "</svg>";

const SCENARIOS = {
  welcome: [
    { type: 'system', icon: 'fa-arrow-right-to-bracket', text: '<strong>newuser</strong> присоединился к серверу' },
    { type: 'bot', name: 'BotPanel', time: '14:32',
      text: 'Привет, <span class="mention">@newuser</span>! Добро пожаловать  🎉 Ты <strong>1248-й</strong> участник.',
      embed: { icon: 'fa-shield-halved', title: 'Автомодерация активна', desc: 'Фильтр мата · Антиспам · Антирейд' },
      reactions: [{ emoji: '🎉', count: 4 }, { emoji: '❤️', count: 2 }] },
    { type: 'user', avatar: 'A', color: '#3ba55d', name: 'alice', time: '14:33', text: 'Добро пожаловать! ❤️' },
  ],
  moderation: [
    { type: 'system', icon: 'fa-triangle-exclamation', warn: true, text: 'Нарушение в канале <strong>#general</strong>' },
    { type: 'user', avatar: 'S', color: '#ed4245', name: 'spammer', time: '14:34',
      text: 'BUY CHEAP FOLLOWERS NOW!!! bit.ly/xxxxx',
      willBeDeleted: { reason: 'спам ссылками', rule: 'Правило #3' } },
    { type: 'bot', name: 'BotPanel', time: '14:34',
      text: 'Сообщение удалено. Пользователь получил предупреждение.',
      embed: { icon: 'fa-triangle-exclamation', title: 'Причина: спам ссылками', desc: 'Правило #3 · Автомодерация' } },
    { type: 'user', avatar: 'M', color: '#5865F2', name: 'moderator', time: '14:35', text: 'Спасибо, бот справился за секунду  🔧' },
  ],
  levels: [
    { type: 'user', avatar: 'A', color: '#3ba55d', name: 'alice', time: '14:36', text: '/rank' },
    { type: 'bot', name: 'BotPanel', time: '14:36',
      text: 'Твой прогресс:',
      embed: { icon: 'fa-ranking-star', title: 'Уровень 12 · 2 340 / 3 000 XP', desc: 'До следующего — 660 XP' },
      reactions: [{ emoji: '⭐', count: 6 }, { emoji: '🔥', count: 3 }] },
    { type: 'system', icon: 'fa-star', text: '<strong>alice</strong> достигла <strong>уровня 13</strong>!' },
  ],
  // Только /serverinfo — /rank показывается в отдельном сценарии «Уровни»
  commands: [
    { type: 'user', avatar: 'A', color: '#3ba55d', name: 'alice', time: '14:50', text: '/serverinfo' },
    { type: 'bot', name: 'BotPanel', time: '14:50',
      text: 'Информация о сервере:',
      embed: { icon: 'fa-server', title: 'My Server',
               desc: 'Участников: 1 248 · Онлайн: 342 · Создан: 16.07.2019 · Регион: EU Central' } },
  ],
  messages: [
    { type: 'system', icon: 'fa-message', text: 'BotPanel опубликовал анонс в <strong>#announcements</strong>' },
    { type: 'components', name: 'BotPanel', time: '14:42', accent: '#1b2838',
      blocks: [
        { type: 'text', content: '**🎮 Игровой вечер в Steam**\n\nСобираемся в субботу в 20:00. Играем в CS2.' },
        { type: 'media', url: IMG_STEAM },
        { type: 'separator' },
        { type: 'section', content: 'Ссылка на наше сообщество', button: { label: 'Открыть Steam →', style: 'primary' } },
        { type: 'actionrow', buttons: [{ label: 'Иду', style: 'success' }, { label: 'Пас', style: 'secondary' }] },
      ] },
    { type: 'user', avatar: 'B', color: '#3ba55d', name: 'bob', time: '14:43', text: 'Я иду! 🔥' },
    { type: 'user', avatar: 'C', color: '#5865F2', name: 'charlie', time: '14:44', text: 'Ссылка откроется — кнопка работает' },
  ],
  tickets: [
    { type: 'user', avatar: 'B', color: '#faa61a', name: 'bob', time: '14:38', text: '/ticket Хочу подписку' },
    { type: 'bot', name: 'BotPanel', time: '14:38',
      text: 'Тикет создан!',
      embed: { icon: 'fa-ticket', title: 'Тикет #0427', desc: 'Канал: #ticket-0427 · Категория: Продажи' } },
    { type: 'system', icon: 'fa-user-plus', text: 'Модератор <strong>@support</strong> подключился' },
    { type: 'user', avatar: 'M', color: '#5865F2', name: 'support', time: '14:39', text: 'Здравствуйте! Чем помочь?' },
    { type: 'user', avatar: 'B', color: '#faa61a', name: 'bob', time: '14:41', text: 'Да, спасибо!' },
    { type: 'system', icon: 'fa-lock', close: true, text: 'Тикет <strong>#0427</strong> закрыт' },
  ],
  autodelete: [
    { type: 'system', icon: 'fa-trash', text: 'В <strong>#general</strong> автоудаление: 5 минут' },
    { type: 'user', avatar: 'C', color: '#3ba55d', name: 'charlie', time: '14:55',
      text: 'Это сообщение исчезнет через 5 минут', autoDelete: true },
    { type: 'system', icon: 'fa-clock', text: 'Таймер истекает...' },
    { type: 'system', icon: 'fa-check', trash: true, text: 'Сообщение автоматически удалено' },
  ],
  birthdays: [
    { type: 'system', icon: 'fa-cake-candles', text: 'День рождения у <strong>alice</strong>' },
    { type: 'bot', name: 'BotPanel', time: '09:00',
      text: '🎂 С днём рождения, <span class="mention">@alice</span>!',
      embed: { icon: 'fa-cake-candles', title: 'Уровень 24 · 2 341 XP', desc: 'Приздравляем сегодня' },
      reactions: [{ emoji: '🎂', count: 8 }, { emoji: '❤️', count: 5 }] },
    { type: 'user', avatar: 'B', color: '#3ba55d', name: 'bob', time: '09:01', text: 'С днём рождения! ❤️' },
  ],
};

/* ---------- 3. Рендеры ---------- */
function parseMdText(t) {
  let h = escHtml(t);
  h = h.replace(/&lt;#([\w-]+)&gt;/g, '<span class="mention">#$1</span>');
  h = h.replace(/&lt;@([\w-]+)&gt;/g, '<span class="mention">@$1</span>');
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return h;
}

function renderSystem(m) {
  const el = document.createElement('div');
  el.className = 'discord-system' +
    (m.warn ? ' warn' : '') +
    (m.trash ? ' trash' : '') +
    (m.close ? ' close' : '');
  el.innerHTML = `<i class="fa-solid ${m.icon}"></i><span>${m.text}</span>`;
  return el;
}

function renderMessage(m) {
  const el = document.createElement('div');
  el.className = 'discord-msg';
  if (m.autoDelete) el.classList.add('auto-delete-tag');

  let embedHtml = '';
  if (m.embed) {
    embedHtml = `<div class="discord-embed">
      <div class="discord-embed-title"><i class="fa-solid ${m.embed.icon}"></i>${m.embed.title}</div>
      <div class="discord-embed-desc">${m.embed.desc}</div>
    </div>`;
  }

  let reactHtml = '';
  if (m.reactions?.length) {
    reactHtml = `<div class="discord-reactions">${
      m.reactions.map((r, i) =>
        `<button class="reaction" type="button" style="animation-delay:${i * 80}ms">${r.emoji} <span>${r.count}</span></button>`
      ).join('')
    }</div>`;
  }

  const avatarContent = m.type === 'bot'
    ? '<svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M8 8h6v6H8zM18 8h6v6h-6zM8 18h6v6H8zM18 18h6v6h-6z"/></svg>'
    : m.avatar;

  const avatarClass = 'discord-avatar' + (m.type === 'bot' ? ' bot' : '');
  const avatarStyle = m.type === 'bot' ? '' : `style="background:${m.color}"`;
  const badge = m.type === 'bot' ? '<span class="discord-badge">BOT</span>' : '';

  el.innerHTML = `
    <div class="${avatarClass}" ${avatarStyle}>${avatarContent}</div>
    <div class="discord-body">
      <div class="discord-head">
        <span class="discord-name">${m.name}</span>${badge}
        <span class="discord-time">${m.time}</span>
      </div>
      <div class="discord-text">${m.text}</div>
      ${embedHtml}${reactHtml}
    </div>`;
  return el;
}

function renderComponents(m) {
  const inner = (m.blocks || []).map((b) => {
    if (b.type === 'text') return `<div class="d-components-text">${parseMdText(b.content || '')}</div>`;
    if (b.type === 'separator') return '<div class="d-components-sep"></div>';
    if (b.type === 'media' && b.url) return `<div class="d-components-media"><img src="${escHtml(b.url)}" alt=""></div>`;
    if (b.type === 'section') {
      const btn = b.button
        ? `<button class="d-components-btn ${b.button.style || 'primary'}">${parseMdText(b.button.label || '')}</button>`
        : '';
      return `<div class="d-components-section"><div class="d-components-section-text">${parseMdText(b.content || '')}</div>${btn}</div>`;
    }
    if (b.type === 'actionrow') {
      const btns = (b.buttons || []).map((x) =>
        `<button class="d-components-btn ${x.style || 'primary'}">${parseMdText(x.label || '')}</button>`
      ).join('');
      return `<div class="d-components-actionrow">${btns}</div>`;
    }
    return '';
  }).join('');

  const el = document.createElement('div');
  el.className = 'discord-msg';
  el.innerHTML = `
    <div class="discord-avatar bot">
      <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M8 8h6v6H8zM18 8h6v6h-6zM8 18h6v6H8zM18 18h6v6h-6z"/></svg>
    </div>
    <div class="discord-body">
      <div class="discord-head">
        <span class="discord-name">${m.name}</span>
        <span class="discord-badge">BOT</span>
        <span class="discord-time">${m.time}</span>
      </div>
      <div class="d-components-container" style="border-left-color:${m.accent || '#5865F2'}">${inner}</div>
    </div>`;
  return el;
}

function renderDeleted(m) {
  const el = document.createElement('div');
  el.className = 'discord-deleted';
  el.innerHTML = `
    <div class="discord-deleted-icon"><i class="fa-solid fa-trash"></i></div>
    <div>
      <strong>Сообщение удалено</strong>
      <span>Причина: ${m.willBeDeleted.reason} · ${m.willBeDeleted.rule}</span>
    </div>`;
  return el;
}

/* ---------- 4. Плеер ---------- */
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export function initAction() {
  const messagesEl = document.getElementById('discordMessages');
  const channelEl = document.getElementById('discordChannel');
  const inputEl = document.getElementById('discordInputChannel');
  const typingEl = document.getElementById('discordTypingBar');
  const tabsEl = document.getElementById('actionTabs');
  if (!messagesEl || !tabsEl) return;

  tabsEl.innerHTML = TABS.map((t, i) => `
    <button class="action-tab ${i === 0 ? 'active' : ''}" data-scenario="${t.key}" data-channel="${t.channel}" role="tab" aria-selected="${i === 0}">
      <span class="action-tab-icon"><i class="fa-solid ${t.icon}"></i></span>
      <span class="action-tab-text">
        <strong>${t.title}</strong>
        <span>${t.sub}</span>
      </span>
    </button>
  `).join('');

  let token = 0;

  async function play(key, channel) {
    const my = ++token;
    const messages = SCENARIOS[key];
    if (!messages) return;

    messagesEl.innerHTML = '';
    typingEl?.classList.add('hidden');
    if (channelEl) channelEl.textContent = channel;
    if (inputEl) inputEl.textContent = '#' + channel;

    for (const msg of messages) {
      if (my !== token) return;

      if (msg.type === 'bot' || msg.type === 'components') {
        typingEl?.classList.remove('hidden');
        await delay(900);
        if (my !== token) { typingEl?.classList.add('hidden'); return; }
        typingEl?.classList.add('hidden');
      }

      let node;
      if (msg.type === 'system') node = renderSystem(msg);
      else if (msg.type === 'components') node = renderComponents(msg);
      else node = renderMessage(msg);

      node.classList.add('entering');
      messagesEl.appendChild(node);
      await nextFrame();
      if (my !== token) { node.remove(); return; }
      node.classList.remove('entering');
      await delay(500);

      if (msg.willBeDeleted) {
        await delay(900);
        if (my !== token) return;
        node.classList.add('deleting');
        await delay(600);
        if (my !== token) return;
        node.replaceWith(renderDeleted(msg));
        await delay(400);
      }

      if (msg.autoDelete) {
        await delay(1800);
        if (my !== token) return;
        node.classList.add('deleting');
        await delay(600);
        if (my !== token) return;
        node.remove();
      }
    }
  }

  tabsEl.querySelectorAll('.action-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      tabsEl.querySelectorAll('.action-tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      play(tab.dataset.scenario, tab.dataset.channel);
    });
  });

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          play('welcome', 'welcome');
          obs.disconnect();
        }
      });
    }, { threshold: 0.25 });
    obs.observe(document.querySelector('.action-visual'));
  } else {
    play('welcome', 'welcome');
  }
}