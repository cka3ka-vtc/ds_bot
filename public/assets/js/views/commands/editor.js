// public/assets/js/views/commands/editor.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import {
  channelPickerHTML, bindChannelPicker,
  rolePickerHTML, bindRolePicker,
} from '../module-settings/pickers.js';
import { MessageEditor, emptyMessageConfig } from '../module-settings/message-editor.js';

const DEFAULTS = {
  enabled: true,
  description: '',
  cooldownSeconds: 0,
  channelsMode: 'all',
  channels: [],
  requireRoles: [],
  excludeRoles: [],
  ephemeral: false,
  messageConfig: {},
};

/**
 * Полноэкранный редактор команды.
 *  - Встроенная (editId = "builtin:<name>")  — только настройки: enabled,
 *    description, cooldown, каналы, роли, ephemeral. Ответ редактируется
 *    в модуле «Уровни».
 *  - Пользовательская (editId = "cmd_xxx")  — все те же настройки + полный
 *    MessageEditor для ответа.
 *  - Новая (isNew=true)                     — как пользовательская, но пустая.
 */
export async function renderCommandEditor(view, container, { editId, isNew }) {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  const channels = view.state.channels || [];
  const roles = view.state.roles || [];
  const bot = (store.get('bots') || []).find((b) => b.id === botId) || { name: 'Bot', avatarUrl: null };

  const isBuiltin = !!editId && editId.startsWith('builtin:');
  const isEdit = !!editId && !isNew;

  // ─── Ищем данные ───
  let data;
  if (isEdit) {
    if (isBuiltin) {
      const name = editId.slice('builtin:'.length);
      data = view.state.builtin.find((c) => c.name === name);
    } else {
      data = view.state.custom.find((c) => c.id === editId);
    }
    if (!data) {
      container.innerHTML = `
        <div class="empty-state" style="padding:64px 24px;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>Команда не найдена</strong>
          <span>Возможно, она была удалена</span>
          <a href="#commands" class="btn btn-ghost" style="margin-top:16px;">← К списку команд</a>
        </div>`;
      return;
    }
  } else {
    data = { name: '', description: '', ...DEFAULTS };
  }

  // ─── Рабочая копия (draft) ───
  const draft = {
    ...DEFAULTS,
    ...data,
    channels: [...(data.channels || [])],
    requireRoles: [...(data.requireRoles || [])],
    excludeRoles: [...(data.excludeRoles || [])],
    messageConfig: migrateLegacyResponse(data),
  };

  const iconClass = isBuiltin ? (data.icon || 'fa-bolt') : 'fa-message';
  const colorClass = isBuiltin ? (data.color || 'blue') : 'purple';

  const titleHtml = isEdit
    ? `<span class="cmd-editor-slash">/</span>${escapeHtml(data.name)}`
    : 'Новая команда';

  const subtitle = isBuiltin
    ? 'Встроенная команда · Модуль «Уровни»'
    : (isEdit ? 'Пользовательская команда' : 'Создайте свою slash-команду');

  container.innerHTML = `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#commands" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> К командам
          </a>
          <div class="cmd-editor-title">
            <span class="cmd-editor-icon ${colorClass}"><i class="fa-solid ${iconClass}"></i></span>
            <div>
              <h1>${titleHtml}</h1>
              <p>${subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="gr-settings">

        <!-- ═══ Основное ═══ -->
        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>Основное</h3>
              <p>Имя и описание команды</p>
            </div>
            <div class="section-head-right">
              <label class="toggle-label">
                <span data-enabled-label>${draft.enabled ? 'Включена' : 'Выключена'}</span>
                <button type="button" class="toggle ${draft.enabled ? 'on' : ''}"
                        data-enabled-toggle role="switch"
                        aria-checked="${draft.enabled}"></button>
              </label>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="form-grid-2">
              <div class="form-field">
                <label>Имя команды</label>
                <div class="cmd-name-input">
                  <span class="cmd-name-prefix">/</span>
                  <input type="text" id="cmdName" class="input"
                         maxlength="32"
                         placeholder="hello"
                         value="${escapeHtml(data.name || '')}"
                         ${isBuiltin ? 'readonly' : ''}>
                </div>
                <span class="hint" id="cmdNameHint">${isBuiltin
                  ? 'Имя встроенной команды изменить нельзя'
                  : 'Только буквы, цифры, _ и -. 2–32 символа.'}</span>
              </div>
              <div class="form-field">
                <label>Описание</label>
                <input type="text" id="cmdDesc" class="input" maxlength="100"
                       placeholder="${escapeHtml(data.defaultDescription || 'Краткое описание для Discord')}"
                       value="${escapeHtml(draft.description || '')}">
                <span class="hint">${isBuiltin
                  ? 'Можно переопределить для этого сервера'
                  : 'Показывается в списке команд Discord'}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ Доступ ═══ -->
        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>Доступ и поведение</h3>
              <p>Где, кому и как часто доступна команда</p>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="form-grid-2">
              <div class="form-field">
                <label>Кулдаун</label>
                <div class="num-stepper" data-cooldown-stepper>
                  <button type="button" class="num-stepper-btn" data-step="-5">−</button>
                  <input type="number" class="num-stepper-input" id="cmdCooldown"
                         min="0" max="86400" step="1" value="${draft.cooldownSeconds || 0}">
                  <button type="button" class="num-stepper-btn" data-step="5">+</button>
                  <span class="num-stepper-suffix">СЕК</span>
                </div>
                <span class="hint">Задержка между вызовами. 0 — без ограничений.</span>
              </div>

              <div class="form-field">
                <label>Ответ только вызывающему</label>
                <div class="form-toggle-row" style="border-top:none;padding:0;">
                  <div class="form-toggle-label">
                    <strong>Ephemeral</strong>
                    <span>Сообщение видит только автор команды</span>
                  </div>
                  <button type="button" class="toggle ${draft.ephemeral ? 'on' : ''}"
                          data-ephemeral-toggle role="switch"
                          aria-checked="${draft.ephemeral}"></button>
                </div>
              </div>
            </div>

            <div class="form-field" style="margin-top:20px;">
              <label>Где работает</label>
              <div class="segmented-control" data-channels-mode-seg>
                <button type="button" class="seg-btn ${draft.channelsMode === 'all' ? 'active' : ''}" data-value="all">Везде</button>
                <button type="button" class="seg-btn ${draft.channelsMode === 'whitelist' ? 'active' : ''}" data-value="whitelist">Только в выбранных</button>
                <button type="button" class="seg-btn ${draft.channelsMode === 'blacklist' ? 'active' : ''}" data-value="blacklist">Кроме выбранных</button>
              </div>
            </div>

            <div class="form-field" data-channels-field style="${draft.channelsMode === 'all' ? 'display:none;' : ''}">
              <label>Каналы</label>
              <div class="chips" data-channels-chips></div>
              <div class="channel-row" style="margin-top:8px;">
                ${channelPickerHTML({ id: 'cmd_channel_picker', placeholder: 'Добавить канал...' })}
              </div>
            </div>

            <div class="form-grid-2" style="margin-top:20px;">
              <div class="form-field">
                <label>Требуемые роли</label>
                <div class="chips" data-require-chips></div>
                <div class="channel-row" style="margin-top:8px;">
                  ${rolePickerHTML({ id: 'cmd_require_role', roles, placeholder: 'Добавить роль...' })}
                </div>
                <span class="hint">Хотя бы одна из выбранных ролей должна быть у пользователя</span>
              </div>
              <div class="form-field">
                <label>Запрещённые роли</label>
                <div class="chips" data-exclude-chips></div>
                <div class="channel-row" style="margin-top:8px;">
                  ${rolePickerHTML({ id: 'cmd_exclude_role', roles, placeholder: 'Добавить роль...' })}
                </div>
                <span class="hint">Пользователи с любой из этих ролей не смогут вызывать</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ═══ Ответ ═══ -->
        ${isBuiltin ? `
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>Ответ команды</h3>
                <p>Настраивается в модуле «Уровни»</p>
              </div>
              <div class="section-head-right">
                <a href="#modules?sub=levels" class="btn btn-ghost btn-sm">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i>
                  Открыть модуль «Уровни»
                </a>
              </div>
            </div>
            <div class="gr-section-body">
              <div class="cmd-info-box">
                <i class="fa-solid fa-circle-info"></i>
                <div>
                  <strong>Ответ встроенной команды</strong>
                  <span>Текст и оформление ответа настраиваются в модуле «Уровни» → раздел сообщений.
                  Здесь можно изменить только имя (его нет), описание, кулдаун и доступ.</span>
                </div>
              </div>
            </div>
          </section>
        ` : `
          <section class="gr-section">
            <div class="gr-section-head">
              <div>
                <h3>Ответ команды</h3>
                <p>Сообщение, которое получит пользователь</p>
              </div>
            </div>
            <div class="gr-section-body">
              <div data-message-editor-container></div>
            </div>
          </section>
        `}

      </div>

      <div class="module-page-savebar">
        <a href="#commands" class="btn btn-ghost" data-cancel>Отмена</a>
        ${isEdit && !isBuiltin ? `
          <button type="button" class="btn btn-danger" data-delete>
            <i class="fa-solid fa-trash"></i> Удалить
          </button>
        ` : ''}
        <button type="button" class="btn btn-primary" data-save>
          <i class="fa-solid fa-check"></i> ${isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </div>
  `;

  const state = {
    editor: null,
    draft,
    isBuiltin,
    isEdit,
    data,
    botId,
    guildId,
  };

  bindEditor(container, view, state, { channels, roles, bot });
}

