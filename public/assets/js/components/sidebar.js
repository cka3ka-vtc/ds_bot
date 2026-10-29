// public/assets/js/components/sidebar.js
import { store } from '../core/store.js';
import { api } from '../core/api.js';
import { escapeHtml, userAvatarUrl } from '../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { renderGuildSwitcher } from './guildSwitcher.js';

export function renderSidebar(container) {
  container.innerHTML = `
    <div class="sidebar-brand" aria-label="${UI.brand.name}">
      <span class="brand-mark">
        <i class="fa-solid fa-bolt"></i>
      </span>
      <span class="brand-title">${UI.brand.name}</span>
    </div>
    <div class="switcher" id="guildSwitcher"></div>
    <nav class="sidebar-nav" id="navMenu"></nav>
    <div class="sidebar-user" id="sidebarUser"></div>
  `;

  renderGuildSwitcher(container.querySelector('#guildSwitcher'));
  renderNav(container.querySelector('#navMenu'));
  renderUser(container.querySelector('#sidebarUser'));

  store.subscribe((key) => {
    if (key === 'guilds' || key === 'activeGuildId') {
      renderGuildSwitcher(container.querySelector('#guildSwitcher'));
    }
    if (key === 'modulesEnabledCount' || key === '*') {
      updateNavBadges();
    }
  });
}

const NAV_ITEMS = [
  { section: UI.nav.sectionServer },
  { key: 'overview',   icon: 'fa-chart-pie',     label: UI.nav.overview },
  { key: 'modules',    icon: 'fa-puzzle-piece',  label: UI.nav.modules, badge: 'modules' },
  { key: 'moderation', icon: 'fa-shield-halved', label: UI.nav.moderation },
  { key: 'commands',   icon: 'fa-terminal',      label: UI.nav.commands },
  { key: 'members',    icon: 'fa-user-group',    label: UI.nav.members },
  { key: 'settings',   icon: 'fa-gear',          label: UI.nav.settings },
  { section: UI.nav.sectionAccount },
  { key: 'bots',       icon: 'fa-robot',         label: UI.nav.bots },
];

function renderNav(container) {
  container.innerHTML = NAV_ITEMS.map((it) => {
    if (it.section) return `<div class="nav-section-label">${it.section}</div>`;
    const current = (location.hash.slice(1) || 'overview') === it.key;
    const badge = it.badge ? `<span class="nav-badge" data-badge="${it.badge}">—</span>` : '';
    return `<a href="#${it.key}" class="nav-item ${current ? 'active' : ''}" data-nav="${it.key}">
      <i class="fa-solid ${it.icon}"></i> ${it.label}${badge}
    </a>`;
  }).join('');
  updateNavBadges();
}

function updateNavBadges() {
  const count = store.get('modulesEnabledCount');
  const badge = document.querySelector('[data-badge="modules"]');
  if (badge) badge.textContent = (typeof count === 'number' && count >= 0) ? count : '—';
}

function renderUser(container) {
  const user = store.get('user');
  if (!user) return;
  const url = userAvatarUrl(user.id, user.avatar, 64);
  const avatar = url
    ? `<img src="${url}" alt="">`
    : (user.username?.[0]?.toUpperCase() || 'U');

  container.innerHTML = `
    <span class="user-avatar">${avatar}</span>
    <div class="user-info">
      <span class="user-name">${escapeHtml(user.username)}</span>
    </div>
    <a href="#" class="logout-btn" data-logout title="${UI.actions.logout}" aria-label="${UI.actions.logout}">
      <i class="fa-solid fa-right-from-bracket"></i>
    </a>
  `;

  container.querySelector('[data-logout]').addEventListener('click', async (e) => {
    e.preventDefault();
    try { await api.post('/auth/logout'); } catch {}
    location.href = '/auth.html';
  });
}