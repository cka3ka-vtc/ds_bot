// public/assets/js/components/guildSwitcher.js
import { store } from '../core/store.js';

function initials(name = '') {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'S';
}

function guildIconUrl(guildId, iconHash) {
  if (!guildId || !iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=64`;
}

function avatarHtml(g) {
  const url = guildIconUrl(g?.id, g?.icon);
  return url
    ? `<img src="${url}" alt="" loading="lazy">`
    : initials(g?.name);
}

export function renderGuildSwitcher(container) {
  const guilds = store.get('guilds');
  const active = guilds.find((g) => g.id === store.get('activeGuildId')) || guilds[0];

  if (!active) {
    container.innerHTML = `
      <button class="switcher-btn" data-goto-servers type="button">
        <span class="switcher-glow" aria-hidden="true"></span>
        <span class="switcher-avatar">
          <i class="fa-solid fa-server" style="font-size:12px;"></i>
        </span>
        <span class="switcher-info">
          <span class="switcher-name">Нет серверов</span>
          <span class="switcher-meta">
            <i class="fa-solid fa-circle-info"></i> добавьте бота
          </span>
          <span class="switcher-hint">Сменить сервер</span>
        </span>
        <i class="fa-solid fa-bars"></i>
      </button>
    `;
    container.querySelector('[data-goto-servers]').addEventListener('click', () => {
      location.hash = 'servers';
    });
    return;
  }

  container.innerHTML = `
    <button class="switcher-btn" data-goto-servers type="button">
      <span class="switcher-glow" aria-hidden="true"></span>
      <span class="switcher-avatar">${avatarHtml(active)}</span>
      <span class="switcher-info">
        <span class="switcher-name">${escapeHtml(active.name)}</span>
        <span class="switcher-meta">
          <i class="fa-solid fa-users"></i>
          ${(active.memberCount || 0).toLocaleString('ru-RU')} участников
        </span>
        <span class="switcher-hint">Сменить сервер</span>
      </span>
      <i class="fa-solid fa-bars"></i>
    </button>
  `;

  container.querySelector('[data-goto-servers]').addEventListener('click', () => {
    location.hash = 'servers';
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}