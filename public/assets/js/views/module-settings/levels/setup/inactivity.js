// public/assets/js/views/module-settings/levels/setup/inactivity.js
/**
 * Секция «Снятие за неактивность».
 * Возвращает { updateUI } — используется в setupRewards, чтобы при
 * изменении состояния наград обновить видимость warning и disabled-строки.
 */
export function setupInactivity(ctx) {
  const { page, cfg, L } = ctx;

  const block = page.querySelector('.inactivity');
  const toggle = page.querySelector('[data-inactivity-toggle]');
  const warning = page.querySelector('[data-inactivity-warning]');
  const warningText = page.querySelector('[data-inactivity-warning-text]');
  const removeRolesToggle = page.querySelector('[data-inactivity-remove-roles-toggle]');

  const updateUI = () => {
    toggle.classList.toggle('on', cfg.inactivity.enabled);
    toggle.setAttribute('aria-checked', String(cfg.inactivity.enabled));
    block.classList.toggle('is-on', cfg.inactivity.enabled);
    warning.classList.toggle('show', cfg.inactivity.enabled);

    const remove = cfg.inactivity.removeRolesOnDecrease && cfg.rewards.enabled;
    warningText.textContent = L.inactivityWarning(
      cfg.inactivity.days,
      cfg.inactivity.penaltyXp,
      remove,
    );
  };

  toggle.addEventListener('click', () => {
    cfg.inactivity.enabled = !cfg.inactivity.enabled;
    updateUI();
  });

  removeRolesToggle.addEventListener('click', () => {
    if (!cfg.rewards.enabled) return;
    cfg.inactivity.removeRolesOnDecrease = !cfg.inactivity.removeRolesOnDecrease;
    removeRolesToggle.classList.toggle('on', cfg.inactivity.removeRolesOnDecrease);
    removeRolesToggle.setAttribute('aria-checked', String(cfg.inactivity.removeRolesOnDecrease));
    updateUI();
  });

  updateUI();

  return { updateUI };
}