/**
 * Старые кастомные команды хранят ответ в response/responseMode.
 * При первом открытии в новом редакторе конвертируем в messageConfig,
 * чтобы пользователь видел нормальное сообщение, а не пустое.
 */
function migrateLegacyResponse(data) {
  const mc = data.messageConfig;
  if (mc && typeof mc === 'object' && Object.keys(mc).length) {
    return structuredClone(mc);
  }
  if (data.response) {
    const cfg = emptyMessageConfig();
    if (data.responseMode === 'embed') {
      cfg.displayMode = 'embed-color';
      cfg.accentColor = data.responseEmbedColor || '#5865F2';
    } else {
      cfg.displayMode = 'flat';
    }
    cfg.blocks = [{
      id: 'blk_' + Math.random().toString(36).slice(2, 10),
      type: 'text',
      content: data.response,
    }];
    return cfg;
  }
  return emptyMessageConfig();
}

function bindEditor(container, view, state, ctx) {
  const { channels, roles, bot } = ctx;
  const { botId, guildId } = state;
  const draft = state.draft;
  const isBuiltin = state.isBuiltin;

  /* ─── Enabled toggle ─── */
  const enabledToggle = container.querySelector('[data-enabled-toggle]');
  const enabledLabel = container.querySelector('[data-enabled-label]');
  enabledToggle?.addEventListener('click', () => {
    draft.enabled = !draft.enabled;
    enabledToggle.classList.toggle('on', draft.enabled);
    enabledToggle.setAttribute('aria-checked', String(draft.enabled));
    if (enabledLabel) enabledLabel.textContent = draft.enabled ? 'Включена' : 'Выключена';
  });

  /* ─── Name validation + проверка занятости ─── */
  const nameEl = container.querySelector('#cmdName');
  const nameHint = container.querySelector('#cmdNameHint');
  let nameCheckTimer = null;
  if (nameEl && !isBuiltin) {
    nameEl.addEventListener('input', () => {
      const raw = nameEl.value.trim();
      const sanitized = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

      if (raw && sanitized !== raw) {
        nameHint.textContent = `Символы будут удалены → «${sanitized}»`;
        nameHint.style.color = 'var(--orange)';
      } else if (!sanitized) {
        nameHint.textContent = 'Только буквы, цифры, _ и -. 2–32 символа.';
        nameHint.style.color = 'var(--muted)';
      } else {
        nameHint.textContent = 'Только буквы, цифры, _ и -. 2–32 символа.';
        nameHint.style.color = 'var(--muted)';
      }

      clearTimeout(nameCheckTimer);
      if (!sanitized || sanitized.length < 2) return;

      nameCheckTimer = setTimeout(async () => {
        try {
          const params = new URLSearchParams({
            botId, guildId, name: sanitized,
            ...(state.isEdit && !state.isBuiltin ? { excludeId: state.data.id } : {}),
          });
          const res = await api.get(`/api/commands/check?${params}`);
          if (!res.valid && res.error === 'duplicate_name') {
            nameHint.textContent = '⚠ Команда с таким именем уже существует';
            nameHint.style.color = 'var(--red)';
          } else if (!res.valid && res.error === 'reserved_name') {
            nameHint.textContent = '⚠ Имя зарезервировано за встроенной командой';
            nameHint.style.color = 'var(--red)';
          } else if (res.valid) {
            nameHint.textContent = '✓ Имя свободно';
            nameHint.style.color = 'var(--green)';
          }
        } catch {}
      }, 400);
    });
  }

  /* ─── Cooldown stepper ─── */
  const cooldownEl = container.querySelector('#cmdCooldown');
  container.querySelectorAll('[data-cooldown-stepper] [data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step, 10) || 0;
      const cur = parseInt(cooldownEl.value, 10) || 0;
      const next = Math.max(0, Math.min(86400, cur + step));
      cooldownEl.value = next;
      draft.cooldownSeconds = next;
    });
  });
  cooldownEl?.addEventListener('change', () => {
    let v = parseInt(cooldownEl.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 86400) v = 86400;
    cooldownEl.value = v;
    draft.cooldownSeconds = v;
  });

  /* ─── Ephemeral toggle ─── */
  const epToggle = container.querySelector('[data-ephemeral-toggle]');
  epToggle?.addEventListener('click', () => {
    draft.ephemeral = !draft.ephemeral;
    epToggle.classList.toggle('on', draft.ephemeral);
    epToggle.setAttribute('aria-checked', String(draft.ephemeral));
  });

  /* ─── Channels mode ─── */
  const channelsField = container.querySelector('[data-channels-field]');
  container.querySelectorAll('[data-channels-mode-seg] .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-channels-mode-seg] .seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn));
      draft.channelsMode = btn.dataset.value;
      if (channelsField) channelsField.style.display = draft.channelsMode === 'all' ? 'none' : '';
    });
  });

  /* ─── Channel chips ─── */
  const channelsChips = container.querySelector('[data-channels-chips]');
  function renderChannelChips() {
    if (!channelsChips) return;
    if (!draft.channels.length) {
      channelsChips.innerHTML = `<div class="chip-empty">Каналы не выбраны</div>`;
      return;
    }
    channelsChips.innerHTML = draft.channels.map((id) => {
      const ch = channels.find((c) => c.id === id);
      return `<div class="chip">
        <i class="fa-solid fa-hashtag"></i>
        ${escapeHtml(ch?.name || id)}
        <button type="button" data-remove-channel="${escapeHtml(id)}" aria-label="Удалить">×</button>
      </div>`;
    }).join('');
    channelsChips.querySelectorAll('[data-remove-channel]').forEach((b) => {
      b.addEventListener('click', () => {
        draft.channels = draft.channels.filter((x) => x !== b.dataset.removeChannel);
        renderChannelChips();
      });
    });
  }
  renderChannelChips();

  bindChannelPicker(container, {
    id: 'cmd_channel_picker',
    channels,
    multiSelect: true,
    filterList: (all) => all.filter((c) => !draft.channels.includes(c.id)),
    onSelect: (ch) => {
      if (!ch) return;
      if (!draft.channels.includes(ch.id)) {
        draft.channels.push(ch.id);
        renderChannelChips();
      }
    },
  });

  /* ─── Role chips (require + exclude) ─── */
  bindRoleChips(container, draft, roles, '[data-require-chips]', 'requireRoles', 'cmd_require_role');
  bindRoleChips(container, draft, roles, '[data-exclude-chips]', 'excludeRoles', 'cmd_exclude_role');

  /* ─── Message editor (только custom) ─── */
  if (!isBuiltin) {
    const editorContainer = container.querySelector('[data-message-editor-container]');
    const editor = new MessageEditor(editorContainer, draft.messageConfig, {
      bot,
      roles,
      context: 'cmd',
      presetKey: 'commands.custom',
      guildId,
      botId,
    });
    editor.onChange = (cfg) => { draft.messageConfig = cfg; };
    editor.mount();
    state.editor = editor;
  }

  /* ─── Cleanup на навигацию (back-link + cancel) ─── */
  container.querySelectorAll('a[href="#commands"]').forEach((a) => {
    a.addEventListener('click', () => {
      try { state.editor?.destroy(); } catch {}
      state.editor = null;
    });
  });

  /* ─── Delete (только custom) ─── */
  const deleteBtn = container.querySelector('[data-delete]');
  deleteBtn?.addEventListener('click', async () => {
    if (!state.data?.id) return;
    if (!confirm(`Удалить команду /${state.data.name}? Действие необратимо.`)) return;
    try {
      try { state.editor?.destroy(); } catch {}
      await api.del(`/api/commands/${state.data.id}?botId=${botId}&guildId=${guildId}`);
      toast('Команда удалена', 'success');
      location.hash = 'commands';
    } catch (err) {
      toast('Ошибка: ' + (err.data?.error || err.message), 'error');
    }
  });

  /* ─── Save ─── */
  const saveBtn = container.querySelector('[data-save]');
  saveBtn.addEventListener('click', async () => {
    const descEl = container.querySelector('#cmdDesc');

    // Финальный draft
    if (nameEl && !isBuiltin) draft.name = nameEl.value.trim();
    if (descEl) draft.description = descEl.value.trim();
    if (cooldownEl) draft.cooldownSeconds = Math.max(0, parseInt(cooldownEl.value, 10) || 0);

    // Валидация имени (только custom)
    if (!isBuiltin) {
      if (!draft.name || draft.name.length < 2) {
        toast('Имя команды: минимум 2 символа', 'warn');
        nameEl?.focus();
        return;
      }
    }

    // Whitelist без каналов == никогда. Нормализуем.
    const payloadChannelsMode =
      draft.channelsMode === 'whitelist' && !draft.channels.length ? 'all' : draft.channelsMode;

    // Актуальный messageConfig из редактора
    if (state.editor) draft.messageConfig = state.editor.getConfig();

    const orig = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Сохранение...';

    try {
      if (isBuiltin) {
        await api.put(`/api/commands/builtin/${encodeURIComponent(state.data.name)}`, {
          botId, guildId,
          enabled: draft.enabled,
          description: draft.description,
          cooldownSeconds: draft.cooldownSeconds,
          channelsMode: payloadChannelsMode,
          channels: draft.channels,
          requireRoles: draft.requireRoles,
          excludeRoles: draft.excludeRoles,
          ephemeral: draft.ephemeral,
        });
        toast('Настройки сохранены', 'success');
      } else if (state.isEdit) {
        await api.put(`/api/commands/${state.data.id}`, {
          botId, guildId,
          name: draft.name,
          description: draft.description,
          enabled: draft.enabled,
          cooldownSeconds: draft.cooldownSeconds,
          channelsMode: payloadChannelsMode,
          channels: draft.channels,
          requireRoles: draft.requireRoles,
          excludeRoles: draft.excludeRoles,
          ephemeral: draft.ephemeral,
          messageConfig: draft.messageConfig,
          // Старые поля чистим — теперь используется messageConfig
          response: '',
          responseMode: 'text',
        });
        toast('Команда сохранена', 'success');
      } else {
        await api.post('/api/commands', {
          botId, guildId,
          name: draft.name,
          description: draft.description,
          response: '',
          channelsMode: payloadChannelsMode,
          channels: draft.channels,
          cooldownSeconds: draft.cooldownSeconds,
          requireRoles: draft.requireRoles,
          excludeRoles: draft.excludeRoles,
          ephemeral: draft.ephemeral,
          responseMode: 'text',
          responseEmbedColor: '#5865F2',
          messageConfig: draft.messageConfig,
        });
        toast('Команда создана', 'success');
      }

      try { state.editor?.destroy(); } catch {}
      location.hash = 'commands';
    } catch (err) {
      const code = err.data?.error;
      const msg = UI.errors?.[code] || err.data?.message || err.message || 'Неизвестная ошибка';
      toast((code === 'duplicate_name' || code === 'reserved_name' ? '⚠ ' : 'Ошибка: ') + msg, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = orig;
    }
  });
}

