/* ============================================================
   Подсказки: иконка ⓘ с tooltip и строчная подпись под полем.
   ============================================================ */

import { escapeHtml } from '../utils.js';

/**
 * Иконка ⓘ с tooltip — рядом с label.
 * @param {string} text - «что произойдёт, если…»
 * @returns {string} HTML
 */
export function hintIcon(text) {
  return `<span class="hint-icon" tabindex="0" role="button" aria-label="Подсказка">
    <i class="fa-solid fa-circle-info"></i>
    <span class="hint-tooltip">${escapeHtml(text)}</span>
  </span>`;
}

/**
 * Строчная подпись под полем.
 * @param {string} text
 * @returns {string} HTML
 */
export function hintLine(text) {
  return `<span class="hint hint-line"><i class="fa-solid fa-circle-info"></i> ${escapeHtml(text)}</span>`;
}