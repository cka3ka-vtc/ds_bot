// public/assets/js/components/topbar.js
import { store } from '../core/store.js';
import { escapeHtml } from '../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { openContactModal } from './contactModal.js';
import { openModal } from '../core/modal.js';

const MODULE_LABELS = UI.moduleLabels;
const PAGE_LABELS = UI.nav;

export function renderTopbar(container) {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeIconClass = currentTheme === 'dark' ? 'fa-sun' : 'fa-moon';

  container.innerHTML = `
    <button class="topbar-menu" id="menuToggle" type="button" aria-label="${UI.actions.openMenu}">
      <i class="fa-solid fa-bars"></i>
    </button>
    <div class="topbar-title" id="topbarTitle"></div>
    <div class="topbar-actions">
      <button class="icon-btn" data-tour type="button" aria-label="${UI.actions.panelTour}">
        <i class="fa-solid fa-route"></i>
      </button>
      <button class="icon-btn" data-contacts type="button" aria-label="${UI.actions.contactUs}">
        <i class="fa-solid fa-headset"></i>
      </button>
      <button class="icon-btn" data-theme-toggle type="button" aria-label="${UI.actions.toggleTheme}">
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

function updateTitle(container) {
  const bots = store.get('bots');
  const guilds = store.get('guilds');
  const bot = bots.find((b) => b.id === store.get('activeBotId'));
  const guild = guilds.find((g) => g.id === store.get('activeGuildId'));

  const rawHash = location.hash.slice(1) || 'overview';
  const [page, queryString] = rawHash.split('?');
  const params = new URLSearchParams(queryString || '');
  const sub = params.get('sub');

  const title = container.querySelector('#topbarTitle');
  if (!title) return;

  let html = `
    <span class="crumb">${escapeHtml(bot?.name || UI.words.bot(1))}</span>
    <span class="crumb">${escapeHtml(guild?.name || '—')}</span>
  `;

  if (sub) {
    html += `
      <span class="crumb">${UI.nav.modules}</span>
      <span>${escapeHtml(MODULE_LABELS[sub] || sub)}</span>
    `;
  } else {
    html += `<span>${escapeHtml(PAGE_LABELS[page] || '')}</span>`;
  }

  title.innerHTML = html;
}

function openPanelTour() {
  const s = UI.topbar.tourSections;
  const rows = ['overview', 'modules', 'moderation', 'commands', 'members', 'settings']
    .map((key) => {
      const row = s[key];
      if (!row) return '';
      const icons = {
        overview: 'fa-chart-pie',
        modules: 'fa-puzzle-piece',
        moderation: 'fa-shield-halved',
        commands: 'fa-terminal',
        members: 'fa-user-group',
        settings: 'fa-gear',
      };
      return `
        <div class="contact-link" style="cursor:default;">
          <i class="fa-solid ${icons[key]}"></i>
          <div>
            <strong>${escapeHtml(row.title)}</strong>
            <span>${escapeHtml(row.text)}</span>
          </div>
        </div>
      `;
    }).join('');

  openModal({
    title: UI.topbar.tourTitle,
    subtitle: UI.topbar.tourSubtitle,
    body: `<div class="contact-list">${rows}</div>`,
    ctaLabel: UI.topbar.tourCta,
  });
}