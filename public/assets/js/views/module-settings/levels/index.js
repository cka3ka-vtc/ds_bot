// public/assets/js/views/module-settings/levels/index.js
import { api } from '../../../core/api.js';
import { store } from '../../../core/store.js';
import { toast } from '../../../core/toast.js';
import { escapeHtml } from '../../../core/utils.js';
import { mergeLevelsConfig, bindNumSteppers } from './helpers.js';
import { buildPageHTML } from './ui.js';
import { UI } from '/shared/ui-strings.js';
import { LEVELS_MSG } from '/shared/command-editor-strings.js';

import { buildSetupContext } from './setup/_context.js';
import { setupMain } from './setup/main.js';
import { setupInactivity } from './setup/inactivity.js';
import { setupXpEvents } from './setup/xp-events.js';
import { setupTitles } from './setup/titles.js';
import { setupRewards } from './setup/rewards.js';
import { setupExclusions } from './setup/exclusions.js';
import { setupMessages } from './setup/messages.js';
import { setupSave } from './setup/save.js';

const L = UI.levels;
const M = LEVELS_MSG;

export default {
  container: null,
  state: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-ranking-star"></i><strong>${UI.common.selectServer}</strong></div>`;
      return;
    }

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    let channels = [];
    let roles = [];
    let storedCfg = { enabled: false, config: {} };
    try {
      const [chs, rls, cfg] = await Promise.all([
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}&includeVoice=1`),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules/levels/config?botId=${botId}&guildId=${guildId}`),
      ]);
      channels = chs || [];
      roles = rls || [];
      storedCfg = cfg || { enabled: false, config: {} };
    } catch (err) {
      container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><strong>${UI.common.errorLoad}</strong><span>${escapeHtml(err.message)}</span></div>`;
      return;
    }

    const cfg = mergeLevelsConfig(storedCfg.config);
    const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    this.state = {
      botId, guildId, channels, roles, cfg, bot,
      editors: {},
      activeMsgTab: 'levelUp',
    };
    container.innerHTML = buildPageHTML(cfg, channels);
    this._setup(container, this.state);
  },

  _setup(root, state) {
    const ctx = buildSetupContext(root, state, {
      api, store, toast, UI, L, M,
    });

    // Общие num-steppers (maxLevel, boost) — до setupMain, чтобы ввод сразу работал.
    bindNumSteppers(ctx.page);

    setupMain(ctx);

    const inactivityApi = setupInactivity(ctx);

    setupXpEvents(ctx);
    setupTitles(ctx);
    setupRewards(ctx, { onRewardsChange: inactivityApi.updateUI });
    setupExclusions(ctx);
    setupMessages(ctx);
    setupSave(ctx);
  },

  destroy() {
    if (this.state?.editors) {
      for (const ed of Object.values(this.state.editors)) {
        try { ed?.destroy?.(); } catch {}
      }
    }
    this.state = null;
    this.container = null;
    document.querySelectorAll('.picker-popup, .time-dropdown, .tokens-dropdown').forEach((p) => p.remove());
  },
};