// public/assets/js/views/settings/chips.js
import { escapeHtml } from '../../core/utils.js';

export function chipHtml(roleId, role) {
  const color = role?.color || '#5b6373';
  const name = role?.name || roleId;
  return `
    <span class="exclusion-chip" data-role-id="${roleId}">
      <span class="role-color-dot" style="background:${color};"></span>
      ${escapeHtml(name)}
      <button type="button" data-remove="${roleId}" aria-label="Удалить">×</button>
    </span>`;
}

export function bindChipRemove(view) {
  view.container.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.closest('.exclusion-chip')?.remove();
      ensureEmptyState(view.container);
    });
  });
}

export function ensureEmptyState(container) {
  const list = container.querySelector('#exclusionList');
  if (!list) return;
  const hasChips = list.querySelectorAll('.exclusion-chip').length > 0;
  const empty = list.querySelector('.exclusion-empty');
  if (hasChips && empty) empty.remove();
  if (!hasChips && !empty) {
    list.insertAdjacentHTML('beforeend', '<span class="exclusion-empty">Пока нет исключений</span>');
  }
}