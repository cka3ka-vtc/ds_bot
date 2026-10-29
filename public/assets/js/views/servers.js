// public/assets/js/views/servers.js
import { store } from '../core/store.js';
import { escapeHtml, fmtNum, fmtDate, WORD, initials, guildIconUrl } from '../core/utils.js';
import { UI } from '/shared/ui-strings.js';

export default {
  async render(container) {
    const guilds = store.get('guilds');
    const activeId = store.get('activeGuildId');

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>${UI.pages.servers.title}</h1>
          <p>${UI.pages.servers.subtitle}</p>
        </div>
      </div>
      ${guilds.length ? `
        <div class="servers-toolbar">
          <div class="search-input" style="flex:1;max-width:420px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="serversSearch" placeholder="${UI.servers.searchPlaceholder}">
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
          <strong>${UI.servers.emptyTitle}</strong>
          <span>${UI.servers.emptyHint}</span>
          <a href="/auth/discord/bot-invite" class="btn btn-primary">
            <i class="fa-brands fa-discord"></i> ${UI.actions.addBotOnServer}
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
    const url = guildIconUrl(g.id, g.icon, 128);
    const avatar = url
      ? `<img src="${url}" alt="" loading="lazy">`
      : `<span class="avatar-fallback">${initials(g.name)}</span>`;

    const memberCount = g.nonBotMemberCount ?? g.memberCount ?? 0;
    const online = g.nonBotOnline != null ? g.nonBotOnline : null;

    return `
      <button type="button"
              class="server-card"
              data-guild-id="${g.id}"
              data-name="${escapeHtml(g.name)}"
              aria-label="${UI.servers.openPanelLabel} ${escapeHtml(g.name)}">
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
            <span class="server-stat-value">${fmtNum(memberCount)}</span>
            <span class="server-stat-label">${UI.servers.statMembers}</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value">${online != null ? fmtNum(online) : '—'}</span>
            <span class="server-stat-label">${UI.servers.statOnline}</span>
          </div>
          <div class="server-stat">
            <span class="server-stat-value">${g.createdAt ? fmtDate(g.createdAt) : '—'}</span>
            <span class="server-stat-label">${UI.servers.statCreated}</span>
          </div>
        </div>
        <div class="server-card-footer">
          ${active
            ? `<span class="badge online">${UI.servers.selected}</span>`
            : `<span class="badge offline">${UI.servers.notSelected}</span>`}
          <span class="server-card-cta">
            ${active ? UI.servers.manage : UI.servers.select}
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </span>
        </div>
      </button>`;
  },
};