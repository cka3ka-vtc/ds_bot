// public/assets/js/views/module-settings/moderation/setup/save.js
// Сохранение конфига. enabled управляется в разделе «Модули».

import { UI } from '/shared/ui-strings.js';
import { store } from '../../../../core/store.js';

const S = UI.moderationSettings;

export function setupSave(ctx) {
  const { root, api, botId, guildId, cfg, toast } = ctx;
  const btn = root.querySelector('[data-save]');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${S.saving}`;

    try {
      await api.put('/api/moderation/config', {
        botId,
        guildId,
        config: cfg,
      });
      toast(S.saved, 'success');

      try {
        const mods = await api.get(`/api/modules?botId=${botId}&guildId=${guildId}`);
        store.set('modulesEnabledCount', mods.filter((m) => m.enabled).length);
      } catch { /* ignore */ }
    } catch (err) {
      const code = err.data?.error;
      const map = {
        validation_failed: 'Проверьте заполнение полей',
      };
      toast(map[code] || ('Ошибка: ' + (err.data?.error || err.message)), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}