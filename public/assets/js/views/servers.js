// public/assets/js/views/servers.js
import { store } from '../core/store.js';
import { escapeHtml, fmtNum, fmtDate, WORD } from '../core/utils.js';

function guildIconUrl(guildId, iconHash) {
  if (!guildId || !iconHash) return null;
  const ext = iconHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${ext}?size=128`;
}

function initials(name = '') {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'S';
}

export default {
  async render(container) {
    const guilds = store.get('guilds');
    const activeId = store.get('activeGuildId');

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Выберите сервер</h1>
          <p>Управляйте ботом на серверах, где вы являетесь администратором</p>
        </div>
      </div>

      ${guilds.length ? `
        <div class="servers-toolbar">
          <div class="search-input" style="flex:1;max-width:420px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="serversSearch" placeholder="Поиск по названию или ID...">
          </div>
          <span class="servers-count" id="serversCount">
            ${guilds.length} ${WORD.server(guilds.length)}
          </span>
        </div>
        <div class="servers-grid" id="serversGrid">
          ${guilds.map((g) => this._card(g, g.id === activeId)).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <i class="fa-brands fa-discord"></i>
          <strong>Нет доступных серверов</strong>
          <span>Добавьте бота на сервер, где у вас есть права администратора</span>
          <a href="/auth/discord/bot-invite" class="btn btn-primary">
            <i class="fa-brands fa-discord"></i> Добавить бота на сервер
          </a>
        </div>
      `}
    `;

    container.querySelectorAll('[data-guild-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.guildId;
        if (id !== activeId) {
          store.set('activeGuildId', id);
          try { localStorage.setItem('activeGuildId', id); } catch {}
        }
        location.hash = 'overview';
      });
    });

    const search = container.querySelector('#serversSearch');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        let visible = 0;
        container.querySelectorAll('[data-guild-id]').forEach((card) => {
          const name = (card.dataset.name || '').toLowerCase();
          const id = (card.dataset.guildId || '').toLowerCase();
          const match = !q || name.includes(q) || id.includes(q);
          card.hidden = !match;
          if (match) visible++;
        });
        const countEl = container.querySelector('#serversCount');
        if (countEl) countEl.textContent = `${visible} ${WORD.server(visible)}`;
      });
    }
  },

  _card(g, active) {
    const url = guildIconUrl(g.id, g.icon);
    const avatar = url
      ? `<img src="${url}" alt="" loading="lazy">`
      : `<span class="avatar-fallback">${initials(g.name)}</span>`;

    const members = fmtNum(g.memberCount || 0);
    const online = g.online != null ? fmtNum(g.online) : '—';
    const created = g.createdAt ? fmtDate(g.createdAt) : '—';
    const badge = active
      ? '<span class="badge online">Активен</span>'
      : '<span class="badge offline">Не выбран</span>';

    // ⚡ is-active убран — не мешает hover-анимации
    return `
      <button type="button"
              class="server-card"
              data-guild-id="${g.id}"
              data-name="${escapeHtml(g.name)}"
              aria-label="Открыть панель ${escapeHtml(g.name)}">
        <span class="server-glow-card" aria-hidden="true"></span>
        <div class="server-card-head">
          <div class="server-card-avatar">${avatar}</div>
          <div style="min-width:0;flex:1;">
            <div class="server-card-name">${escapeHtml(g.name)}</div>
            <div class="server-card-id">ID: ${g.id}</div>
          </div>
        </div>
        <div class="server-card-stats">
          <div class="server-stat">
            <span class="server-stat-value">${members}</span>
            <span class="server-stat-label">Участников</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value">${online}</span>
            <span class="server-stat-label">Онлайн</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value">${created}</span>
            <span class="server-stat-label">Создан</span>
          </div>
        </div>
        <div class="server-card-footer">
          ${badge}
          <span class="server-card-cta">
            ${active ? 'Управлять' : 'Выбрать'}
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </span>
        </div>
      </button>`;
  },
};