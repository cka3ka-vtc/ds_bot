// public/assets/js/views/module-settings/levels/setup/_context.js
/**
 * Единый контекст для всех setupXxx функций.
 * Содержит всё, что секции используют при инициализации:
 *   - DOM-корни (root, page);
 *   - ссылки на state (editors, activeMsgTab);
 *   - данные сервера (channels, textChannels, roles);
 *   - конфиг (cfg) — мутируется секциями;
 *   - утилиты (api, store, toast) и строки (UI, L, M).
 */
export function buildSetupContext(root, state, { api, store, toast, UI, L, M }) {
  return {
    root,
    page: root.querySelector('.module-page'),

    state,
    botId: state.botId,
    guildId: state.guildId,

    channels: state.channels,
    textChannels: state.channels.filter((c) => c.type === 0),
    roles: state.roles,
    cfg: state.cfg,
    bot: state.bot,

    api, store, toast, UI, L, M,
  };
}