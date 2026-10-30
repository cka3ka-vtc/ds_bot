// public/assets/js/views/module-settings/levels/index.js
import { api } from '../../../core/api.js';
import { store } from '../../../core/store.js';
import { toast } from '../../../core/toast.js';
import { escapeHtml } from '../../../core/utils.js';
import { bindChannelPicker, bindRolePicker, rolePickerHTML } from '../pickers.js';
import { MessageEditor, emptyMessageConfig } from '../message-editor.js';
import { mergeLevelsConfig, bindNumSteppers, numStepper } from './helpers.js';
import { buildPageHTML } from './ui.js';
import { UI } from '/shared/ui-strings.js';
import { LEVELS_MSG } from '/shared/command-editor-strings.js';

const L = UI.levels;
const M = LEVELS_MSG;

const MSG_TABS = ['levelUp', 'rank', 'leaderboard', 'daily'];

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

    let channels = [], roles = [], storedCfg = { enabled: false, config: {} };
    try {
      const [chs, rls, cfg] = await Promise.all([
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`),
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
    container.innerHTML = buildPageHTML(cfg);
    this._setup(container, this.state);
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

  _setup(root, state) {
    const { channels, roles, cfg } = state;
    const page = root.querySelector('.module-page');
    bindNumSteppers(page);

    /* ── Канал ── */
    const statusEl = page.querySelector('[data-channel-status]');
    const setStatus = (status, tip) => {
      statusEl.className = 'channel-status ' + status;
      const icons = { empty: 'fa-circle-minus', checking: 'fa-circle-notch fa-spin', ok: 'fa-circle-check', error: 'fa-circle-xmark' };
      statusEl.innerHTML = `<i class="fa-solid ${icons[status] || icons.empty}"></i>`;
      if (tip) statusEl.setAttribute('data-tooltip', tip);
      else statusEl.removeAttribute('data-tooltip');
    };

    const picker = bindChannelPicker(page, {
      id: 'levels_channel',
      channels,
      onSelect: async (ch) => {
        cfg.announceChannelId = ch?.id || '';
        if (!ch) return setStatus('empty');
        setStatus('checking', `Проверка прав в #${ch.name}...`);
        try {
          const perms = await api.get(
            `/api/guilds/channels/${ch.id}/permissions?botId=${state.botId}&guildId=${state.guildId}`,
          );
          if (perms.channelExists && perms.canSend) setStatus('ok', 'Бот может отправлять сообщения');
          else setStatus('error', 'Нет прав на отправку');
        } catch { setStatus('error', 'Ошибка проверки'); }
      },
    });
    if (cfg.announceChannelId) {
      const ch = channels.find((c) => c.id === cfg.announceChannelId);
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
        page.querySelectorAll('[data-formula-seg] .seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
        cfg.formula = btn.dataset.value;
        updateFormulaHint();
      });
    });

    /* ── Неактивность ── */
    const inactBlock = page.querySelector('.inactivity');
    const inactToggle = page.querySelector('[data-inactivity-toggle]');
    const inactWarning = page.querySelector('[data-inactivity-warning]');
    const inactWarningText = page.querySelector('[data-inactivity-warning-text]');
    const updateInactivityUI = () => {
      inactToggle.classList.toggle('on', cfg.inactivity.enabled);
      inactToggle.setAttribute('aria-checked', String(cfg.inactivity.enabled));
      inactBlock.classList.toggle('is-on', cfg.inactivity.enabled);
      inactWarning.classList.toggle('show', cfg.inactivity.enabled);
      const remove = cfg.inactivity.removeRolesOnDecrease && cfg.rewards.enabled;
      inactWarningText.textContent = L.inactivityWarning(
        cfg.inactivity.days, cfg.inactivity.penaltyXp, remove,
      );
    };
    inactToggle.addEventListener('click', () => {
      cfg.inactivity.enabled = !cfg.inactivity.enabled;
      updateInactivityUI();
    });
    updateInactivityUI();

    const removeRolesToggle = page.querySelector('[data-inactivity-remove-roles-toggle]');
    removeRolesToggle.addEventListener('click', () => {
      if (!cfg.rewards.enabled) return;
      cfg.inactivity.removeRolesOnDecrease = !cfg.inactivity.removeRolesOnDecrease;
      removeRolesToggle.classList.toggle('on', cfg.inactivity.removeRolesOnDecrease);
      removeRolesToggle.setAttribute('aria-checked', String(cfg.inactivity.removeRolesOnDecrease));
      updateInactivityUI();
    });

    /* ── Event toggles ── */
    page.querySelectorAll('[data-event-toggle]').forEach((tgl) => {
      tgl.addEventListener('click', () => {
        const key = tgl.dataset.eventToggle;
        if (key === 'daily') {
          cfg.dailyEnabled = !cfg.dailyEnabled;
          tgl.classList.toggle('on', cfg.dailyEnabled);
          tgl.setAttribute('aria-checked', String(cfg.dailyEnabled));
          page.querySelector('[data-event-card="daily"]').classList.toggle('disabled', !cfg.dailyEnabled);
          return;
        }
        cfg.enabledEvents[key] = !cfg.enabledEvents[key];
        tgl.classList.toggle('on', cfg.enabledEvents[key]);
        tgl.setAttribute('aria-checked', String(cfg.enabledEvents[key]));
        page.querySelector(`[data-event-card="${key}"]`).classList.toggle('disabled', !cfg.enabledEvents[key]);
      });
    });

    /* ── Звания ── */
    const titleTable = page.querySelector('[data-title-table]');
    const renderTitles = () => {
      cfg.titles.sort((a, b) => (a.minLevel | 0) - (b.minLevel | 0));
      if (!cfg.titles.length) {
        titleTable.innerHTML = `<div class="reward-empty">${L.titlesEmpty}</div>`;
        return;
      }
      titleTable.innerHTML = cfg.titles.map((t, i) => `
        <div class="title-row" data-title-idx="${i}">
          <div class="title-row-level">
            ${numStepper({ value: t.minLevel, min: 1, max: cfg.maxLevel, data: 'data-title-level' })}
          </div>
          <input type="text" class="input" data-title-name maxlength="40"
                 placeholder="${L.titleNamePlaceholder}" value="${escapeHtml(t.name || '')}">
          <button type="button" class="reward-remove" data-remove-title="${i}" title="${L.titleDeleteLabel}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('');
      bindNumSteppers(titleTable);
      titleTable.querySelectorAll('[data-title-level] .num-stepper-input').forEach((input) => {
        input.addEventListener('change', () => {
          const idx = parseInt(input.closest('[data-title-idx]').dataset.titleIdx, 10);
          cfg.titles[idx].minLevel = Math.max(1, parseInt(input.value, 10) || 1);
        });
      });
      titleTable.querySelectorAll('[data-title-name]').forEach((input) => {
        input.addEventListener('input', () => {
          const idx = parseInt(input.closest('[data-title-idx]').dataset.titleIdx, 10);
          cfg.titles[idx].name = input.value.trim();
        });
      });
      titleTable.querySelectorAll('[data-remove-title]').forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.titles.splice(parseInt(btn.dataset.removeTitle, 10), 1);
          renderTitles();
        });
      });
    };
    renderTitles();
    page.querySelector('[data-add-title]').addEventListener('click', () => {
      cfg.titles.push({ minLevel: 1, name: '' });
      renderTitles();
    });

    /* ── Награды ── */
    const rewardsToggle = page.querySelector('[data-rewards-toggle]');
    const rewardsPanel = page.querySelector('[data-rewards-panel]');
    const rewardsNote = page.querySelector('[data-rewards-disabled-note]');
    const removeRolesRow = page.querySelector('[data-inactivity-roles-row]');
    const removeRolesNote = page.querySelector('[data-inactivity-roles-note]');

    const applyRewardsState = () => {
      rewardsToggle.classList.toggle('on', cfg.rewards.enabled);
      rewardsToggle.setAttribute('aria-checked', String(cfg.rewards.enabled));
      rewardsToggle.title = cfg.rewards.enabled ? L.rewardsDisable : L.rewardsEnable;
      rewardsPanel.classList.toggle('disabled', !cfg.rewards.enabled);
      rewardsNote.hidden = cfg.rewards.enabled;
      removeRolesRow.classList.toggle('is-disabled', !cfg.rewards.enabled);
      removeRolesToggle.disabled = !cfg.rewards.enabled;
      removeRolesToggle.setAttribute('aria-disabled', String(!cfg.rewards.enabled));
      removeRolesNote.textContent = cfg.rewards.enabled ? L.inactivityRemoveRolesOn : L.inactivityRemoveRolesOff;
      updateInactivityUI();
    };
    rewardsToggle.addEventListener('click', () => {
      cfg.rewards.enabled = !cfg.rewards.enabled;
      applyRewardsState();
    });
    applyRewardsState();

    const rewardsTable = page.querySelector('[data-reward-table]');
    const availableFor = (idx) => {
      const otherUsed = new Set(
        cfg.rewards.entries.map((x, xi) => (xi !== idx ? x.roleId : null)).filter(Boolean),
      );
      return roles.filter((role) => !otherUsed.has(role.id) || role.id === cfg.rewards.entries[idx].roleId);
    };

    const renderRewards = () => {
      if (!cfg.rewards.entries.length) {
        rewardsTable.innerHTML = `<div class="reward-empty">${L.rewardsEmpty}</div>`;
        return;
      }
      rewardsTable.innerHTML = cfg.rewards.entries.map((r, i) => `
        <div class="reward-row" data-reward-idx="${i}">
          <div class="num-stepper" data-num-stepper>
            <button type="button" class="num-stepper-btn" data-step="-1" aria-label="Уменьшить"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="num-stepper-input" value="${r.level || 1}" min="1" max="${cfg.maxLevel}" data-reward-level>
            <button type="button" class="num-stepper-btn" data-step="1" aria-label="Увеличить"><i class="fa-solid fa-plus"></i></button>
          </div>
          <div class="reward-role">
            ${rolePickerHTML({ id: `reward_${i}`, value: r.roleId || '', roles: availableFor(i) })}
          </div>
          <button type="button" class="reward-remove" data-remove-reward="${i}" title="${L.rewardsDeleteLabel}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `).join('');
      bindNumSteppers(rewardsTable);
      rewardsTable.querySelectorAll('[data-reward-level]').forEach((input) => {
        input.addEventListener('change', () => {
          const idx = parseInt(input.closest('[data-reward-idx]').dataset.rewardIdx, 10);
          cfg.rewards.entries[idx].level = Math.max(1, parseInt(input.value, 10) || 1);
        });
      });
      rewardsTable.querySelectorAll('[data-role-picker]').forEach((el) => {
        const id = el.dataset.rolePicker;
        const idx = parseInt(id.replace('reward_', ''), 10);
        bindRolePicker(rewardsTable, {
          id, roles: availableFor(idx),
          onSelect: (role) => {
            cfg.rewards.entries[idx].roleId = role?.id || '';
            renderRewards();
          },
        });
      });
      rewardsTable.querySelectorAll('[data-remove-reward]').forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.rewards.entries.splice(parseInt(btn.dataset.removeReward, 10), 1);
          renderRewards();
        });
      });
    };
    renderRewards();
    page.querySelector('[data-add-reward]').addEventListener('click', () => {
      cfg.rewards.entries.push({ level: 5, roleId: '' });
      renderRewards();
    });

    /* ── Исключённые каналы ── */
    const exclChChips = page.querySelector('[data-excl-channels]');
    const renderExclCh = () => {
      if (!cfg.excludedChannels.length) {
        exclChChips.innerHTML = `<div class="chip-empty">${L.exclChannelsEmpty}</div>`;
        return;
      }
      exclChChips.innerHTML = cfg.excludedChannels.map((id) => {
        const ch = channels.find((c) => c.id === id);
        return `
          <div class="chip">
            <i class="fa-solid fa-hashtag"></i>
            ${escapeHtml(ch?.name || id)}
            <button type="button" data-remove-excl-channel="${escapeHtml(id)}" aria-label="Удалить">×</button>
          </div>`;
      }).join('');
      exclChChips.querySelectorAll('[data-remove-excl-channel]').forEach((b) => {
        b.addEventListener('click', () => {
          cfg.excludedChannels = cfg.excludedChannels.filter((id) => id !== b.dataset.removeExclChannel);
          renderExclCh();
        });
      });
    };
    renderExclCh();

    bindChannelPicker(page, {
      id: 'excl_channel_picker',
      channels,
      multiSelect: true,
      filterList: (all) => all.filter((c) => !cfg.excludedChannels.includes(c.id)),
      onSelect: (ch) => {
        if (!ch) return;
        if (!cfg.excludedChannels.includes(ch.id)) {
          cfg.excludedChannels.push(ch.id);
          renderExclCh();
        }
      },
    });

    /* ── Исключённые роли ── */
    const exclRoleChips = page.querySelector('[data-excl-roles]');
    const renderExclRoles = () => {
      if (!cfg.excludedRoles.length) {
        exclRoleChips.innerHTML = `<div class="chip-empty">${L.exclRolesEmpty}</div>`;
        return;
      }
      exclRoleChips.innerHTML = cfg.excludedRoles.map((id) => {
        const r = roles.find((x) => x.id === id);
        const color = r?.color || 'var(--muted)';
        return `
          <div class="chip">
            <span class="chip-dot" style="background:${escapeHtml(color)};"></span>
            ${escapeHtml(r?.name || id)}
            <button type="button" data-remove-excl-role="${escapeHtml(id)}" aria-label="Удалить">×</button>
          </div>`;
      }).join('');
      exclRoleChips.querySelectorAll('[data-remove-excl-role]').forEach((b) => {
        b.addEventListener('click', () => {
          cfg.excludedRoles = cfg.excludedRoles.filter((id) => id !== b.dataset.removeExclRole);
          renderExclRoles();
        });
      });
    };
    renderExclRoles();

    bindRolePicker(page, {
      id: 'excl_role_picker',
      roles,
      multiSelect: true,
      filterList: (all) => all.filter((r) => !cfg.excludedRoles.includes(r.id)),
      onSelect: (role) => {
        if (!role) return;
        if (!cfg.excludedRoles.includes(role.id)) {
          cfg.excludedRoles.push(role.id);
          renderExclRoles();
        }
      },
    });

    /* ── Редакторы сообщений: 4 таба ── */

    const editorContainer = page.querySelector('[data-editor-container]');
    const tabHint = page.querySelector('[data-msg-tab-hint]');

    const mountEditor = (tabKey) => {
      const prev = state.editors[tabKey];
      if (prev) { try { prev.destroy(); } catch {} }

      editorContainer.innerHTML = '';
      const initial = cfg.messages[tabKey] || emptyMessageConfig();
      const presetKey = `levels.${tabKey}`;

      const editor = new MessageEditor(editorContainer, initial, {
        bot: state.bot,
        roles,
        context: `levels.${tabKey}`,
        presetKey,
        guildId: state.guildId,
        botId: state.botId,
      });
      editor.onChange = (m) => { cfg.messages[tabKey] = m; };
      editor.mount();
      state.editors[tabKey] = editor;
    };

    const switchMsgTab = (tabKey) => {
      if (!MSG_TABS.includes(tabKey)) return;
      if (state.activeMsgTab === tabKey) return;

      const cur = state.editors[state.activeMsgTab];
      if (cur) cfg.messages[state.activeMsgTab] = cur.getConfig();

      state.activeMsgTab = tabKey;
      page.querySelectorAll('[data-msg-tab]').forEach((b) =>
        b.classList.toggle('active', b.dataset.msgTab === tabKey));
      if (tabHint) tabHint.textContent = M.tabs[tabKey]?.hint || '';
      mountEditor(tabKey);
    };

    page.querySelectorAll('[data-msg-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchMsgTab(btn.dataset.msgTab));
    });

    mountEditor(state.activeMsgTab);

    /* ── Тест текущего таба ── */
    page.querySelector('[data-test-message]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!cfg.announceChannelId) return toast(M.testNeedChannel, 'warn');

      const tab = state.activeMsgTab;
      const editorForTest = state.editors[tab];
      const cfgForTest = editorForTest ? editorForTest.getConfig() : (cfg.messages[tab] || emptyMessageConfig());

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.sending}`;
      try {
        await api.post('/api/levels/test', {
          botId: state.botId, guildId: state.guildId,
          channelId: cfg.announceChannelId,
          messageConfig: cfgForTest,
        });
        toast(M.testSent, 'success');
      } catch (err) {
        const map = { ...UI.errors };
        toast(map[err.data?.error] || (UI.common.error + ': ' + (err.data?.details || err.message)), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    /* ── Сохранение ── */
    page.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;

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

      const maxInput = page.querySelector('[data-max-level] .num-stepper-input');
      if (maxInput) cfg.maxLevel = Math.max(1, parseInt(maxInput.value, 10) || 100);
      const boostInput = page.querySelector('[data-boost-multiplier] .num-stepper-input');
      if (boostInput) cfg.boostMultiplier = Math.max(1, parseFloat(boostInput.value) || 2);
      const daysInput = page.querySelector('[data-inactivity-days] .num-stepper-input');
      if (daysInput) cfg.inactivity.days = Math.max(1, parseInt(daysInput.value, 10) || 30);
      const penaltyInput = page.querySelector('[data-inactivity-penalty] .num-stepper-input');
      if (penaltyInput) cfg.inactivity.penaltyXp = Math.max(1, parseInt(penaltyInput.value, 10) || 50);

      for (const tabKey of MSG_TABS) {
        const ed = state.editors[tabKey];
        if (ed) cfg.messages[tabKey] = ed.getConfig();
      }

      if (!cfg.announceChannelId) return toast(L.needChannel, 'warn');
      const anyEvent =
        cfg.enabledEvents.message || cfg.enabledEvents.command ||
        cfg.enabledEvents.voice || cfg.dailyEnabled;
      if (!anyEvent) return toast(L.needEvent, 'warn');
      if (cfg.rewards.enabled && cfg.rewards.entries.some((r) => !r.roleId || !r.level)) {
        return toast(L.needRewards, 'warn');
      }
      cfg.titles = cfg.titles.filter((t) => t.name && t.name.trim());
      if (!cfg.titles.length) return toast(L.needTitles, 'warn');

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.saving}`;
      try {
        await api.put('/api/modules/levels/config', {
          botId: state.botId, guildId: state.guildId, config: cfg,
        });
        toast(L.saved, 'success');
        try {
          const mods = await api.get(`/api/modules?botId=${state.botId}&guildId=${state.guildId}`);
          store.set('modulesEnabledCount', mods.filter((m) => m.enabled).length);
        } catch {}
      } catch (err) {
        const map = { invalid_channel: UI.errors.invalid_channel, validation_failed: UI.errors.validation_failed };
        toast(map[err.data?.error] || (UI.common.errorSave + ': ' + (err.data?.error || err.message)), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });
  },
};