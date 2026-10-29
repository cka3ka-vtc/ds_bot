// public/assets/js/views/overview/kpi.js
import { escapeHtml } from '../../core/utils.js';

const KPI_CONFIG = [
  {
    key: 'totalMembers',
    label: 'Всего участников',
    icon: 'fa-users',
    color: 'blue',
    hint: 'Общее число участников на сервере прямо сейчас.',
    nav: 'members',
  },
  {
    key: 'newMembers',
    label: 'Новые',
    icon: 'fa-user-plus',
    color: 'green',
    hint: 'Сколько присоединилось за последние 7 дней.',
    action: 'joined',
  },
  {
    key: 'leftMembers',
    label: 'Покинули',
    icon: 'fa-user-minus',
    color: 'red',
    hint: 'Сколько покинуло сервер за последние 7 дней.',
    action: 'left',
  },
  {
    key: 'activeUsers',
    label: 'Активные',
    icon: 'fa-bolt',
    color: 'orange',
    hint: 'Уникальные авторы сообщений, команд и голосовой активности за 7 дней.',
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
  const ariaLabel = c.action ? `Открыть: ${c.label}` : `Перейти: ${c.label}`;

  let attrs = '';
  if (clickable) {
    if (c.action) attrs += ` data-kpi-action="${c.action}"`;
    if (c.nav)    attrs += ` data-kpi-nav="${c.nav}"`;
    attrs += ` role="button" tabindex="0" aria-label="${escapeHtml(ariaLabel)}"`;
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