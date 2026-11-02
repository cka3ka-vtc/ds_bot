// public/assets/js/views/module-settings/moderation/index.js
// Точка входа страницы настроек модуля «Автомодерация».

import { api } from '../../../core/api.js';
import { store } from '../../../core/store.js';
import { toast } from '../../../core/toast.js';
import { escapeHtml } from '../../../core/utils.js';
import { mergeModerationConfig } from '/shared/moderation-config.js';
import { UI } from '/shared/ui-strings.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../../components/moduleBanner.js';

import { buildPageHTML } from './ui.js';
import { buildSetupContext } from './setup/_context.js';
import { setupFilters } from './setup/filters.js';
import { setupTest } from './setup/test.js';
import { setupSave } from './setup/save.js';

export default {
  container: null,
  state: null,

  async render(container) {
    this.container = container;
    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');

    if (!botId || !guildId) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-shield-halved"></i>
          <strong>${UI.common.selectServer}</strong>
          <span>${UI.common.selectServerHint}</span>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="boot-screen">
        <i class="fa-solid fa-circle-notch fa-spin"></i>
        <span>${UI.common.loading}</span>
      </div>`;

    let channels = [];
    let roles = [];
    let stored = { enabled: false, config: {} };

    try {
      const [chs, rls, cfg] = await Promise.all([
        // includeVoice=1 — чтобы голосовые и stage-каналы тоже попадали в picker
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}&includeVoice=1`),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/moderation/config?botId=${botId}&guildId=${guildId}`),
      ]);
      channels = chs || [];
      roles = rls || [];
      stored = cfg || stored;
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>${UI.common.errorLoad}</strong>
          <span>${escapeHtml(err.message)}</span>
        </div>`;
      return;
    }

    const cfg = mergeModerationConfig(stored.config);
    const bots = store.get('bots') || [];
    const bot = bots.find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    this.state = {
      botId,
      guildId,
      channels,
      roles,
      bot,
      enabled: !!stored.enabled,
      config: cfg,
      _editors: {},
    };

    container.innerHTML = buildPageHTML(this.state);

    /* ─── Баннер «Модуль выключен» ─── */
    if (!this.state.enabled) {
      container.querySelector('.module-page')?.insertAdjacentHTML(
        'afterbegin',
        renderModuleOffBanner({
          moduleKey: 'moderation',
          moduleName: 'Автомодерация',
          hint: 'Фильтры и наказания не будут применяться, пока модуль выключен.',
        }),
      );
    }

this._setup(container, this.state);

bindModuleOffBanner({
  container,
  botId: this.state.botId,
  guildId: this.state.guildId,
  moduleKey: 'moderation',
});
  },

  _setup(root, state) {
    const ctx = buildSetupContext(root, state, {
      api,
      store,
      toast,
      S: UI.moderationSettings,
      bot: state.bot,
    });

    setupFilters(ctx);
    setupTest(ctx);
    setupSave(ctx);
  },

  destroy() {
    const editors = this.state?._editors || {};
    for (const ed of Object.values(editors)) {
      try { ed?.destroy?.(); } catch {}
    }
    this.state = null;
    this.container = null;
    document.querySelectorAll('.picker-popup, .tokens-dropdown').forEach((p) => p.remove());
  },
};