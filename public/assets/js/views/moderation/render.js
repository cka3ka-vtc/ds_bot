// public/assets/js/views/moderation/render.js
import { escapeHtml, timeAgo, fmtNum } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { FILTER_META } from '/shared/moderation-config.js';

const M = UI.moderation;

const KIND_META = {
  warn: { icon: 'fa-triangle-exclamation', tone: 'warn' },
  mute: { icon: 'fa-microphone-slash',     tone: 'mute' },
  ban:  { icon: 'fa-ban',                  tone: 'ban' },
  kick: { icon: 'fa-user-slash',           tone: 'kick' },
  auto: { icon: 'fa-shield-halved',        tone: 'auto' },
};

const KIND_OPTIONS = [
  { value: '',     label: M.toolbar.kindAll },
  { value: 'warn', label: M.kinds.warn },
  { value: 'mute', label: M.kinds.mute },
  { value: 'ban',  label: M.kinds.ban },
  { value: 'kick', label: M.kinds.kick },
];

const SINCE_OPTIONS = [
  { value: 'all', label: M.toolbar.sinceAll },
  { value: '24h', label: M.toolbar.since24h },
  { value: '7d',  label: M.toolbar.since7d },
  { value: '30d', label: M.toolbar.since30d },
];

const GROUP_WINDOW_SEC = 24 * 60 * 60;

/* ═════════════════ Форматтеры ═════════════════ */

function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds < 60) return `${seconds} с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч ${Math.floor((seconds % 3600) / 60)} мин`;
  return `${Math.floor(seconds / 86400)} д ${Math.floor((seconds % 86400) / 3600)} ч`;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
}

function avatarHtml(avatarUrl, name) {
  if (avatarUrl) return `<img src="${escapeHtml(avatarUrl)}" alt="">`;
  return `<span>${escapeHtml(initials(name))}</span>`;
}

/* ═════════════════ Описание ═════════════════ */

function ruleFor(item) {
  if (item.auto) {
    if (item.filterKey) {
      const name = FILTER_META[item.filterKey]?.name || item.filterKey;
      return M.list.byRule(name);
    }
    if (item.reason) return M.list.byRule(item.reason);
    return '';
  }
  if (item.reason) return M.list.byReason(item.reason);
  return '';
}

function buildText(item) {
  const verb = M.verbs[item.kind] || M.kinds[item.kind] || '';
  const rule = ruleFor(item);
  const violation = item.auto && item.violation ? M.list.violation(item.violation) : '';
  const parts = [verb, rule, violation].filter(Boolean);
  return parts.join(' · ');
}

/* ═════════════════ Группировка ═════════════════ */

function groupItems(items) {
  const groups = [];
  let cur = null;

  for (const it of items) {
    const curKey = cur ? `${cur.userId}|${cur.kind}|${cur.filterKey || ''}` : null;
    const itKey = `${it.userId}|${it.kind}|${it.filterKey || ''}`;

    const canMerge = cur
      && itKey === curKey
      && (cur.items[0].createdAt - it.createdAt) < GROUP_WINDOW_SEC;

    if (canMerge) {
      cur.items.push(it);
      cur.hasActive = cur.hasActive || it.status === 'active';
      continue;
    }

    cur = {
      userId: it.userId,
      kind: it.kind,
      filterKey: it.filterKey || null,
      items: [it],
      hasActive: it.status === 'active',
    };
    groups.push(cur);
  }
  return groups;
}

/* ═════════════════ Страница (статичный каркас) ═════════════════ */

export function renderPage(view) {
  const { data, filters } = view.state;

  return `
    <div class="view-head">
      <div class="view-title">
        <h1>${M.pageTitle}</h1>
        <p>${M.pageSubtitle}</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-primary" id="modPunishBtn" type="button">
          <i class="fa-solid fa-gavel"></i> ${M.punish}
        </button>
      </div>
    </div>

    <div id="modKpiZone">${renderKpi(data.counts)}</div>

    <div class="mod-tabs-row">
      <div id="modTabsZone">${renderTabs(view)}</div>
    </div>

    ${renderToolbar(filters)}

    <div id="modListZone">
      ${renderSanctionList(data.items, { tab: view.state.tab })}
      ${renderPagination(view.state.page, data.pages)}
    </div>
  `;
}

/* ═════════════════ KPI ═════════════════ */

export function renderKpi(counts) {
  return `
    <div class="mod-kpi-row">
      ${kpiCard('fa-microphone-slash',     'purple', M.kpi.activeMutes, counts.activeMutes, M.kpi.hintActiveMutes)}
      ${kpiCard('fa-ban',                  'red',    M.kpi.activeBans,  counts.activeBans,  M.kpi.hintActiveBans)}
      ${kpiCard('fa-triangle-exclamation', 'orange', M.kpi.warns7d,     counts.warns7d,     M.kpi.hintWarns7d)}
      ${kpiCard('fa-shield-halved',        'blue',   M.kpi.auto7d,      counts.auto7d,      M.kpi.hintAuto7d)}
    </div>
  `;
}

