// public/assets/js/views/module-settings/levels/setup/save.js
import { store } from '../../../../core/store.js';

/**
 * Кнопка «Сохранить»:
 *   - читает актуальные значения из num-stepper'ов (max level, boost,
 *     inactivity days/penalty, XP event cards, daily XP);
 *   - забирает конфиги всех открытых редакторов из state.editors;
 *   - валидирует (канал, хотя бы одно событие, награды, звания);
 *   - PUT /api/modules/levels/config;
 *   - на бэке срабатывает синхронизация dailyEnabled ↔ builtin.daily.enabled
 *     и syncGuildCommands, чтобы /daily появлялся/исчезал в Discord.
 */
export function setupSave(ctx) {
  const { page, cfg, state, botId, guildId, api, toast, store: ctxStore, UI, L } = ctx;

  const MSG_TABS = ['levelUp', 'rank', 'leaderboard', 'daily'];

  page.querySelector('[data-save]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;

    /* ── 1) Читаем числовые поля из XP event cards ── */
    page.querySelectorAll('[data-event-card]').forEach((card) => {
      const key = card.dataset.eventCard;

      if (key === 'daily') {
        const xpInput = card.querySelector('[data-daily-xp] .num-stepper-input');
        if (xpInput) cfg.dailyXp = Math.max(1, parseInt(xpInput.value, 10) || 150);
        return;
      }

      const inputs = card.querySelectorAll('.num-stepper-input');
      if (inputs[0]) cfg.events[key].xp = Math.max(0, parseInt(inputs[0].value, 10) || 0);
      if (inputs[1]) cfg.events[key].cooldownMin = Math.max(1, parseInt(inputs[1].value, 10) || 1);
    });

    /* ── 2) Читаем max level / boost / inactivity days / penalty ── */
    const maxInput = page.querySelector('[data-max-level] .num-stepper-input');
    if (maxInput) cfg.maxLevel = Math.max(1, parseInt(maxInput.value, 10) || 100);

    const boostInput = page.querySelector('[data-boost-multiplier] .num-stepper-input');
    if (boostInput) cfg.boostMultiplier = Math.max(1, parseFloat(boostInput.value) || 2);

    const daysInput = page.querySelector('[data-inactivity-days] .num-stepper-input');
    if (daysInput) cfg.inactivity.days = Math.max(1, parseInt(daysInput.value, 10) || 30);

    const penaltyInput = page.querySelector('[data-inactivity-penalty] .num-stepper-input');
    if (penaltyInput) cfg.inactivity.penaltyXp = Math.max(1, parseInt(penaltyInput.value, 10) || 50);

    /* ── 3) Сохраняем все редакторы ── */
    for (const tabKey of MSG_TABS) {
      const ed = state.editors[tabKey];
      if (ed) cfg.messages[tabKey] = ed.getConfig();
    }

    /* ── 4) Валидация ── */
    if (!cfg.announceChannelId) return toast(L.needChannel, 'warn');

    const anyEvent =
      cfg.enabledEvents.message
      || cfg.enabledEvents.command
      || cfg.enabledEvents.voice
      || cfg.dailyEnabled;
    if (!anyEvent) return toast(L.needEvent, 'warn');

    if (cfg.rewards.enabled && cfg.rewards.entries.some((r) => !r.roleId || !r.level)) {
      return toast(L.needRewards, 'warn');
    }

    cfg.titles = cfg.titles.filter((t) => t.name && t.name.trim());
    if (!cfg.titles.length) return toast(L.needTitles, 'warn');

    /* ── 5) PUT ── */
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.saving}`;
    try {
      await api.put('/api/modules/levels/config', {
        botId, guildId, config: cfg,
      });
      toast(L.saved, 'success');

      try {
        const mods = await api.get(`/api/modules?botId=${botId}&guildId=${guildId}`);
        ctxStore.set('modulesEnabledCount', mods.filter((m) => m.enabled).length);
      } catch {}
    } catch (err) {
      const map = {
        invalid_channel: UI.errors.invalid_channel,
        validation_failed: UI.errors.validation_failed,
      };
      toast(
        map[err.data?.error] || (UI.common.errorSave + ': ' + (err.data?.error || err.message)),
        'error',
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}