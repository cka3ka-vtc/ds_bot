// public/assets/js/components/topbar.js
import { store } from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { openContactModal } from './contactModal.js';
import { openModal } from '../core/modal.js';

export function renderTopbar(container) {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeIconClass = currentTheme === 'dark' ? 'fa-sun' : 'fa-moon';

  container.innerHTML = `
    <button class="topbar-menu" id="menuToggle" type="button" aria-label="Меню">
      <i class="fa-solid fa-bars"></i>
    </button>
    <div class="topbar-title" id="topbarTitle"></div>
    <div class="topbar-actions">
      <button class="icon-btn" data-tour type="button" aria-label="Тур по панели">
        <i class="fa-solid fa-route"></i>
      </button>
      <button class="icon-btn" data-contacts type="button" aria-label="Связаться с нами">
        <i class="fa-solid fa-headset"></i>
      </button>
      <button class="icon-btn" data-theme-toggle type="button" aria-label="Тема">
        <i class="fa-solid ${themeIconClass}"></i>
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

  container.querySelector('[data-tour]').addEventListener('click', openPanelTour);
  container.querySelector('[data-contacts]').addEventListener('click', () => openContactModal());
}

const PAGE_LABELS = {
  overview: 'Дашборд', modules: 'Модули', moderation: 'Модерация',
  commands: 'Команды', members: 'Участники', settings: 'Настройки',
  bots: 'Мои боты', servers: 'Список серверов',
};

function updateTitle(container) {
  const bots = store.get('bots');
  const guilds = store.get('guilds');
  const bot = bots.find((b) => b.id === store.get('activeBotId'));
  const guild = guilds.find((g) => g.id === store.get('activeGuildId'));
  const page = location.hash.slice(1) || 'overview';
  const title = container.querySelector('#topbarTitle');
  if (title) {
    title.innerHTML = `
      <span class="crumb">${escapeHtml(bot?.name || 'Бот')}</span>
      <span class="crumb">${escapeHtml(guild?.name || '—')}</span>
      <span>${PAGE_LABELS[page] || ''}</span>
    `;
  }
}

/* Мини-тур: карточки с кратким обзором разделов */
function openPanelTour() {
  openModal({
    title: 'Тур по панели',
    subtitle: 'Ключевые разделы и возможности',
    body: `
      <div class="contact-list">
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-chart-pie"></i>
          <div>
            <strong>Дашборд</strong>
            <span>Ключевые метрики, графики активности, топ команд и каналов</span>
          </div>
        </div>
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-puzzle-piece"></i>
          <div>
            <strong>Модули</strong>
            <span>Приветствия, уровни, тикеты, дни рождения и другое — включаются в один клик</span>
          </div>
        </div>
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-shield-halved"></i>
          <div>
            <strong>Модерация</strong>
            <span>Автомодерация, ручные наказания и журнал действий</span>
          </div>
        </div>
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-terminal"></i>
          <div>
            <strong>Команды</strong>
            <span>Встроенные и пользовательские слэш-команды сервера</span>
          </div>
        </div>
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-user-group"></i>
          <div>
            <strong>Участники</strong>
            <span>Уровни, предупреждения и роли — управление составом</span>
          </div>
        </div>
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid fa-gear"></i>
          <div>
            <strong>Настройки</strong>
            <span>Канал логов и роли-исключения для статистики</span>
          </div>
        </div>
      </div>
    `,
    ctaLabel: 'Понятно',
  });
}