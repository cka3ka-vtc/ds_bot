// public/assets/js/core/tooltip.js
/**
 * Глобальный тултип для [data-tooltip].
 * Создаёт ОДИН div в body и переиспользует его.
 * Делегирование на document — работает для динамически созданных элементов.
 */

let tooltipEl = null;
let hideTimer = null;

function ensureEl() {
  if (tooltipEl && document.body.contains(tooltipEl)) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'global-tooltip';
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function show(el) {
  const text = el.dataset.tooltip;
  if (!text) return;
  clearTimeout(hideTimer);

  const tip = ensureEl();
  tip.textContent = text;
  tip.classList.add('show');

  // Позиционируем после того, как контент установлен (чтобы знать размеры)
  requestAnimationFrame(() => {
    const rect = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;

    let left = rect.left + rect.width / 2 - tw / 2;
    let top = rect.top - th - pad;

    if (top < pad) top = rect.bottom + pad;
    if (left < pad) left = pad;
    if (left + tw > vw - pad) left = vw - tw - pad;
    if (top + th > vh - pad) top = vh - th - pad;

    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  });
}

function hide() {
  if (!tooltipEl) return;
  hideTimer = setTimeout(() => {
    if (tooltipEl) tooltipEl.classList.remove('show');
  }, 80);
}

export function initGlobalTooltips() {
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) show(el);
  });

  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el && !el.contains(e.relatedTarget)) hide();
  });

  document.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) show(el);
  });

  document.addEventListener('focusout', (e) => {
    const el = e.target.closest('[data-tooltip]');
    if (el) hide();
  });

  // Скрываем при скролле — иначе тултип «зависает» в старой позиции
  window.addEventListener('scroll', () => {
    if (tooltipEl) tooltipEl.classList.remove('show');
  }, { passive: true });
}