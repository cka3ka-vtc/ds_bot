// public/assets/js/views/module-settings/moderation/helpers.js
// Мелкие утилиты: stepper / chips / токены. Поддержка disabled.

import { escapeHtml } from '../../../core/utils.js';

/** HTML num-stepper. Параметр disabled отключает input и кнопки. */
export function stepperHTML(value, min, max, step, suffix = '', disabled = false) {
  const dis = disabled ? 'disabled' : '';
  return `
    <div class="num-stepper${disabled ? ' is-disabled' : ''}">
      <button type="button" class="num-stepper-btn" data-step="-${step}" ${dis}>
        <i class="fa-solid fa-minus"></i>
      </button>
      <input type="number" class="num-stepper-input"
             value="${Number(value) || 0}" min="${min}" max="${max}" ${dis}>
      ${suffix ? `<span class="num-stepper-suffix">${escapeHtml(suffix)}</span>` : ''}
      <button type="button" class="num-stepper-btn" data-step="${step}" ${dis}>
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>`;
}

/** Включить / выключить существующий num-stepper. */
export function setStepperDisabled(el, disabled) {
  if (!el) return;
  el.classList.toggle('is-disabled', disabled);
  const input = el.querySelector('.num-stepper-input');
  if (input) input.disabled = disabled;
  el.querySelectorAll('.num-stepper-btn').forEach((b) => { b.disabled = disabled; });
}

/* ═════════ Иконки каналов по типу ═════════ */

export function channelIcon(type) {
  switch (Number(type)) {
    case 2:  return 'fa-volume-high';
    case 5:  return 'fa-bullhorn';
    case 13: return 'fa-bullhorn';
    case 15: return 'fa-comments';
    default: return 'fa-hashtag';
  }
}

export function chipsHTML(ids, items, kind, emptyText) {
  if (!Array.isArray(ids) || !ids.length) {
    return `<div class="chip-empty">${escapeHtml(emptyText || 'Не выбрано')}</div>`;
  }
  return ids.map((id) => {
    const item = (items || []).find((x) => x.id === id);
    const name = item?.name || id;

    if (kind === 'channel') {
      const icon = channelIcon(item?.type);
      return `<div class="chip">
        <i class="fa-solid ${icon}"></i>${escapeHtml(name)}
        <button type="button" data-chip-remove="${escapeHtml(id)}" aria-label="Удалить">×</button>
      </div>`;
    }

    const color = item?.color && item.color !== '#000000'
      ? item.color : 'var(--border-strong)';
    return `<div class="chip">
      <span class="chip-dot" style="background:${escapeHtml(color)};"></span>${escapeHtml(name)}
      <button type="button" data-chip-remove="${escapeHtml(id)}" aria-label="Удалить">×</button>
    </div>`;
  }).join('');
}

export function tokensHTML(list) {
  return `<div class="template-tokens">${list.map((t) =>
    `<button type="button" class="template-token">{${escapeHtml(t)}}</button>`,
  ).join('')}</div>`;
}

export function bindChips(chipsEl, onRemove) {
  if (!chipsEl) return;
  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip-remove]');
    if (!btn) return;
    onRemove?.(btn.dataset.chipRemove);
  });
}

export function refreshChips(chipsEl, ids, items, kind, emptyText) {
  if (!chipsEl) return;
  chipsEl.innerHTML = chipsHTML(ids, items, kind, emptyText);
}

export function bindTokens(root) {
  root.querySelectorAll('.template-token').forEach((tok) => {
    tok.addEventListener('click', () => {
      const field = tok.closest('.form-field') || tok.closest('.sub-section');
      const ta = field?.querySelector('textarea');
      if (!ta) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      const text = ta.value;
      const insert = tok.textContent;
      ta.value = text.slice(0, start) + insert + text.slice(end);
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

export function bindSteppers(root) {
  root.querySelectorAll('.num-stepper').forEach((el) => {
    if (el._stepperBound) return;
    el._stepperBound = true;
    const input = el.querySelector('.num-stepper-input');
    if (!input) return;
    el.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (input.disabled) return;
        const step = parseFloat(btn.dataset.step) || 1;
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        let v = (parseFloat(input.value) || 0) + step;
        if (!Number.isNaN(min)) v = Math.max(min, v);
        if (!Number.isNaN(max)) v = Math.min(max, v);
        input.value = Number.isInteger(v) ? v : v.toFixed(1);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

export function readStepper(el) {
  const input = el?.querySelector?.('.num-stepper-input');
  return input ? (parseInt(input.value, 10) || 0) : 0;
}