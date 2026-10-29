// public/assets/js/views/module-settings/levels/helpers.js
// UI-хелперы модуля «Уровни». Конфиг нормализуется в shared/levels-config.js.

import { escapeHtml } from '../../../core/utils.js';

// Реэкспорт единого источника — чтобы не дублировать конфиг.
export {
  mergeLevelsConfig,
  defaultLevelsConfig,
  normalizeLevelsEvents,
  LEVELS_COOLDOWN_DEFAULT,
} from '/shared/levels-config.js';

export function numStepper({ value = 0, min = 0, max = 999999, step = 1, suffix = '', data = '' }) {
  return `
    <div class="num-stepper" data-num-stepper ${data}>
      <button type="button" class="num-stepper-btn" data-step="-${step}" aria-label="Уменьшить">
        <i class="fa-solid fa-minus"></i>
      </button>
      <input type="number" class="num-stepper-input" value="${value}" min="${min}" max="${max}" step="${step}">
      ${suffix ? `<span class="num-stepper-suffix">${escapeHtml(suffix)}</span>` : ''}
      <button type="button" class="num-stepper-btn" data-step="${step}" aria-label="Увеличить">
        <i class="fa-solid fa-plus"></i>
      </button>
    </div>
  `;
}

export function bindNumSteppers(root) {
  root.querySelectorAll('[data-num-stepper]').forEach((el) => {
    if (el._bound) return;
    el._bound = true;
    const input = el.querySelector('.num-stepper-input');
    el.querySelectorAll('[data-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseFloat(btn.dataset.step) || 1;
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        let v = (parseFloat(input.value) || 0) + step;
        if (!isNaN(min)) v = Math.max(min, v);
        if (!isNaN(max)) v = Math.min(max, v);
        input.value = Number.isInteger(v) ? v : v.toFixed(2);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  });
}