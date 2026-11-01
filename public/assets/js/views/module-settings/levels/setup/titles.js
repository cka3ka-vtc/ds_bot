// public/assets/js/views/module-settings/levels/setup/titles.js
import { escapeHtml } from '../../../../core/utils.js';
import { bindNumSteppers, numStepper } from '../helpers.js';

/**
 * Секция «Звания»: список порогов уровня → название.
 * Кнопки +/− (num stepper) на каждом пороге; input на название;
 * кнопка удаления.
 */
export function setupTitles(ctx) {
  const { page, cfg, L } = ctx;
  const table = page.querySelector('[data-title-table]');

  const render = () => {
    cfg.titles.sort((a, b) => (a.minLevel | 0) - (b.minLevel | 0));

    if (!cfg.titles.length) {
      table.innerHTML = `<div class="reward-empty">${L.titlesEmpty}</div>`;
      return;
    }

    table.innerHTML = cfg.titles.map((t, i) => `
      <div class="title-row" data-title-idx="${i}">
        <div class="title-row-level">
          ${numStepper({ value: t.minLevel, min: 1, max: cfg.maxLevel, data: 'data-title-level' })}
        </div>
        <input type="text" class="input" data-title-name maxlength="40"
               placeholder="${L.titleNamePlaceholder}" value="${escapeHtml(t.name || '')}">
        <button type="button" class="reward-remove" data-remove-title="${i}" title="${L.titleDeleteLabel}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');

    bindNumSteppers(table);

    table.querySelectorAll('[data-title-level] .num-stepper-input').forEach((input) => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.closest('[data-title-idx]').dataset.titleIdx, 10);
        cfg.titles[idx].minLevel = Math.max(1, parseInt(input.value, 10) || 1);
      });
    });

    table.querySelectorAll('[data-title-name]').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = parseInt(input.closest('[data-title-idx]').dataset.titleIdx, 10);
        cfg.titles[idx].name = input.value.trim();
      });
    });

    table.querySelectorAll('[data-remove-title]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cfg.titles.splice(parseInt(btn.dataset.removeTitle, 10), 1);
        render();
      });
    });
  };

  render();

  page.querySelector('[data-add-title]').addEventListener('click', () => {
    cfg.titles.push({ minLevel: 1, name: '' });
    render();
  });
}