function kpiCard(icon, tone, label, value, hint) {
  return `
    <div class="kpi-card ${tone}">
      <div class="kpi-head">
        <div class="kpi-label-group">
          <span class="kpi-label">${label}</span>
          <button class="kpi-hint" type="button" data-tooltip="${escapeHtml(hint)}">?</button>
        </div>
        <span class="kpi-icon"><i class="fa-solid ${icon}"></i></span>
      </div>
      <div class="kpi-value">${fmtNum(value)}</div>
    </div>
  `;
}

/* ═════════════════ Tabs ═════════════════ */

export function renderTabs(view) {
  const { tab, data } = view.state;
  const activeCount = data.counts.activeMutes + data.counts.activeBans;

  return `
    <div class="tabs" role="tablist">
      <button class="tab ${tab === 'active' ? 'active' : ''}" data-tab="active">
        ${M.tabs.active}
        ${activeCount > 0 ? `<span class="count">${activeCount}</span>` : ''}
      </button>
      <button class="tab ${tab === 'journal' ? 'active' : ''}" data-tab="journal">
        ${M.tabs.journal}
      </button>
    </div>
  `;
}

/* ═════════════════ Toolbar (статичная зона) ═════════════════ */

export function renderToolbar(filters) {
  return `
    <div class="mod-toolbar">
      <div class="search-input" style="flex:1;min-width:220px;max-width:380px;">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="modSearch" placeholder="${M.toolbar.search}"
               value="${escapeHtml(filters.search)}" autocomplete="off">
      </div>

      <div class="select-wrap" style="width:170px;">
        <select id="modKind">
          ${KIND_OPTIONS.map((o) =>
            `<option value="${o.value}" ${filters.kind === o.value ? 'selected' : ''}>${o.label}</option>`,
          ).join('')}
        </select>
      </div>

      <div class="select-wrap" style="width:150px;">
        <select id="modSince">
          ${SINCE_OPTIONS.map((o) =>
            `<option value="${o.value}" ${filters.since === o.value ? 'selected' : ''}>${o.label}</option>`,
          ).join('')}
        </select>
      </div>

      <button type="button" class="btn btn-ghost btn-sm" id="modResetFilters" title="${M.toolbar.reset}">
        <i class="fa-solid fa-rotate-left"></i>
      </button>
    </div>
  `;
}

/* ═════════════════ Список ═════════════════ */

export function renderSanctionList(items, { tab }) {
  if (!items.length) {
    return tab === 'active' ? emptyActive() : emptyJournal();
  }
  const groups = groupItems(items);
  return `
    <div class="mod-list">
      ${groups.map((g) => renderGroup(g, { showProgress: tab === 'active' })).join('')}
    </div>
  `;
}

function emptyActive() {
  return `<div class="empty-state">
    <i class="fa-solid fa-circle-check"></i>
    <strong>${M.list.emptyActive}</strong>
    <span>${M.list.emptyActiveHint}</span>
  </div>`;
}

function emptyJournal() {
  return `<div class="empty-state">
    <i class="fa-solid fa-shield-halved"></i>
    <strong>${M.list.emptyJournal}</strong>
    <span>${M.list.emptyJournalHint}</span>
  </div>`;
}

function renderGroup(group, { showProgress }) {
  if (group.items.length === 1) {
    return renderRow(group.items[0], { showProgress });
  }

  const head = group.items[0];
  const count = group.items.length;
  const meta = KIND_META[head.kind] || KIND_META.auto;
  const kindLabel = M.kinds[head.kind] || head.kind;
  const userLabel = head.displayName || head.username || M.list.unknownUser;
  const userHandle = head.username && head.username !== userLabel ? `@${head.username}` : '';
  const text = buildText(head) + M.list.groupedSuffix(count);

  return `
    <details class="mod-group">
      <summary class="mod-row mod-row--${meta.tone} mod-group-summary"
               aria-label="${escapeHtml(M.list.groupAria(count))}">
        <div class="mod-row-icon mod-row-icon--${meta.tone}">
          <i class="fa-solid ${meta.icon}"></i>
        </div>

        <div class="mod-row-main">
          <div class="mod-row-head">
            <span class="mod-kind mod-kind--${meta.tone}">${escapeHtml(kindLabel)}</span>
            <span class="mod-count-badge">${escapeHtml(M.list.groupedTimes(count))}</span>
            <span class="mod-user">
              <span class="mod-user-avatar">${avatarHtml(head.avatarUrl, userLabel)}</span>
              <span class="mod-user-name">${escapeHtml(userLabel)}</span>
              ${userHandle ? `<span class="mod-user-handle">${escapeHtml(userHandle)}</span>` : ''}
              <span class="mod-user-id">ID: ${escapeHtml(head.userId)}</span>
            </span>
          </div>

          <div class="mod-row-text">${escapeHtml(text)}</div>

          <div class="mod-row-meta">
            ${head.auto
              ? `<span class="mod-row-badge mod-row-badge--auto"><i class="fa-solid fa-shield-halved"></i> ${M.list.auto || 'Авто'}</span>`
              : `<span class="mod-row-badge"><span class="mod-row-mini-avatar">${avatarHtml(head.moderatorAvatarUrl, head.moderatorDisplayName || head.moderatorName)}</span> ${escapeHtml(head.moderatorDisplayName || head.moderatorName || M.list.unknownModerator)}</span>`}
            <span><i class="fa-solid fa-clock"></i> последнее: ${timeAgo(head.createdAt)}</span>
            ${group.hasActive
              ? `<span class="mod-status mod-status--active">${M.status.active}</span>`
              : ''}
          </div>
        </div>

        <div class="mod-row-aside">
          <i class="fa-solid fa-chevron-down mod-group-arrow" aria-hidden="true"></i>
        </div>
      </summary>

      <div class="mod-group-items">
        ${group.items.map((it) => renderRow(it, { showProgress })).join('')}
      </div>
    </details>
  `;
}

