// public/assets/js/views/module-settings/greetings.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml } from '../../core/utils.js';
import { channelPickerHTML, bindChannelPicker } from './pickers.js';
import { MessageEditor, emptyMessageConfig } from './message-editor.js';
import { mergeGreetingsConfig } from '/shared/greetings-config.js';
import { UI } from '/shared/ui-strings.js';

const G = UI.greetings;

function setChannelStatus(el, status, tooltip) {
  if (!el) return;
  el.className = 'channel-status ' + status;
  const icons = {
    empty: 'fa-circle-minus',
    checking: 'fa-circle-notch fa-spin',
    ok: 'fa-circle-check',
    error: 'fa-circle-xmark',
  };
  el.innerHTML = `<i class="fa-solid ${icons[status] || icons.empty}"></i>`;
  if (tooltip) el.setAttribute('data-tooltip', tooltip);
  else el.removeAttribute('data-tooltip');
}

function toggleHTML({ eventKey, title, description, checked }) {
  return `
    <label class="gr-toggle ${checked ? 'is-on' : ''}" data-toggle-key="${eventKey}">
      <input type="checkbox" data-event="${eventKey}" ${checked ? 'checked' : ''}>
      <div class="gr-toggle-content">
        <strong>${title}</strong>
        <span>${description}</span>
      </div>
      <span class="gr-toggle-state" aria-hidden="true"></span>
    </label>
  `;
}

