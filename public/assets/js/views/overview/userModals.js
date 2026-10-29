// public/assets/js/views/overview/userModals.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, timeAgo, fmtNum, pluralize } from '../../core/utils.js';

/* ───────── helpers ───────── */
function getCtx() {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  if (!botId || !guildId) return null;
  return { botId, guildId };
}

async function fetchList(path, ctx) {
  return api.get(`${path}?botId=${ctx.botId}&guildId=${ctx.guildId}`);
}

/** Аватар: реальный URL из события/профиля. Иначе — буква-заглушка. */
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
  return `<span class="user-modal-fallback">Пользователь</span>`;
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
        <span class="user-stat-pill msg" title="Сообщений"><i class="fa-solid fa-message"></i> ${fmtNum(row.messages)}</span>
        <span class="user-stat-pill voice" title="Заходов в голос"><i class="fa-solid fa-volume-high"></i> ${fmtNum(row.voice)}</span>
        <span class="user-stat-pill cmd" title="Команд"><i class="fa-solid fa-terminal"></i> ${fmtNum(row.commands)}</span>
      </div>
    </div>
  `;
}

function summaryBlock(count, kind) {
  const noun = pluralize(count, 'участник', 'участника', 'участников');
  const prefix = {
    joined: 'Присоединились',
    left: 'Покинули сервер',
    active: 'Были активны',
  }[kind] || 'Пользователи';

  return `<div class="user-modal-summary">
    <i class="fa-solid fa-circle-info"></i>
    ${prefix}: <strong>${count}</strong> ${noun} за 7 дней
  </div>`;
}

function emptyBlock(icon, text) {
  return `<div class="user-modal-empty">
    <i class="fa-solid ${icon}"></i>
    <strong>Пусто</strong>
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
    <strong>Ошибка загрузки</strong>
    <span>${escapeHtml(message || 'Попробуйте ещё раз')}</span>
  </div>`;
}

/* ───────── публичные модалки ───────── */
export function openJoinedModal() {
  const ctx = getCtx();
  if (!ctx) return;
  openModal({
    title: 'Новые участники',
    subtitle: 'Присоединились к серверу за последние 7 дней',
    body: loadingBlock('Загрузка списка...'),
    ctaLabel: 'Закрыть',
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/joined', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-user-plus', 'За последние 7 дней никто не присоединился к серверу.');
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
    title: 'Покинули сервер',
    subtitle: 'Ушли за последние 7 дней',
    body: loadingBlock('Загрузка списка...'),
    ctaLabel: 'Закрыть',
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/left', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-user-minus', 'За последние 7 дней никто не покинул сервер.');
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
    title: 'Активные пользователи',
    subtitle: 'Сообщения, команды и голосовая активность за 7 дней',
    body: loadingBlock('Загрузка списка...'),
    ctaLabel: 'Закрыть',
    wide: true,
    onOpen: async (modal) => {
      const bodyEl = modal.querySelector('.modal-body');
      try {
        const list = await fetchList('/api/stats/members/active', ctx);
        if (!list.length) {
          bodyEl.innerHTML = emptyBlock('fa-bolt', 'За последние 7 дней активности не было.');
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