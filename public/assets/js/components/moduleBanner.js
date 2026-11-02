// public/assets/js/components/moduleBanner.js
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';

const DEFAULT_HINT = 'Настройки не будут применяться, пока модуль выключен в общем списке.';

export function renderModuleOffBanner({ moduleKey, moduleName, hint }) {
  return `
    <div class="module-off-banner" data-module-off-banner="${escapeHtml(moduleKey)}">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div>
        <strong>Модуль «${escapeHtml(moduleName)}» выключен</strong>
        <span>${escapeHtml(hint || DEFAULT_HINT)}</span>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" data-module-off-enable>
        Включить модуль
      </button>
    </div>
  `;
}

export function bindModuleOffBanner({ container, botId, guildId, moduleKey, onEnabled }) {
  const banner = container.querySelector(`[data-module-off-banner="${moduleKey}"]`);
  if (!banner) return;
  const btn = banner.querySelector('[data-module-off-enable]');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async () => {
    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Включение...';

    try {
      await api.post(`/api/modules/${moduleKey}/toggle`, {
        botId, guildId, enabled: true,
      });
      toast('Модуль включён', 'success');
      banner.remove();
      onEnabled?.();
    } catch (err) {
      toast('Не удалось включить модуль: ' + (err.data?.error || err.message), 'error');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}