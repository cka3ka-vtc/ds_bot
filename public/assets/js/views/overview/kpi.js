// public/assets/js/views/overview/kpi.js
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const KPI_CONFIG = [
  {
    key: 'totalMembers',
    label: UI.overview.kpi.totalMembers,
    icon: 'fa-users',
    color: 'blue',
    hint: UI.overview.kpi.hintTotalMembers,
    ariaLabel: UI.overview.kpi.goMembers,
    nav: 'members',
  },
  {
    key: 'newMembers',
    label: UI.overview.kpi.newMembers,
    icon: 'fa-user-plus',
    color: 'green',
    hint: UI.overview.kpi.hintNewMembers,
    ariaLabel: UI.overview.kpi.openJoined,
    action: 'joined',
  },
  {
    key: 'leftMembers',
    label: UI.overview.kpi.leftMembers,
    icon: 'fa-user-minus',
    color: 'red',
    hint: UI.overview.kpi.hintLeftMembers,
    ariaLabel: UI.overview.kpi.openLeft,
    action: 'left',
  },
  {
    key: 'activeUsers',
    label: UI.overview.kpi.activeUsers,
    icon: 'fa-bolt',
    color: 'orange',
    hint: UI.overview.kpi.hintActiveUsers,
    ariaLabel: UI.overview.kpi.openActive,
    action: 'active',
  },
];

export function renderKpiGrid(d) {
  return `<div class="kpi-grid">
    ${KPI_CONFIG.map((c) => kpi(c, d[c.key])).join('')}
  </div>`;
}

function kpi(c, value) {
  const v = Number(value) || 0;
  const clickable = !!(c.action || c.nav);

  let attrs = '';
  if (clickable) {
    if (c.action) attrs += ` data-kpi-action="${c.action}"`;
    if (c.nav)    attrs += ` data-kpi-nav="${c.nav}"`;
    attrs += ` role="button" tabindex="0" aria-label="${escapeHtml(c.ariaLabel || c.label)}"`;
  }

  return `
    <div class="kpi-card ${c.color}${clickable ? ' is-clickable' : ''}"${attrs}>
      <div class="kpi-head">
        <div class="kpi-label-group">
          <span class="kpi-label">${c.label}</span>
          <button class="kpi-hint" type="button" data-tooltip="${escapeHtml(c.hint)}">?</button>
        </div>
        <span class="kpi-icon"><i class="fa-solid ${c.icon}"></i></span>
      </div>
      <div class="kpi-value" data-count="${v}">${v.toLocaleString('ru-RU')}</div>
    </div>`;
}

export function animateKpiCounters(container) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.querySelectorAll('.kpi-value[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    if (reduced || target === 0) return;

    const duration = 900;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const v = Math.round(ease(p) * target);
      el.textContent = v.toLocaleString('ru-RU');
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString('ru-RU');
    }
    requestAnimationFrame(tick);
  });
}