function buildPageHTML(cfg) {
  const activeTab = cfg.events.join ? 'join' : 'leave';
  const anyEvent = cfg.events.join || cfg.events.leave;

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> ${UI.common.backToModules.replace('← ', '')}
          </a>
          <h1>${G.pageTitle}</h1>
          <p>${G.pageSubtitle}</p>
        </div>
      </div>

      <div class="gr-settings">
        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${G.channelTitle}</h3>
                <p>${G.channelSubtitle}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="channel-row">
                <div class="channel-status empty" data-channel-status data-tooltip="${G.channelStatus.empty}">
                  <i class="fa-solid fa-circle-minus"></i>
                </div>
                ${channelPickerHTML({ id: 'greetings_channel' })}
              </div>

              <div class="channel-test-actions" data-test-actions ${!anyEvent ? 'hidden' : ''}>
                <button type="button" class="btn btn-ghost btn-sm" data-test-message="join" ${!cfg.events.join ? 'hidden' : ''}>
                  <i class="fa-solid fa-paper-plane"></i> ${G.testJoin}
                </button>
                <button type="button" class="btn btn-ghost btn-sm" data-test-message="leave" ${!cfg.events.leave ? 'hidden' : ''}>
                  <i class="fa-solid fa-paper-plane"></i> ${G.testLeave}
                </button>
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${G.eventsTitle}</h3>
                <p>${G.eventsSubtitle}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="gr-toggles">
                ${toggleHTML({ eventKey: 'join', title: G.eventJoinTitle, description: G.eventJoinDesc, checked: cfg.events.join })}
                ${toggleHTML({ eventKey: 'leave', title: G.eventLeaveTitle, description: G.eventLeaveDesc, checked: cfg.events.leave })}
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${G.messagesTitle}</h3>
              <p>${G.messagesSubtitle}</p>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="gr-tabs" data-tabs ${anyEvent ? '' : 'hidden'}>
              <button type="button" class="gr-tab ${activeTab === 'join' ? 'active' : ''}" data-tab="join" ${!cfg.events.join ? 'hidden' : ''}>${G.tabJoin}</button>
              <button type="button" class="gr-tab ${activeTab === 'leave' ? 'active' : ''}" data-tab="leave" ${!cfg.events.leave ? 'hidden' : ''}>${G.tabLeave}</button>
            </div>
            <div class="gr-editor-container" data-editor-container ${anyEvent ? '' : 'hidden'}></div>
            <div class="gr-messages-empty" data-messages-empty ${anyEvent ? 'hidden' : ''}>
              <i class="fa-solid fa-bell-slash" aria-hidden="true"></i>
              <strong>${G.emptyTitle}</strong>
              <span>${G.emptyHint}</span>
            </div>
          </div>
        </section>
      </div>

      <div class="module-page-savebar">
        <a href="#modules" class="btn btn-ghost">${UI.common.cancel}</a>
        <button type="button" class="btn btn-primary" data-save>
          <i class="fa-solid fa-check"></i> ${UI.common.save}
        </button>
      </div>
    </div>
  `;
}

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
          <i class="fa-solid fa-hand"></i>
          <strong>${UI.common.selectServer}</strong>
          <span>${UI.common.selectServerHint}</span>
          <a href="#modules" class="btn btn-ghost" style="margin-top:16px;">${UI.common.backToModules}</a>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    let channels = [];
    let roles = [];
    let serverConfig = { enabled: false, config: {} };
    try {
      const [chs, rls, cfg] = await Promise.all([
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules/greetings/config?botId=${botId}&guildId=${guildId}`),
      ]);
      channels = chs || [];
      roles = rls || [];
      serverConfig = cfg || { enabled: false, config: {} };
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>${UI.common.errorLoad}</strong>
          <span>${escapeHtml(err.message)}</span>
          <a href="#modules" class="btn btn-ghost" style="margin-top:16px;">${UI.common.backToModules}</a>
        </div>`;
      return;
    }

    const cfg = mergeGreetingsConfig(serverConfig.config);
    if (!cfg.messages.join) cfg.messages.join = emptyMessageConfig();
    if (!cfg.messages.leave) cfg.messages.leave = emptyMessageConfig();

    const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    this.state = {
      activeTab: cfg.events.join ? 'join' : 'leave',
      editor: null,
      config: cfg,
      permissions: null,
      botId, guildId,
    };

    container.innerHTML = buildPageHTML(cfg);
    this._setupHandlers(container, this.state, { channels, roles, bot });
  },

  destroy() {
    if (this.state?.editor) this.state.editor.destroy();
    this.state = null;
    this.container = null;
    document.querySelectorAll('.picker-popup, .time-dropdown, .tokens-dropdown').forEach((p) => p.remove());
  },

  _setupHandlers(container, state, ctx) {
    const { channels, roles, bot } = ctx;
    const root = container.querySelector('.module-page');
    const statusEl = root.querySelector('[data-channel-status]');

    const checkPermissions = async (channel) => {
      if (!channel) {
        state.permissions = null;
        setChannelStatus(statusEl, 'empty', G.channelStatus.empty);
        return;
      }
      setChannelStatus(statusEl, 'checking', G.channelStatus.checking(channel.name));
      try {
        const perms = await api.get(
          `/api/guilds/channels/${channel.id}/permissions?botId=${state.botId}&guildId=${state.guildId}`,
        );
        state.permissions = perms;

        if (!perms || !perms.channelExists) {
          setChannelStatus(statusEl, 'error', G.channelStatus.notFound);
          return;
        }

        const missing = [];
        if (!perms.canViewChannel) missing.push('Просмотр канала');
        if (!perms.canSend) missing.push('Отправка сообщений');
        if (!perms.canEmbed) missing.push('Встраивание ссылок');
        if (!perms.canAttachFiles) missing.push('Прикрепление файлов');

        if (missing.length === 0) setChannelStatus(statusEl, 'ok', G.channelStatus.ok);
        else setChannelStatus(statusEl, 'error', G.channelStatus.missing(missing.join(', ')));
      } catch (err) {
        setChannelStatus(statusEl, 'error', G.channelStatus.checkFailed + ': ' + (err.message || ''));
      }
    };

    const picker = bindChannelPicker(root, {
      id: 'greetings_channel',
      channels,
      onSelect: async (ch) => {
        state.config.channelId = ch?.id || '';
        await checkPermissions(ch);
      },
    });

    if (state.config.channelId) {
      const ch = channels.find((c) => c.id === state.config.channelId);
      if (ch) picker?.setValue(ch);
    }

    const switchTab = (tab) => {
      if (state.activeTab === tab) return;
      if (state.editor) {
        state.config.messages[state.activeTab] = state.editor.getConfig();
        state.editor.destroy();
        state.editor = null;
      }
      state.activeTab = tab;
      root.querySelectorAll('.gr-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
      renderEditor(root, state, bot, roles);
    };

    const syncToggleClasses = () => {
      root.querySelectorAll('.gr-toggle').forEach((label) => {
        const input = label.querySelector('input[data-event]');
        if (input) label.classList.toggle('is-on', input.checked);
      });
    };

    const syncSectionVisibility = () => {
      const joinOn = !!state.config.events.join;
      const leaveOn = !!state.config.events.leave;
      const anyOn = joinOn || leaveOn;

      const tabsEl = root.querySelector('[data-tabs]');
      const editorEl = root.querySelector('[data-editor-container]');
      const emptyEl = root.querySelector('[data-messages-empty]');
      const testWrap = root.querySelector('[data-test-actions]');
      const testJoin = root.querySelector('[data-test-message="join"]');
      const testLeave = root.querySelector('[data-test-message="leave"]');

      if (tabsEl) {
        tabsEl.hidden = !anyOn;
        const joinTab = tabsEl.querySelector('[data-tab="join"]');
        const leaveTab = tabsEl.querySelector('[data-tab="leave"]');
        if (joinTab) joinTab.hidden = !joinOn;
        if (leaveTab) leaveTab.hidden = !leaveOn;
      }
      if (editorEl) editorEl.hidden = !anyOn;
      if (emptyEl) emptyEl.hidden = anyOn;
      if (testWrap) testWrap.hidden = !anyOn;
      if (testJoin) testJoin.hidden = !joinOn;
      if (testLeave) testLeave.hidden = !leaveOn;
    };

    const updateToggles = () => {
      const joinOn = root.querySelector('[data-event="join"]').checked;
      const leaveOn = root.querySelector('[data-event="leave"]').checked;
      state.config.events.join = joinOn;
      state.config.events.leave = leaveOn;

      syncToggleClasses();
      syncSectionVisibility();

      const activeTabIsValid =
        (state.activeTab === 'join' && joinOn) ||
        (state.activeTab === 'leave' && leaveOn);

      if (!joinOn && !leaveOn) toast(G.needEvent, 'warn');
      else if (!activeTabIsValid) switchTab(joinOn ? 'join' : 'leave');
      else if (!state.editor) renderEditor(root, state, bot, roles);
    };

    root.querySelectorAll('[data-event]').forEach((el) => {
      el.addEventListener('change', updateToggles);
    });
    syncToggleClasses();

    root.querySelectorAll('.gr-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    root.querySelectorAll('[data-test-message]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const which = btn.dataset.testMessage;
        if (!state.config.channelId) return toast(G.needChannel, 'warn');
        if (state.permissions && state.permissions.canSend === false) {
          return toast(UI.errors.send_failed, 'error');
        }

        if (state.editor) state.config.messages[state.activeTab] = state.editor.getConfig();

        const orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.sending}`;

        try {
          await api.post('/api/modules/greetings/test', {
            botId: state.botId,
            guildId: state.guildId,
            which,
            channelId: state.config.channelId,
            messageConfig: state.config.messages[which],
          });
          toast(which === 'join' ? G.testJoinSent : G.testLeaveSent, 'success');
        } catch (err) {
          const code = err.data?.error;
          const map = { ...UI.errors };
          toast(map[code] || (UI.common.error + ': ' + (err.data?.details || err.message)), 'error');
        } finally {
          btn.disabled = false;
          btn.innerHTML = orig;
        }
      });
    });

    if (state.config.events.join || state.config.events.leave) {
      renderEditor(root, state, bot, roles);
    }
    syncSectionVisibility();

    root.querySelector('[data-save]').addEventListener('click', () => this._save(state, root));
  },

  async _save(state, root) {
    if (state.editor) state.config.messages[state.activeTab] = state.editor.getConfig();
    if (!state.config.channelId) return toast(G.needChannel, 'warn');
    if (!state.config.events.join && !state.config.events.leave) return toast(G.needEvent, 'warn');

    const btn = root.querySelector('[data-save]');
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.saving}`;

    try {
      const payload = {
        channelId: state.config.channelId,
        events: {
          join: !!state.config.events.join,
          leave: !!state.config.events.leave,
        },
        messages: state.config.messages,
      };
      await api.put('/api/modules/greetings/config', {
        botId: state.botId, guildId: state.guildId, config: payload,
      });
      toast(G.saved, 'success');

      try {
        const mods = await api.get(`/api/modules?botId=${state.botId}&guildId=${state.guildId}`);
        store.set('modulesEnabledCount', mods.filter((m) => m.enabled).length);
      } catch {}
    } catch (err) {
      const code = err.data?.error;
      const map = { invalid_channel: UI.errors.invalid_channel, validation_failed: UI.errors.validation_failed };
      toast(map[code] || (UI.common.errorSave + ': ' + (err.data?.error || err.message)), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = html;
    }
  },
};

function renderEditor(root, state, bot, roles) {
  const container = root.querySelector('[data-editor-container]');
  container.innerHTML = '';
  const initial = state.config.messages[state.activeTab] || emptyMessageConfig();
  const editor = new MessageEditor(container, initial, {
    bot, roles,
    context: 'greetings',
    presetKey: state.activeTab === 'join' ? 'greetings.join' : 'greetings.leave',
    guildId: state.guildId,
    botId: state.botId,
  });
  editor.onChange = (cfg) => { state.config.messages[state.activeTab] = cfg; };
  editor.mount();
  state.editor = editor;
}