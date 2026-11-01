// public/assets/js/views/module-settings/moderation/setup/_context.js
import {
  FILTER_KEYS, FILTER_META, ACTION_OPTIONS, ESCALATION_ACTIONS,
} from '/shared/moderation-config.js';

export function buildSetupContext(root, state, extras) {
  return {
    root,
    state,
    cfg: state.config,
    channels: state.channels || [],
    roles: state.roles || [],
    botId: state.botId,
    guildId: state.guildId,
    bot: extras.bot || { name: 'Bot', avatarUrl: null },

    api: extras.api,
    store: extras.store,
    toast: extras.toast,
    S: extras.S,

    FILTER_KEYS,
    FILTER_META,
    ACTION_OPTIONS,
    ESCALATION_ACTIONS,

    _editors: {},                 // MessageEditor-ы: dm, log, filters[key]
  };
}