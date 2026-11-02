// public/assets/js/views/module-settings/birthdays.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml } from '../../core/utils.js';
import { channelPickerHTML, bindChannelPicker, rolePickerHTML, bindRolePicker } from './pickers.js';
import { MessageEditor, emptyMessageConfig } from './message-editor.js';
import { mergeBirthdaysConfig } from '/shared/birthdays-config.js';
import { UI } from '/shared/ui-strings.js';
import { BIRTHDAYS_MSG } from '/shared/command-editor-strings.js';
import { renderModuleOffBanner, bindModuleOffBanner } from '../../components/moduleBanner.js';

const MSG_TABS = ['announce', 'cmdSet', 'cmdToggle', 'cmdList'];

const B = {
  pageTitle: 'Дни рождения',
  pageSubtitle: 'Поздравления и роль именинника',
  mainTitle: 'Основное',
  mainSubtitle: 'Канал, роль и время поздравления',
  channelLabel: 'Канал объявлений',
  channelHint: 'Сюда бот будет отправлять поздравления именинникам',
  roleLabel: 'Роль именинника',
  roleHint: 'Выдаётся на 24 часа в день рождения, затем снимается',
  timeLabel: 'Время отправки уведомления',
  timeHint: 'Локальное время сервера. Формат ЧЧ:ММ',
  excludedRolesLabel: 'Исключённые роли',
  excludedRolesHint: 'Участников с любой из этих ролей не поздравляем и не выдаём роль именинника',
  excludedRolesEmpty: 'Нет исключённых ролей',
  requiredRolesLabel: 'Только для ролей',
  requiredRolesHint: 'Если выбрано — поздравляем только участников хотя бы с одной из этих ролей',
  requiredRolesEmpty: 'Не задано — поздравляем всех',
  messagesTitle: 'Сообщения модуля',
  messagesSubtitle: 'Поздравление и ответы на команды',
  needChannel: 'Выберите канал объявлений',
  needRole: 'Выберите роль именинника',
  saved: 'Настройки сохранены',
  channelStatus: {
    empty: 'Канал не выбран',
    checking: (name) => `Проверка прав в #${name}...`,
    notFound: 'Канал не найден',
    ok: 'Бот может отправлять сообщения в выбранный канал',
    missing: (list) => `Бот не может отправлять сообщения: ${list}`,
    checkFailed: 'Не удалось проверить права',
  },
};

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

