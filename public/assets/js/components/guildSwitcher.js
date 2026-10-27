// public/assets/js/components/guildSwitcher.js
import { store } from '../core/store.js';
import { escapeHtml, initials, guildIconUrl } from '../core/utils.js';

function avatarHtml(g) {
  const url = guildIconUrl(g?.id, g?.icon, 64);
  return url ? `<img src="${url}" alt="" loading="lazy">` : initials(g?.name);
}

export function renderGuildSwitcher(container) {
  const guilds = store.get('guilds');
  const active = guilds.find((g) => g.id === store.get('activeGuildId')) || guilds[0];

  if (!active) {
    container.innerHTML = `
      <button class="switcher-btn" data-goto-servers type="button" aria-label="Сменить сервер">
        <span class="switcher-glow" aria-hidden="true"></span>
        <span class="switcher-avatar"><i class="fa-solid fa-server" style="font-size:12px;"></i></span>
        <span class="switcher-info">
          <span class="switcher-name">Нет серверов</span>
          <span class="switcher-meta"><i class="fa-solid fa-circle-info"></i> Добавьте бота</span>
        </span>
        <i class="fa-solid fa-bars"></i>
        <span class="switcher-hint">Сменить сервер</span>
      </button>
    `;
    container.querySelector('[data-goto-servers]').addEventListener('click', () => {
      location.hash = 'servers';
    });
    return;
  }

  container.innerHTML = `
    <button class="switcher-btn" data-goto-servers type="button" aria-label="Сменить сервер">
      <span class="switcher-glow" aria-hidden="true"></span>
      <span class="switcher-avatar">${avatarHtml(active)}</span>
      <span class="switcher-info">
        <span class="switcher-name">${escapeHtml(active.name)}</span>
        <span class="switcher-meta">
          <i class="fa-solid fa-users"></i>
          ${(active.memberCount || 0).toLocaleString('ru-RU')} участников
        </span>
      </span>
      <i class="fa-solid fa-bars"></i>
      <span class="switcher-hint">Сменить сервер</span>
    </button>
  `;

  container.querySelector('[data-goto-servers]').addEventListener('click', () => {
    location.hash = 'servers';
  });
}