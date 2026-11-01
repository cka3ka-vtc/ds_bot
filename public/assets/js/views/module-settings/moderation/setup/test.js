// public/assets/js/views/module-settings/moderation/setup/test.js
// Проверка правил: отправка текста в POST /api/moderation/test,
// отрисовка результата в плашке.

import { UI } from '/shared/ui-strings.js';
import { escapeHtml } from '../../../../core/utils.js';

const S = UI.moderationSettings;

export function setupTest(ctx) {
  const { root, api, botId, guildId } = ctx;
  const btn = root.querySelector('[data-test-run]');
  const input = root.querySelector('[data-test-input]');
  const result = root.querySelector('[data-test-result]');
  if (!btn || !input || !result) return;

  btn.addEventListener('click', async () => {
    const text = (input.value || '').trim();
    if (!text) {
      ctx.toast('Введите текст для проверки', 'warn');
      return;
    }

    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Проверка...';

    try {
      const res = await api.post('/api/moderation/test', { botId, guildId, text });
      const hits = res?.hits || [];
      result.hidden = false;
      result.className = 'gr-perm-status ' + (hits.length ? 'warn' : 'ok');
      if (!hits.length) {
        result.innerHTML = `
          <i class="fa-solid fa-circle-check"></i>
          <div>
            <strong>Ни один фильтр не сработал</strong>
            <span>${S.testNoHit}</span>
          </div>`;
      } else {
        const list = hits.map((h) =>
          `<code>${escapeHtml(h.filter)}</code>: ${escapeHtml(h.reason)}`).join(' · ');
        result.innerHTML = `
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <strong>Сработали фильтры: ${hits.length}</strong>
            <span>${list}</span>
          </div>`;
      }
    } catch (err) {
      result.hidden = false;
      result.className = 'gr-perm-status error';
      result.innerHTML = `
        <i class="fa-solid fa-circle-xmark"></i>
        <div>
          <strong>Ошибка проверки</strong>
          <span>${escapeHtml(err.data?.error || err.message)}</span>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}