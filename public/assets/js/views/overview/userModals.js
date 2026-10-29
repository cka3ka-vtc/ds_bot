// public/assets/js/views/overview/userModals.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, timeAgo, fmtNum, pluralize } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

function getCtx() {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  if (!botId || !guildId) return null;
  return { botId, guildId };
}

async function fetchList(path, ctx) {
  return api.get(`${path}?botId=${ctx.botId}&guildId=${ctx.guildId}`);
}

function avatarBlock(row) {
  if (row.avatar_url) {
    return `<div class="user-modal-avatar"><img src="${escapeHtml(row.avatar_url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }
  const letter = (row.display_name || row.username || row.user_id || '?')
    .trim()[0]?.toUpperCase() || '?';
  return `<div class="user-modal-avatar"><span>${escapeHtml(letter)}</span></div>`;
}

function nameLine(row) {
  const raw = row.display_name || row.username;
  if (raw) return escapeHtml(raw);
  return `<span class="user-modal-fallback">${UI.userModals.userFallback}</span>`;
}

function metaLine(row) {
  const parts = [];
  if (row.username) parts.push(`<span class="user-modal-handle">@${escapeHtml(row.username)}</span>`);
  parts.push(`<span class="user-modal-id">ID: ${escapeHtml(row.user_id)}</span>`);
  return parts.join('');
}

function renderJoinLeaveRow(row) {
  return `
    <div class="user-modal-row">
      ${avatarBlock(row)}
      <div class="user-modal-body">
        <div class="user-modal-name">${nameLine(row)}</div>
        <div class="user-modal-meta">${metaLine(row)}</div>
      </div>
      <span class="user-modal-time">${timeAgo(row.created_at)}</span>
    </div>
  `;
}

function renderActiveRow(row) {
  return `
    <div class="user-modal-row">
      ${avatarBlock(row)}
      <div class="user-modal-body">
        <div class="user-modal-name">${nameLine(row)}</div>
        <div class="user-modal-meta">${metaLine(row)}</div>
      </div>
      <div class="user-modal-stats">
        <span class="user-stat-pill msg" title="${UI.userModals.statMessages}"><i class="fa-solid fa-message"></i> ${fmtNum(row.messages)}</span>
        <span class="user-stat-pill voice" title="${UI.userModals.statVoice}"><i class="fa-solid fa-volume-high"></i> ${fmtNum(row.voice)}</span>
        <span class="user-stat-pill cmd" title="${UI.userModals.statCommands}"><i class="fa-solid fa-terminal"></i> ${fmtNum(row.commands)}</span>
      </div>
    </div>
  `;
}

function summaryBlock(count, kind) {
  const noun = pluralize(count, 'участник', 'участника', 'участников');
  const prefix = {
    joined: UI.userModals.joined.prefix,
    left: UI.userModals.left.prefix,
    active: UI.userModals.active.prefix,
  }[kind] || 'Пользователи';

  return `<div class="user-modal-summary">
    <i class="fa-solid fa-circle-info"></i>
    ${prefix}: <strong>${count}</strong> ${noun} за 7 дней
  </div>`;
}

function emptyBlock(icon, text) {
  return `<div class="user-modal-empty">
    <i class="fa-solid ${icon}"></i>
    <strong>${UI.common.empty}</strong>
    <span>${escapeHtml(text)}</span>
  </div>`;
}

function loadingBlock(text) {
  return `<div class="user-modal-loading">
    <i class="fa-solid fa-circle-notch fa-spin"></i>
    <span>${escapeHtml(text)}</span>
  </div>`;
}

function errorBlock(message) {
  return `<div class="user-modal-empty">
    <i class="fa-solid fa-triangle-exclamation" style="color:var(--red);"></i>
    <strong>${UI.userModals.errorTitle}</strong>
    <span>${escapeHtml(message || UI.userModals.errorHint)}</span>
  </div>`;
}

export function openJoinedModal() {
  const ctx = getCtx();
  if (!ctx) return;
  openModal({
    title: UI.userModals.joined.title,
    subtitle: UI.userModals.joined.subtitle,
    body: loadingBlock(UI.userModals.loading),
    ctaLabel: UI.userModals.close,
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/joined', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-user-plus', UI.userModals.joined.empty);
          return;
        }
        bodyEl.innerHTML = `
          ${summaryBlock(list.length, 'joined')}
          <div class="user-modal-list">
            ${list.map(renderJoinLeaveRow).join('')}
          </div>
        `;
      } catch (err) {
        bodyEl.innerHTML = errorBlock(err.message);
      }
    },
  });
}

export function openLeftModal() {
  const ctx = getCtx();
  if (!ctx) return;
  openModal({
    title: UI.userModals.left.title,
    subtitle: UI.userModals.left.subtitle,
    body: loadingBlock(UI.userModals.loading),
    ctaLabel: UI.userModals.close,
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/left', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-user-minus', UI.userModals.left.empty);
          return;
        }
        bodyEl.innerHTML = `
          ${summaryBlock(list.length, 'left')}
          <div class="user-modal-list">
            ${list.map(renderJoinLeaveRow).join('')}
          </div>
        `;
      } catch (err) {
        bodyEl.innerHTML = errorBlock(err.message);
      }
    },
  });
}

export function openActiveModal() {
  const ctx = getCtx();
  if (!ctx) return;
  openModal({
    title: UI.userModals.active.title,
    subtitle: UI.userModals.active.subtitle,
    body: loadingBlock(UI.userModals.loading),
    ctaLabel: UI.userModals.close,
    wide: true,
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/active', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-bolt', UI.userModals.active.empty);
          return;
        }
        bodyEl.innerHTML = `
          ${summaryBlock(list.length, 'active')}
          <div class="user-modal-list">
            ${list.map(renderActiveRow).join('')}
          </div>
        `;
      } catch (err) {
        bodyEl.innerHTML = errorBlock(err.message);
      }
    },
  });
}