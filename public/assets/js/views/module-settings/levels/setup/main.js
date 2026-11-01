// public/assets/js/views/module-settings/levels/setup/main.js
import { bindChannelPicker } from '../../pickers.js';

/**
 * «Основное»:
 *   - канал объявлений (только текстовые);
 *   - формула уровней;
 *   - max level и boost multiplier — здесь не обрабатываются:
 *     их значения читаются в save через [data-max-level] / [data-boost-multiplier].
 */
export function setupMain(ctx) {
  const { page, cfg, textChannels, botId, guildId, api, L } = ctx;

  /* ── Канал объявлений ── */
  const statusEl = page.querySelector('[data-channel-status]');
  const setStatus = (status, tip) => {
    statusEl.className = 'channel-status ' + status;
    const icons = {
      empty: 'fa-circle-minus',
      checking: 'fa-circle-notch fa-spin',
      ok: 'fa-circle-check',
      error: 'fa-circle-xmark',
    };
    statusEl.innerHTML = `<i class="fa-solid ${icons[status] || icons.empty}"></i>`;
    if (tip) statusEl.setAttribute('data-tooltip', tip);
    else statusEl.removeAttribute('data-tooltip');
  };

  const picker = bindChannelPicker(page, {
    id: 'levels_channel',
    channels: textChannels,
    onSelect: async (ch) => {
      cfg.announceChannelId = ch?.id || '';
      if (!ch) return setStatus('empty');
      setStatus('checking', `Проверка прав в #${ch.name}...`);
      try {
        const perms = await api.get(
          `/api/guilds/channels/${ch.id}/permissions?botId=${botId}&guildId=${guildId}`,
        );
        if (perms.channelExists && perms.canSend) setStatus('ok', 'Бот может отправлять сообщения');
        else setStatus('error', 'Нет прав на отправку');
      } catch {
        setStatus('error', 'Ошибка проверки');
      }
    },
  });
  if (cfg.announceChannelId) {
    const ch = textChannels.find((c) => c.id === cfg.announceChannelId);
    if (ch) picker?.setValue(ch);
  }

  /* ── Формула ── */
  const formulaHint = page.querySelector('[data-formula-hint]');
  const updateFormulaHint = () => {
    formulaHint.textContent = cfg.formula === 'linear'
      ? L.formulaHint.linear(cfg.linearBase)
      : L.formulaHint.classic;
  };
  updateFormulaHint();

  page.querySelectorAll('[data-formula-seg] .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      page.querySelectorAll('[data-formula-seg] .seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn));
      cfg.formula = btn.dataset.value;
      updateFormulaHint();
    });
  });
}