// public/assets/js/components/topbar.js
import { store } from '../core/store.js';
import { openModal } from '../core/modal.js';
import { escapeHtml } from '../core/utils.js';

export function renderTopbar(container) {
  container.innerHTML = `
    <button class="topbar-menu" id="menuToggle" type="button" aria-label="Меню">
      <i class="fa-solid fa-bars"></i>
    </button>
    <div class="topbar-title" id="topbarTitle"></div>
    <div class="topbar-actions">
      <!-- ⚡ ФИКС #4: удалён title="Наши контакты" -->
      <button class="icon-btn" data-contacts type="button" aria-label="Наши контакты">
        <i class="fa-solid fa-headset"></i>
      </button>
      <button class="icon-btn" data-theme-toggle type="button" aria-label="Тема">
        <i class="fa-solid fa-moon"></i>
      </button>
    </div>
  `;

  updateTitle(container);
  window.addEventListener('hashchange', () => updateTitle(container));
  store.subscribe((key) => {
    if (key === 'activeBotId' || key === 'activeGuildId' || key === '*') {
      updateTitle(container);
    }
  });

  setTimeout(() => {
    const toggle = container.querySelector('#menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('show');
      });
    }
  }, 0);

  container.querySelector('[data-contacts]').addEventListener('click', openContactsModal);
}

function updateTitle(container) {
  const bots = store.get('bots');
  const guilds = store.get('guilds');
  const bot = bots.find((b) => b.id === store.get('activeBotId'));
  const guild = guilds.find((g) => g.id === store.get('activeGuildId'));
  const page = location.hash.slice(1) || 'overview';
  const labels = {
    overview: 'Обзор', modules: 'Модули', moderation: 'Модерация',
    commands: 'Команды', members: 'Участники', settings: 'Настройки',
    bots: 'Мои боты', servers: 'Выбор сервера',
  };
  const title = container.querySelector('#topbarTitle');
  if (title) {
    title.innerHTML = `
      <span class="crumb">${escapeHtml(bot?.name || 'Бот')}</span>
      <span class="crumb">${escapeHtml(guild?.name || '—')}</span>
      <span>${labels[page] || ''}</span>
    `;
  }
}

function openContactsModal() {
  openModal({
    title: 'Наши контакты',
    subtitle: 'Отвечаем в течение 24 часов',
    body: `
      <div class="contact-list">
        <a href="mailto:hello@botpanel.gg" class="contact-link">
          <i class="fa-solid fa-envelope"></i>
          <div>
            <strong>Email</strong>
            <span>hello@botpanel.gg</span>
          </div>
        </a>
        <a href="https://discord.gg/botpanel" target="_blank" rel="noopener" class="contact-link">
          <i class="fa-brands fa-discord"></i>
          <div>
            <strong>Discord</strong>
            <span>discord.gg/botpanel</span>
          </div>
        </a>
      </div>
    `,
    ctaLabel: 'Закрыть',
  });
}