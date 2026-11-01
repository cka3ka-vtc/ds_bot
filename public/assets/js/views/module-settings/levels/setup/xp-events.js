// public/assets/js/views/module-settings/levels/setup/xp-events.js
/**
 * Секция «Начисления XP»:
 *   - 4 карточки: message / command / voice / daily;
 *   - toggle каждого события;
 *   - для daily — sync с builtin.daily.enabled выполняется на бэке при
 *     сохранении модуля (PUT /api/modules/levels/config).
 */
export function setupXpEvents(ctx) {
  const { page, cfg } = ctx;

  page.querySelectorAll('[data-event-toggle]').forEach((tgl) => {
    tgl.addEventListener('click', () => {
      const key = tgl.dataset.eventToggle;

      if (key === 'daily') {
        cfg.dailyEnabled = !cfg.dailyEnabled;
        tgl.classList.toggle('on', cfg.dailyEnabled);
        tgl.setAttribute('aria-checked', String(cfg.dailyEnabled));
        page.querySelector('[data-event-card="daily"]').classList.toggle('disabled', !cfg.dailyEnabled);
        return;
      }

      cfg.enabledEvents[key] = !cfg.enabledEvents[key];
      tgl.classList.toggle('on', cfg.enabledEvents[key]);
      tgl.setAttribute('aria-checked', String(cfg.enabledEvents[key]));
      page.querySelector(`[data-event-card="${key}"]`).classList.toggle('disabled', !cfg.enabledEvents[key]);
    });
  });
}