function bindRoleChips(container, draft, roles, chipsSelector, draftKey, pickerId) {
  const chipsEl = container.querySelector(chipsSelector);
  if (!chipsEl) return;

  const renderChips = () => {
    if (!draft[draftKey].length) {
      chipsEl.innerHTML = `<div class="chip-empty">Не выбрано</div>`;
      return;
    }
    chipsEl.innerHTML = draft[draftKey].map((id) => {
      const r = roles.find((x) => x.id === id);
      const color = r?.color || 'var(--border-strong)';
      return `<div class="chip">
        <span class="chip-dot" style="background:${escapeHtml(color)};"></span>
        ${escapeHtml(r?.name || id)}
        <button type="button" data-remove="${escapeHtml(id)}" aria-label="Удалить">×</button>
      </div>`;
    }).join('');
    chipsEl.querySelectorAll('[data-remove]').forEach((b) => {
      b.addEventListener('click', () => {
        draft[draftKey] = draft[draftKey].filter((x) => x !== b.dataset.remove);
        renderChips();
      });
    });
  };
  renderChips();

  bindRolePicker(container, {
    id: pickerId,
    roles,
    multiSelect: true,
    filterList: (all) => all.filter((r) => !draft[draftKey].includes(r.id)),
    onSelect: (role) => {
      if (!role) return;
      if (!draft[draftKey].includes(role.id)) {
        draft[draftKey].push(role.id);
        renderChips();
      }
    },
  });
}