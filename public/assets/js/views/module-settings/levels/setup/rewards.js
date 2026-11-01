// public/assets/js/views/module-settings/levels/setup/rewards.js
import { bindRolePicker, rolePickerHTML } from '../../pickers.js';
import { bindNumSteppers } from '../helpers.js';

/**
 * Секция «Награды за уровни»:
 *   - toggle «включить награды»;
 *   - таблица: уровень → роль;
 *   - блокировка блока при выключенных наградах;
 *   - через onRewardsChange оповещаем inactivity.js об изменении состояния.
 */
export function setupRewards(ctx, { onRewardsChange } = {}) {
  const { page, cfg, roles, L } = ctx;

  const toggle = page.querySelector('[data-rewards-toggle]');
  const panel = page.querySelector('[data-rewards-panel]');
  const disabledNote = page.querySelector('[data-rewards-disabled-note]');
  const removeRolesRow = page.querySelector('[data-inactivity-roles-row]');
  const removeRolesToggle = page.querySelector('[data-inactivity-remove-roles-toggle]');
  const removeRolesNote = page.querySelector('[data-inactivity-roles-note]');
  const table = page.querySelector('[data-reward-table]');

  /* ── Доступные роли для i-й строки (без дублей) ── */
  const availableFor = (idx) => {
    const othersUsed = new Set(
      cfg.rewards.entries.map((x, xi) => (xi !== idx ? x.roleId : null)).filter(Boolean),
    );
    return roles.filter((r) => !othersUsed.has(r.id) || r.id === cfg.rewards.entries[idx].roleId);
  };

  /* ── Перерисовка таблицы ── */
  const renderTable = () => {
    if (!cfg.rewards.entries.length) {
      table.innerHTML = `<div class="reward-empty">${L.rewardsEmpty}</div>`;
      return;
    }

    table.innerHTML = cfg.rewards.entries.map((r, i) => `
      <div class="reward-row" data-reward-idx="${i}">
        <div class="num-stepper" data-num-stepper>
          <button type="button" class="num-stepper-btn" data-step="-1" aria-label="Уменьшить"><i class="fa-solid fa-minus"></i></button>
          <input type="number" class="num-stepper-input" value="${r.level || 1}" min="1" max="${cfg.maxLevel}" data-reward-level>
          <button type="button" class="num-stepper-btn" data-step="1" aria-label="Увеличить"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="reward-role">
          ${rolePickerHTML({ id: `reward_${i}`, value: r.roleId || '', roles: availableFor(i) })}
        </div>
        <button type="button" class="reward-remove" data-remove-reward="${i}" title="${L.rewardsDeleteLabel}">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `).join('');

    bindNumSteppers(table);

    table.querySelectorAll('[data-reward-level]').forEach((input) => {
      input.addEventListener('change', () => {
        const idx = parseInt(input.closest('[data-reward-idx]').dataset.rewardIdx, 10);
        cfg.rewards.entries[idx].level = Math.max(1, parseInt(input.value, 10) || 1);
      });
    });

    table.querySelectorAll('[data-role-picker]').forEach((el) => {
      const id = el.dataset.rolePicker;
      const idx = parseInt(id.replace('reward_', ''), 10);
      bindRolePicker(table, {
        id,
        roles: availableFor(idx),
        onSelect: (role) => {
          cfg.rewards.entries[idx].roleId = role?.id || '';
          renderTable();
        },
      });
    });

    table.querySelectorAll('[data-remove-reward]').forEach((btn) => {
      btn.addEventListener('click', () => {
        cfg.rewards.entries.splice(parseInt(btn.dataset.removeReward, 10), 1);
        renderTable();
      });
    });
  };

  /* ── Состояние секции ── */
  const applyState = () => {
    toggle.classList.toggle('on', cfg.rewards.enabled);
    toggle.setAttribute('aria-checked', String(cfg.rewards.enabled));
    toggle.title = cfg.rewards.enabled ? L.rewardsDisable : L.rewardsEnable;

    panel.classList.toggle('disabled', !cfg.rewards.enabled);
    disabledNote.hidden = cfg.rewards.enabled;

    removeRolesRow.classList.toggle('is-disabled', !cfg.rewards.enabled);
    removeRolesToggle.disabled = !cfg.rewards.enabled;
    removeRolesToggle.setAttribute('aria-disabled', String(!cfg.rewards.enabled));
    removeRolesNote.textContent = cfg.rewards.enabled
      ? L.inactivityRemoveRolesOn
      : L.inactivityRemoveRolesOff;

    onRewardsChange?.();
  };

  toggle.addEventListener('click', () => {
    cfg.rewards.enabled = !cfg.rewards.enabled;
    applyState();
  });

  page.querySelector('[data-add-reward]').addEventListener('click', () => {
    cfg.rewards.entries.push({ level: 5, roleId: '' });
    renderTable();
  });

  renderTable();
  applyState();
}