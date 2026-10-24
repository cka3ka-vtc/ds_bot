import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';
import { toast, confirmDialog, emptyState } from '../ui.js';
import { updateLogsBadge } from './helpers.js';

let currentFilter = 'all';

const LEVEL_LABELS = {
  all: 'Все',
  info: 'Инфо',
  warn: 'Предупреждения',
  error: 'Ошибки'
};

export async function renderLogsView() {
  const container = document.getElementById('logsList');
  if (!container) return;

  try {
    const data = await api.logs(state.guildId);
    state.logs = data.items || [];
    updateLogsBadge();

    if (!data.items?.length) {
      container.innerHTML = emptyState(
        '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
        'Пока нет записей',
        'Здесь появятся действия и события бота'
      );
      return;
    }

    const counts = {
      all: data.items.length,
      info: data.items.filter(l => l.level === 'info').length,
      warn: data.items.filter(l => l.level === 'warn').length,
      error: data.items.filter(l => l.level === 'error').length
    };

    container.innerHTML = `
      <div class="logs-toolbar">
        ${['all', 'info', 'warn', 'error'].map(lvl => `
          <button type="button" class="logs-filter-btn ${currentFilter === lvl ? 'active' : ''}" data-log-filter="${lvl}">
            ${LEVEL_LABELS[lvl]}
            <span class="logs-filter-count">${counts[lvl]}</span>
          </button>
        `).join('')}
      </div>
      <div class="logs-groups" data-logs-groups></div>
    `;

    container.querySelectorAll('[data-log-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilter = btn.dataset.logFilter;
        container.querySelectorAll('[data-log-filter]').forEach(b => b.classList.toggle('active', b === btn));
        renderGroups(container.querySelector('[data-logs-groups]'), data.groups || []);
      });
    });

    renderGroups(container.querySelector('[data-logs-groups]'), data.groups || []);
  } catch (e) {
    container.innerHTML = emptyState(
      '<circle cx="12" cy="12" r="10"/>',
      'Не удалось загрузить логи',
      e.message
    );
  }
}

function renderGroups(container, groups) {
  if (!container) return;

  const filtered = groups
    .map(g => ({
      ...g,
      logs: currentFilter === 'all'
        ? g.logs
        : g.logs.filter(l => l.level === currentFilter)
    }))
    .filter(g => g.logs.length > 0);

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state" style="padding:32px 20px;">
      <span style="font-size:13px;">Нет записей по фильтру «${LEVEL_LABELS[currentFilter]}»</span>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map((g, i) => `
    <div class="log-group ${g.errorCount > 0 ? 'has-errors' : ''} ${i === 0 ? 'open' : ''}">
      <button type="button" class="log-group-header" data-log-group-toggle aria-expanded="${i === 0}">
        <span class="log-group-type">${escapeHtml(g.type)}</span>
        <div class="log-group-stats">
          <span>${g.count} ${g.count === 1 ? 'запись' : 'записей'}</span>
          ${g.errorCount > 0 ? `<span class="err">${g.errorCount} err</span>` : ''}
          ${g.warnCount > 0 ? `<span class="warn">${g.warnCount} warn</span>` : ''}
        </div>
        <div class="log-group-meta">
          <span>${new Date(g.lastAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>
        </div>
      </button>
      <div class="log-group-body">
        ${g.logs.map(l => `
          <div class="log-item">
            <div class="log-item-time">${new Date(l.timestamp).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</div>
            <div class="log-item-level ${l.level}">${l.level}</div>
            <div class="log-item-body">
              <div class="log-item-msg">${escapeHtml(l.message)}</div>
              ${l.context && Object.keys(l.context).length
                ? `<div class="log-item-context">${escapeHtml(JSON.stringify(l.context))}</div>`
                : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-log-group-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.log-group');
      group.classList.toggle('open');
      btn.setAttribute('aria-expanded', group.classList.contains('open'));
    });
  });
}

export async function clearAllLogs() {
  const ok = await confirmDialog({
    title: 'Очистить логи',
    text: 'Удалить все записи журнала?',
    actionText: 'Очистить'
  });
  if (!ok) return;
  try {
    await api.clearLogs(state.guildId);
    state.logs = [];
    updateLogsBadge();
    renderLogsView();
    toast('Логи очищены');
  } catch (e) {
    toast(e.message, { type: 'error' });
  }
}