function renderRow(item, { showProgress }) {
  const meta = KIND_META[item.kind] || KIND_META.auto;
  const kindLabel = M.kinds[item.kind] || item.kind;
  const statusLabel = M.status[item.status] || item.status;

  const userLabel = item.displayName || item.username || M.list.unknownUser;
  const userHandle = item.username && item.username !== userLabel ? `@${item.username}` : '';

  const modBadge = item.auto
    ? `<span class="mod-row-badge mod-row-badge--auto"><i class="fa-solid fa-shield-halved"></i> ${M.list.auto || 'Авто'}</span>`
    : `<span class="mod-row-badge">
         <span class="mod-row-mini-avatar">${avatarHtml(item.moderatorAvatarUrl, item.moderatorDisplayName || item.moderatorName)}</span>
         ${escapeHtml(item.moderatorDisplayName || item.moderatorName || M.list.unknownModerator)}
       </span>`;

  const showRemoveBtn = item.status === 'active' && item.kind !== 'kick';
  const showStatus = item.kind === 'mute' || item.kind === 'ban';

  const progressHTML = showProgress && item.expiresAt && (item.kind === 'mute' || item.kind === 'ban')
    ? renderProgress(item)
    : '';

  const expiresRow = item.expiresAt
    ? `<span><i class="fa-solid fa-hourglass-half"></i> ${M.list.until}: ${fmtDateTime(item.expiresAt)}</span>`
    : (item.kind === 'mute' || item.kind === 'ban')
      ? `<span><i class="fa-solid fa-infinity"></i> ${M.list.forever}</span>`
      : '';

  const text = buildText(item);

  return `
    <div class="mod-row mod-row--${meta.tone}" data-id="${escapeHtml(item.id)}">
      <div class="mod-row-icon mod-row-icon--${meta.tone}">
        <i class="fa-solid ${meta.icon}"></i>
      </div>

      <div class="mod-row-main">
        <div class="mod-row-head">
          <span class="mod-kind mod-kind--${meta.tone}">${escapeHtml(kindLabel)}</span>
          <span class="mod-user">
            <span class="mod-user-avatar">${avatarHtml(item.avatarUrl, userLabel)}</span>
            <span class="mod-user-name">${escapeHtml(userLabel)}</span>
            ${userHandle ? `<span class="mod-user-handle">${escapeHtml(userHandle)}</span>` : ''}
            <span class="mod-user-id">ID: ${escapeHtml(item.userId)}</span>
          </span>
        </div>

        <div class="mod-row-text">${escapeHtml(text)}</div>

        <div class="mod-row-meta">
          ${modBadge}
          <span><i class="fa-solid fa-clock"></i> ${timeAgo(item.createdAt)}</span>
          ${expiresRow}
        </div>

        ${progressHTML}
      </div>

      <div class="mod-row-aside">
        ${showStatus ? `<span class="mod-status mod-status--${item.status}">${escapeHtml(statusLabel)}</span>` : ''}
        ${showRemoveBtn ? `
          <button type="button" class="btn btn-icon btn-ghost mod-remove-btn"
                  data-row-remove="${escapeHtml(item.id)}"
                  title="${M.actions.remove}" aria-label="${M.actions.remove}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderProgress(item) {
  const now = Math.floor(Date.now() / 1000);
  const total = item.expiresAt - item.createdAt;
  const elapsed = now - item.createdAt;
  const remaining = Math.max(0, item.expiresAt - now);
  const percent = total > 0 ? Math.min(100, Math.round((elapsed / total) * 100)) : 100;

  return `
    <div class="mod-progress">
      <div class="mod-progress-bar" style="width:${percent}%"></div>
      <span class="mod-progress-label">${M.list.progressLabel(percent, fmtDuration(remaining))}</span>
    </div>
  `;
}

/* ═════════════════ Пагинация ═════════════════ */

export function renderPagination(page, pages) {
  if (pages <= 1) return '';
  return `
    <div class="members-pagination">
      <button type="button" class="btn btn-ghost btn-sm" data-page="prev" ${page <= 1 ? 'disabled' : ''}>
        <i class="fa-solid fa-chevron-left"></i> ${M.pagination.prev}
      </button>
      <span class="page-info">${M.pagination.pageInfo(page, pages)}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-page="next" ${page >= pages ? 'disabled' : ''}>
        ${M.pagination.next} <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `;
}