function buildPageHTML(cfg) {
  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К модулям
          </a>
          <h1>${B.pageTitle}</h1>
          <p>${B.pageSubtitle}</p>
        </div>
      </div>

      <div class="gr-settings">

        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>${B.mainTitle}</h3>
                <p>${B.mainSubtitle}</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${B.channelLabel}</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status data-tooltip="${B.channelStatus.empty}">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'birthdays_channel' })}
                </div>
                <span class="hint">${B.channelHint}</span>
              </div>

              <div class="form-field" style="margin-top:14px;">
                <label>${B.roleLabel}</label>
                ${rolePickerHTML({ id: 'birthdays_role', roles: [], placeholder: 'Выберите роль...' })}
                <span class="hint">${B.roleHint}</span>
              </div>

              <div class="form-field" style="margin-top:14px;">
                <label>${B.timeLabel}</label>
                <div class="birthdays-time-row">
                  <input type="time" class="input" id="birthdaysTime"
                         value="${escapeHtml(cfg.sendTime || '09:00')}"
                         style="max-width:180px;">
                  <span class="hint" style="align-self:center;margin-left:12px;">${B.timeHint}</span>
                </div>
              </div>

              <div class="form-field" style="margin-top:14px;">
                <label>${B.requiredRolesLabel}</label>
                <div class="chips" data-required-roles></div>
                <div class="channel-row" style="margin-top:8px;">
                  ${rolePickerHTML({ id: 'birthdays_required_role', roles: [], placeholder: 'Добавить роль...' })}
                </div>
                <span class="hint">${B.requiredRolesHint}</span>
              </div>

              <div class="form-field" style="margin-top:14px;">
                <label>${B.excludedRolesLabel}</label>
                <div class="chips" data-excl-roles></div>
                <div class="channel-row" style="margin-top:8px;">
                  ${rolePickerHTML({ id: 'birthdays_excl_role', roles: [], placeholder: 'Добавить роль...' })}
                </div>
                <span class="hint">${B.excludedRolesHint}</span>
              </div>

              <div class="form-toggle-row" style="margin-top:18px;">
                <div class="form-toggle-label">
                  <strong>Удалять прошлые поздравления</strong>
                  <span>Автоматически удалять сообщения-поздравления при наступлении нового дня</span>
                </div>
                <button type="button" class="toggle ${cfg.deleteOldAnnouncements ? 'on' : ''}"
                        data-delete-old-toggle role="switch"
                        aria-checked="${cfg.deleteOldAnnouncements}"></button>
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>Команды модуля</h3>
                <p>Доступные встроенные команды</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="birthdays-cmd-list">
                <div class="birthdays-cmd-item">
                  <div class="birthdays-cmd-name"><code>/birthday_set</code></div>
                  <div class="birthdays-cmd-desc">Установить дату своего дня рождения — ДД.ММ или ДД.ММ.ГГГГ</div>
                  <a href="#commands?edit=builtin:birthday_set" class="btn-link">
                    Настроить <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
                <div class="birthdays-cmd-item">
                  <div class="birthdays-cmd-name"><code>/birthday_toggle</code></div>
                  <div class="birthdays-cmd-desc">Включить или отключить поздравления</div>
                  <a href="#commands?edit=builtin:birthday_toggle" class="btn-link">
                    Настроить <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
                <div class="birthdays-cmd-item">
                  <div class="birthdays-cmd-name"><code>/birthdays</code></div>
                  <div class="birthdays-cmd-desc">Ближайшие 10 дней рождения</div>
                  <a href="#commands?edit=builtin:birthdays" class="btn-link">
                    Настроить <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${B.messagesTitle}</h3>
              <p>${B.messagesSubtitle}</p>
            </div>
            <div class="section-head-right">
              <button type="button" class="btn btn-ghost btn-sm" data-test-message>
                <i class="fa-solid fa-paper-plane"></i> ${BIRTHDAYS_MSG.testButton}
              </button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="gr-tabs" data-msg-tabs>
              <button type="button" class="gr-tab active" data-msg-tab="announce">${BIRTHDAYS_MSG.tabs.announce.title}</button>
              <button type="button" class="gr-tab" data-msg-tab="cmdSet">${BIRTHDAYS_MSG.tabs.cmdSet.title}</button>
              <button type="button" class="gr-tab" data-msg-tab="cmdToggle">${BIRTHDAYS_MSG.tabs.cmdToggle.title}</button>
              <button type="button" class="gr-tab" data-msg-tab="cmdList">${BIRTHDAYS_MSG.tabs.cmdList.title}</button>
            </div>
            <p class="gr-messages-tab-hint" data-msg-tab-hint>${BIRTHDAYS_MSG.tabs.announce.hint}</p>
            <div class="gr-editor-container" data-editor-container></div>
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
          <i class="fa-solid fa-cake-candles"></i>
          <strong>${UI.common.selectServer}</strong>
          <span>${UI.common.selectServerHint}</span>
          <a href="#modules" class="btn btn-ghost" style="margin-top:16px;">${UI.common.backToModules}</a>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${UI.common.loading}</span></div>`;

    let channels = [];
    let roles = [];
    let storedCfg = { enabled: false, config: {} };
    try {
      const [chs, rls, cfg] = await Promise.all([
        api.get(`/api/guilds/channels?botId=${botId}&guildId=${guildId}`),
        api.get(`/api/guilds/roles?botId=${botId}&guildId=${guildId}`).catch(() => []),
        api.get(`/api/modules/birthdays/config?botId=${botId}&guildId=${guildId}`),
      ]);
      channels = chs || [];
      roles = rls || [];
      storedCfg = cfg || { enabled: false, config: {} };
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

    const cfg = mergeBirthdaysConfig(storedCfg.config);
    const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

    this.state = {
      botId, guildId, channels, roles, cfg, bot,
      editors: {},
      activeMsgTab: 'announce',
      permissions: null,
      enabled: !!storedCfg.enabled,   // ← добавить
    };

    container.innerHTML = buildPageHTML(cfg);

    /* ─── Баннер «Модуль выключен» ─── */
    if (!storedCfg.enabled) {
      container.querySelector('.module-page')?.insertAdjacentHTML(
        'afterbegin',
        renderModuleOffBanner({
        moduleKey: 'birthdays',
        moduleName: 'Дни рождения',
        hint: 'Поздравления и роли именинников не будут работать, пока модуль выключен.',
    }),
  );
}

this._setup(container, this.state);

bindModuleOffBanner({
  container,
  botId: this.state.botId,
  guildId: this.state.guildId,
  moduleKey: 'birthdays',
});
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

    /* ─── Канал ─── */
    const statusEl = page.querySelector('[data-channel-status]');
    const checkPermissions = async (ch) => {
      if (!ch) {
        setChannelStatus(statusEl, 'empty', B.channelStatus.empty);
        state.permissions = null;
        return;
      }
      setChannelStatus(statusEl, 'checking', B.channelStatus.checking(ch.name));
      try {
        const perms = await api.get(
          `/api/guilds/channels/${ch.id}/permissions?botId=${state.botId}&guildId=${state.guildId}`,
        );
        state.permissions = perms;
        if (!perms || !perms.channelExists) {
          setChannelStatus(statusEl, 'error', B.channelStatus.notFound);
          return;
        }
        const missing = [];
        if (!perms.canViewChannel) missing.push('Просмотр канала');
        if (!perms.canSend) missing.push('Отправка сообщений');
        if (!perms.canEmbed) missing.push('Встраивание ссылок');
        if (missing.length === 0) setChannelStatus(statusEl, 'ok', B.channelStatus.ok);
        else setChannelStatus(statusEl, 'error', B.channelStatus.missing(missing.join(', ')));
      } catch (err) {
        setChannelStatus(statusEl, 'error', B.channelStatus.checkFailed + ': ' + (err.message || ''));
      }
    };

    const chPicker = bindChannelPicker(page, {
      id: 'birthdays_channel',
      channels,
      onSelect: async (ch) => {
        cfg.announceChannelId = ch?.id || '';
        await checkPermissions(ch);
      },
    });
    if (cfg.announceChannelId) {
      const ch = channels.find((c) => c.id === cfg.announceChannelId);
      if (ch) chPicker?.setValue(ch);
    }

    /* ─── Роль именинника ─── */
    const rolePicker = bindRolePicker(page, {
      id: 'birthdays_role',
      roles,
      onSelect: (role) => {
        cfg.birthdayRoleId = role?.id || '';
      },
    });
    if (cfg.birthdayRoleId) {
      const r = roles.find((x) => x.id === cfg.birthdayRoleId);
      if (r) rolePicker?.setValue(r);
    }

    /* ─── Время ─── */
    const timeEl = page.querySelector('#birthdaysTime');
    timeEl.addEventListener('change', () => {
      const v = timeEl.value;
      if (/^\d{2}:\d{2}$/.test(v)) cfg.sendTime = v;
    });

    /* ─── Только для ролей (requiredRoles) ─── */
    const reqRolesChips = page.querySelector('[data-required-roles]');
    const renderReqRoles = () => {
      if (!cfg.requiredRoles.length) {
        reqRolesChips.innerHTML = `<div class="chip-empty">${B.requiredRolesEmpty}</div>`;
        return;
      }
      reqRolesChips.innerHTML = cfg.requiredRoles.map((id) => {
        const r = roles.find((x) => x.id === id);
        const color = r?.color || 'var(--muted)';
        return `
          <div class="chip">
            <span class="chip-dot" style="background:${escapeHtml(color)};"></span>
            ${escapeHtml(r?.name || id)}
            <button type="button" data-remove-required-role="${escapeHtml(id)}" aria-label="Удалить">×</button>
          </div>`;
      }).join('');
      reqRolesChips.querySelectorAll('[data-remove-required-role]').forEach((b) => {
        b.addEventListener('click', () => {
          cfg.requiredRoles = cfg.requiredRoles.filter((id) => id !== b.dataset.removeRequiredRole);
          renderReqRoles();
        });
      });
    };
    renderReqRoles();

    bindRolePicker(page, {
      id: 'birthdays_required_role',
      roles,
      multiSelect: true,
      filterList: (all) => all.filter((r) => !cfg.requiredRoles.includes(r.id)),
      onSelect: (role) => {
        if (!role) return;
        if (!cfg.requiredRoles.includes(role.id)) {
          cfg.requiredRoles.push(role.id);
          renderReqRoles();
        }
      },
    });

    /* ─── Исключённые роли (excludedRoles) ─── */
    const exclRolesChips = page.querySelector('[data-excl-roles]');
    const renderExclRoles = () => {
      if (!cfg.excludedRoles.length) {
        exclRolesChips.innerHTML = `<div class="chip-empty">${B.excludedRolesEmpty}</div>`;
        return;
      }
      exclRolesChips.innerHTML = cfg.excludedRoles.map((id) => {
        const r = roles.find((x) => x.id === id);
        const color = r?.color || 'var(--muted)';
        return `
          <div class="chip">
            <span class="chip-dot" style="background:${escapeHtml(color)};"></span>
            ${escapeHtml(r?.name || id)}
            <button type="button" data-remove-excl-role="${escapeHtml(id)}" aria-label="Удалить">×</button>
          </div>`;
      }).join('');
      exclRolesChips.querySelectorAll('[data-remove-excl-role]').forEach((b) => {
        b.addEventListener('click', () => {
          cfg.excludedRoles = cfg.excludedRoles.filter((id) => id !== b.dataset.removeExclRole);
          renderExclRoles();
        });
      });
    };
    renderExclRoles();

    bindRolePicker(page, {
      id: 'birthdays_excl_role',
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

    /* ─── Автоудаление ─── */
    const delToggle = page.querySelector('[data-delete-old-toggle]');
    delToggle?.addEventListener('click', () => {
      cfg.deleteOldAnnouncements = !cfg.deleteOldAnnouncements;
      delToggle.classList.toggle('on', cfg.deleteOldAnnouncements);
      delToggle.setAttribute('aria-checked', String(cfg.deleteOldAnnouncements));
    });

    /* ─── Редакторы сообщений ─── */
    const editorContainer = page.querySelector('[data-editor-container]');
    const tabHint = page.querySelector('[data-msg-tab-hint]');

    const mountEditor = (tabKey) => {
      const prev = state.editors[tabKey];
      if (prev) { try { prev.destroy(); } catch {} }

      editorContainer.innerHTML = '';
      const initial = cfg.messages[tabKey] || emptyMessageConfig();
      const presetKey = `birthdays.${tabKey}`;

      const editor = new MessageEditor(editorContainer, initial, {
        bot: state.bot,
        roles,
        context: `birthdays.${tabKey}`,
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
      if (tabHint) tabHint.textContent = BIRTHDAYS_MSG.tabs[tabKey]?.hint || '';
      mountEditor(tabKey);
    };

    page.querySelectorAll('[data-msg-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchMsgTab(btn.dataset.msgTab));
    });

    mountEditor(state.activeMsgTab);

    /* ─── Тест текущего таба ─── */
    page.querySelector('[data-test-message]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (!cfg.announceChannelId) return toast(BIRTHDAYS_MSG.testNeedChannel, 'warn');

      const tab = state.activeMsgTab;
      const ed = state.editors[tab];
      const cfgForTest = ed ? ed.getConfig() : (cfg.messages[tab] || emptyMessageConfig());

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.sending}`;
      try {
        await api.post('/api/modules/birthdays/test', {
          botId: state.botId,
          guildId: state.guildId,
          channelId: cfg.announceChannelId,
          messageConfig: cfgForTest,
          which: tab,
        });
        toast(BIRTHDAYS_MSG.testSent, 'success');
      } catch (err) {
        const map = { ...UI.errors };
        toast(map[err.data?.error] || (UI.common.error + ': ' + (err.data?.details || err.message)), 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });

    /* ─── Сохранение ─── */
    page.querySelector('[data-save]').addEventListener('click', async (e) => {
      const btn = e.currentTarget;

      for (const tabKey of MSG_TABS) {
        const ed = state.editors[tabKey];
        if (ed) cfg.messages[tabKey] = ed.getConfig();
      }

      if (!cfg.announceChannelId) return toast(B.needChannel, 'warn');
      if (!cfg.birthdayRoleId) return toast(B.needRole, 'warn');
      if (!/^\d{2}:\d{2}$/.test(cfg.sendTime)) return toast('Неверный формат времени', 'warn');

      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.saving}`;

      try {
        await api.put('/api/modules/birthdays/config', {
          botId: state.botId,
          guildId: state.guildId,
          config: cfg,
        });
        toast(B.saved, 'success');
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
        btn.innerHTML = orig;
      }
    });
  },
};