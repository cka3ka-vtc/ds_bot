// public/assets/js/views/commands/editor.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { CMD_EDITOR } from '/shared/command-editor-strings.js';
import { COMMAND_PRESETS, findCommandPreset } from '/shared/command-presets.js';
import {
  channelPickerHTML, bindChannelPicker,
  rolePickerHTML, bindRolePicker,
  positionPopup,
} from '../module-settings/pickers.js';

const F = CMD_EDITOR.fields;
const S = CMD_EDITOR.sections;
const T = CMD_EDITOR.toolbar;
const P = CMD_EDITOR.presets;
const W = CMD_EDITOR.warnings;
const TOKENS = CMD_EDITOR.tokens;

function emptyDraft() {
  return {
    name: '',
    description: '',
    response: '',
    responseMode: 'text',
    responseEmbedColor: '#5865F2',
    channelsMode: 'all',
    channels: [],
    cooldownSeconds: 0,
    requireRoles: [],
    excludeRoles: [],
    ephemeral: false,
    enabled: true,
  };
}

export function openEditor(view, id) {
  const editing = id ? view.state.custom.find((c) => c.id === id) : null;
  const draft = editing ? { ...editing } : emptyDraft();
  draft.channels = [...(draft.channels || [])];
  draft.requireRoles = [...(draft.requireRoles || [])];
  draft.excludeRoles = [...(draft.excludeRoles || [])];

  const channels = view.state.channels || [];
  const roles = view.state.roles || [];

  openModal({
    title: editing ? UI.commands.editorEdit : UI.commands.editorCreate,
    subtitle: editing ? `/${editing.name}` : UI.commands.editorSubtitleCreate,
    body: renderBody(draft, channels, roles),
    wide: true,
    ctaLabel: editing ? UI.common.save : UI.commands.create,
    onOpen: (modal) => bindEditor(modal, view, draft, channels, roles, editing),
    onSubmit: async (modal) => submit(modal, view, draft, editing),
  });
}

/* ═══════════════════════════════════════════════════════════════
   Рендер
   ═══════════════════════════════════════════════════════════════ */

function renderBody(draft, channels, roles) {
  const presetsCollapsed = isPresetsCollapsed();

  return `
    <div class="cmd-editor">
      ${renderPresetsCard(presetsCollapsed)}

      <!-- Основное -->
      <section class="cmd-editor-section">
        <h4 class="cmd-editor-section-title">${S.basic}</h4>
        <div class="form-row single">
          <div class="form-field">
            <label>${F.name}</label>
            <input type="text" id="cmdName" maxlength="32" value="${escapeHtml(draft.name)}" placeholder="${escapeHtml(F.namePlaceholder)}">
            <span class="hint" id="cmdNameHint">${F.nameHint}</span>
          </div>
        </div>
        <div class="form-row single">
          <div class="form-field">
            <label>${F.description}</label>
            <input type="text" id="cmdDesc" maxlength="100" value="${escapeHtml(draft.description)}" placeholder="${escapeHtml(F.descriptionPlaceholder)}">
          </div>
        </div>
      </section>

      <!-- Ответ -->
      <section class="cmd-editor-section">
        <h4 class="cmd-editor-section-title">${S.response}</h4>
        <div class="form-grid-2">
          <div class="form-field">
            <label>${F.responseMode}</label>
            <div class="segmented-control" data-response-mode-seg>
              <button type="button" class="seg-btn ${draft.responseMode === 'text' ? 'active' : ''}" data-value="text">${F.responseModeText}</button>
              <button type="button" class="seg-btn ${draft.responseMode === 'embed' ? 'active' : ''}" data-value="embed">${F.responseModeEmbed}</button>
            </div>
          </div>
          <div class="form-field" data-color-field style="${draft.responseMode === 'embed' ? '' : 'display:none;'}">
            <label>${F.embedColor}</label>
            <div class="color-picker-compact">
              <input type="color" id="cmdColor" value="${escapeHtml(draft.responseEmbedColor || '#5865F2')}">
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>${F.response}</label>
          ${toolbarHTML()}
          <textarea id="cmdResponse" rows="6" maxlength="2000" placeholder="${escapeHtml(F.responsePlaceholder)}">${escapeHtml(draft.response)}</textarea>
          <span class="hint">${F.responseHint}</span>
        </div>
      </section>

      <!-- Доступ -->
      <section class="cmd-editor-section">
        <h4 class="cmd-editor-section-title">${S.access}</h4>

        <div class="form-field">
          <label>${F.channelsMode}</label>
          <div class="segmented-control" data-channels-mode-seg>
            <button type="button" class="seg-btn ${draft.channelsMode === 'all' ? 'active' : ''}" data-value="all">${F.channelsModeAll}</button>
            <button type="button" class="seg-btn ${draft.channelsMode === 'whitelist' ? 'active' : ''}" data-value="whitelist">${F.channelsModeWhitelist}</button>
            <button type="button" class="seg-btn ${draft.channelsMode === 'blacklist' ? 'active' : ''}" data-value="blacklist">${F.channelsModeBlacklist}</button>
          </div>
        </div>

        <div class="form-field" data-channels-field style="${draft.channelsMode === 'all' ? 'display:none;' : ''}">
          <label>${F.channels}</label>
          <div class="cmd-editor-chips" data-channels-chips data-empty="${escapeHtml(F.channelsEmpty)}"></div>
          <div class="channel-row" style="margin-top:8px;">
            ${channelPickerHTML({ id: 'cmd_channel_picker', placeholder: F.channelsPlaceholder })}
          </div>
          <span class="hint" data-whitelist-hint style="${draft.channelsMode === 'whitelist' && !draft.channels.length ? '' : 'display:none;'}">${W.whitelistEmpty}</span>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>${F.requireRoles}</label>
            <div class="cmd-editor-chips" data-require-chips data-empty="${escapeHtml(F.requireRolesEmpty)}"></div>
            <div class="channel-row" style="margin-top:8px;">
              ${rolePickerHTML({ id: 'cmd_require_role', roles, placeholder: F.requireRolesPlaceholder })}
            </div>
            <span class="hint">${F.requireRolesHint}</span>
          </div>
          <div class="form-field">
            <label>${F.excludeRoles}</label>
            <div class="cmd-editor-chips" data-exclude-chips data-empty="${escapeHtml(F.excludeRolesEmpty)}"></div>
            <div class="channel-row" style="margin-top:8px;">
              ${rolePickerHTML({ id: 'cmd_exclude_role', roles, placeholder: F.excludeRolesPlaceholder })}
            </div>
            <span class="hint">${F.excludeRolesHint}</span>
          </div>
        </div>
      </section>

      <!-- Поведение -->
      <section class="cmd-editor-section">
        <h4 class="cmd-editor-section-title">${S.behavior}</h4>

        <div class="form-grid-2">
          <div class="form-field">
            <label>${F.cooldown}</label>
            <input type="number" id="cmdCooldown" min="0" max="86400" value="${Number(draft.cooldownSeconds) || 0}">
            <span class="hint">${F.cooldownHint}</span>
          </div>
        </div>

        <div class="form-toggle-row">
          <div class="form-toggle-label">
            <strong>${F.ephemeral}</strong>
            <span>${F.ephemeralHint}</span>
          </div>
          <button type="button" class="toggle ${draft.ephemeral ? 'on' : ''}" id="cmdEphemeral" role="switch" aria-checked="${draft.ephemeral}"></button>
        </div>
      </section>
    </div>
  `;
}

function renderPresetsCard(collapsed) {
  return `
    <div class="card msg-templates-card ${collapsed ? 'collapsed' : ''}" data-cmd-presets-card>
      <div class="card-head" data-cmd-presets-toggle role="button" tabindex="0"
           aria-expanded="${!collapsed}"
           title="${collapsed ? P.expand : P.collapse}">
        <div>
          <span class="card-title">${P.title}</span>
          <span class="card-sub">${P.subtitle}</span>
        </div>
        <span class="card-collapse-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </div>
      <div class="card-body">
        <div class="msg-templates-grid">
          ${COMMAND_PRESETS.map((p) => `
            <button type="button" class="msg-template-btn" data-cmd-preset="${escapeHtml(p.key)}">
              <span class="msg-template-icon"><i class="fa-solid ${escapeHtml(p.icon)}"></i></span>
              <span class="msg-template-text">
                <strong>${escapeHtml(p.label)}</strong>
                <span>${escapeHtml(p.description || '')}</span>
              </span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function toolbarHTML() {
  return `
    <div class="editor-toolbar" data-cmd-toolbar>
      <button type="button" data-format="bold" title="${T.bold}"><b>B</b></button>
      <button type="button" data-format="italic" title="${T.italic}"><i>I</i></button>
      <button type="button" data-format="underline" title="${T.underline}"><u>U</u></button>
      <button type="button" data-format="strike" title="${T.strike}"><s>S</s></button>
      <div class="toolbar-sep"></div>
      <button type="button" data-format="code" title="${T.code}">&lt;/&gt;</button>
      <button type="button" data-format="spoiler" title="${T.spoiler}">▮</button>
      <div class="toolbar-sep"></div>
      <button type="button" class="tokens-btn" data-cmd-tokens-btn title="${T.tokensTitle}">${T.tokens} ▾</button>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════
   Привязка событий
   ═══════════════════════════════════════════════════════════════ */

function bindEditor(modal, view, draft, channels, roles, editing) {
  /* ─── Пресеты: collapse ─── */
  bindPresetsCollapse(modal);

  /* ─── Пресеты: применение ─── */
  modal.querySelectorAll('[data-cmd-preset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const preset = findCommandPreset(btn.dataset.cmdPreset);
      if (!preset) return;
      const hasContent = draft.name || draft.description || draft.response;
      if (hasContent) {
        const ok = await confirmPreset();
        if (!ok) return;
      }
      applyPresetToDraft(modal, draft, preset);
    });
  });

  /* ─── Валидация имени ─── */
  bindNameValidation(modal, editing);

  /* ─── Формат ответа ─── */
  const colorField = modal.querySelector('[data-color-field]');
  modal.querySelectorAll('[data-response-mode-seg] .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-response-mode-seg] .seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn));
      draft.responseMode = btn.dataset.value;
      if (colorField) colorField.style.display = draft.responseMode === 'embed' ? '' : 'none';
    });
  });

  /* ─── Режим каналов ─── */
  const channelsField = modal.querySelector('[data-channels-field]');
  const whitelistHint = modal.querySelector('[data-whitelist-hint]');
  modal.querySelectorAll('[data-channels-mode-seg] .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-channels-mode-seg] .seg-btn').forEach((b) =>
        b.classList.toggle('active', b === btn));
      draft.channelsMode = btn.dataset.value;
      if (channelsField) channelsField.style.display = draft.channelsMode === 'all' ? 'none' : '';
      updateWhitelistHint();
    });
  });

  function updateWhitelistHint() {
    if (!whitelistHint) return;
    whitelistHint.style.display =
      draft.channelsMode === 'whitelist' && !draft.channels.length ? '' : 'none';
  }

  /* ─── Каналы ─── */
  const channelsChips = modal.querySelector('[data-channels-chips]');
  function renderChannelChips() {
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
        updateWhitelistHint();
      });
    });
  }
  renderChannelChips();

  bindChannelPicker(modal, {
    id: 'cmd_channel_picker',
    channels,
    multiSelect: true,
    filterList: (all) => all.filter((c) => !draft.channels.includes(c.id)),
    onSelect: (ch) => {
      if (!ch) return;
      if (!draft.channels.includes(ch.id)) {
        draft.channels.push(ch.id);
        renderChannelChips();
        updateWhitelistHint();
      }
    },
  });

  /* ─── Роли ─── */
  bindRoleChips(modal, draft, roles, '[data-require-chips]', 'requireRoles', 'cmd_require_role');
  bindRoleChips(modal, draft, roles, '[data-exclude-chips]', 'excludeRoles', 'cmd_exclude_role');

  /* ─── Ephemeral toggle ─── */
  const epToggle = modal.querySelector('#cmdEphemeral');
  epToggle.addEventListener('click', () => {
    draft.ephemeral = !draft.ephemeral;
    epToggle.classList.toggle('on', draft.ephemeral);
    epToggle.setAttribute('aria-checked', String(draft.ephemeral));
  });

  /* ─── Кулдаун ─── */
  const cooldownEl = modal.querySelector('#cmdCooldown');
  cooldownEl.addEventListener('change', () => {
    let v = parseInt(cooldownEl.value, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 86400) v = 86400;
    cooldownEl.value = String(v);
    draft.cooldownSeconds = v;
  });

  /* ─── Тулбар: форматирование + переменные ─── */
  bindToolbar(modal, draft);
}

function bindRoleChips(modal, draft, roles, chipsSelector, draftKey, pickerId) {
  const chipsEl = modal.querySelector(chipsSelector);
  const renderChips = () => {
    chipsEl.innerHTML = draft[draftKey].map((id) => {
      const r = roles.find((x) => x.id === id);
      const color = r?.color || 'var(--muted)';
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

  bindRolePicker(modal, {
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

/* ═══════════════════════════════════════════════════════════════
   Пресеты
   ═══════════════════════════════════════════════════════════════ */

const PRESETS_COLLAPSE_KEY = 'cmd_presets_collapsed';

function isPresetsCollapsed() {
  try { return localStorage.getItem(PRESETS_COLLAPSE_KEY) === '1'; }
  catch { return false; }
}
function savePresetsCollapsed(v) {
  try { localStorage.setItem(PRESETS_COLLAPSE_KEY, v ? '1' : '0'); }
  catch {}
}

function bindPresetsCollapse(modal) {
  const card = modal.querySelector('[data-cmd-presets-card]');
  const toggle = modal.querySelector('[data-cmd-presets-toggle]');
  if (!card || !toggle) return;

  const doToggle = () => {
    const collapsed = !card.classList.contains('collapsed');
    card.classList.toggle('collapsed', collapsed);
    savePresetsCollapsed(collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.title = collapsed ? P.expand : P.collapse;
  };

  toggle.addEventListener('click', (e) => {
    if (e.target.closest('button, input, select, textarea, a, label')) return;
    doToggle();
  });
  toggle.addEventListener('keydown', (e) => {
    if (e.target !== toggle) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doToggle(); }
  });
}

function confirmPreset() {
  return openModal({
    title: P.confirmReplaceTitle,
    body: `<div style="padding:4px 0; font-size:14px; line-height:1.55; color:var(--text-soft);">${escapeHtml(P.confirmReplace)}</div>`,
    ctaLabel: P.confirmYes,
    onSubmit: async () => true,
  }).then((r) => r === true);
}

function applyPresetToDraft(modal, draft, preset) {
  const built = preset.build();
  Object.assign(draft, built);

  const nameEl = modal.querySelector('#cmdName');
  const descEl = modal.querySelector('#cmdDesc');
  const respEl = modal.querySelector('#cmdResponse');
  const colorEl = modal.querySelector('#cmdColor');
  const cdEl = modal.querySelector('#cmdCooldown');
  const epToggle = modal.querySelector('#cmdEphemeral');
  const colorField = modal.querySelector('[data-color-field]');
  const nameHint = modal.querySelector('#cmdNameHint');

  if (nameEl) nameEl.value = draft.name || '';
  if (descEl) descEl.value = draft.description || '';
  if (respEl) {
    respEl.value = draft.response || '';
    // Триггерим input для пересчёта чего угодно (сейчас ничего, но на будущее)
    respEl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (colorEl) colorEl.value = draft.responseEmbedColor || '#5865F2';
  if (cdEl) cdEl.value = String(draft.cooldownSeconds || 0);

  modal.querySelectorAll('[data-response-mode-seg] .seg-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.value === draft.responseMode);
  });
  if (colorField) colorField.style.display = draft.responseMode === 'embed' ? '' : 'none';

  if (epToggle) {
    epToggle.classList.toggle('on', !!draft.ephemeral);
    epToggle.setAttribute('aria-checked', String(!!draft.ephemeral));
  }

  // Сброс подсказки имени — пресет мог подставить занятое имя
  if (nameHint) {
    nameHint.textContent = F.nameHint;
    nameHint.style.color = 'var(--muted)';
  }

  toast('Шаблон применён', 'success');
}

/* ═══════════════════════════════════════════════════════════════
   Тулбар: форматирование + переменные
   ═══════════════════════════════════════════════════════════════ */

function bindToolbar(modal, draft) {
  const toolbar = modal.querySelector('[data-cmd-toolbar]');
  const textarea = modal.querySelector('#cmdResponse');
  if (!toolbar || !textarea) return;

  toolbar.addEventListener('click', (e) => {
    const fmtBtn = e.target.closest('[data-format]');
    if (fmtBtn) {
      e.preventDefault();
      applyFormat(fmtBtn.dataset.format, textarea);
      return;
    }

    const tokensBtn = e.target.closest('[data-cmd-tokens-btn]');
    if (tokensBtn) {
      e.preventDefault();
      openTokensMenu(tokensBtn, textarea);
    }
  });
}

function applyFormat(format, textarea) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const value = textarea.value;
  const selected = value.substring(start, end);

  const wrap = {
    bold: '**', italic: '*', underline: '__', strike: '~~',
    code: '`', spoiler: '||',
  }[format];

  if (!wrap) return;

  const insert = selected || format;
  textarea.value = value.substring(0, start) + wrap + insert + wrap + value.substring(end);
  textarea.selectionStart = start + wrap.length;
  textarea.selectionEnd = start + wrap.length + insert.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function openTokensMenu(anchor, textarea) {
  // Закрываем всё, что могло быть открыто
  document.querySelectorAll('.time-dropdown, .tokens-dropdown, .picker-popup').forEach((d) => d.remove());

  const dd = document.createElement('div');
  dd.className = 'tokens-dropdown';

  dd.innerHTML = TOKENS.map((cat) => `
    <div class="tokens-category">
      <div class="tokens-category-label">${escapeHtml(cat.label)}</div>
      ${cat.items.map(([id, desc]) => `
        <button type="button" class="tokens-item" data-token-id="${escapeHtml(id)}">
          <code class="tokens-item-code">{${escapeHtml(id)}}</code>
          <span class="tokens-item-desc">${escapeHtml(desc || '')}</span>
        </button>
      `).join('')}
    </div>
  `).join('');

  document.body.appendChild(dd);
  positionPopup(dd, anchor, 300);

  const close = (ev) => {
    if (!dd.contains(ev.target) && !anchor.contains(ev.target)) {
      dd.remove();
      document.removeEventListener('mousedown', close);
    }
  };
  setTimeout(() => document.addEventListener('mousedown', close), 0);

  dd.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-token-id]');
    if (!btn) return;
    e.preventDefault();
    insertToken(textarea, `{${btn.dataset.tokenId}}`);
    dd.remove();
    document.removeEventListener('mousedown', close);
  });
}

function insertToken(textarea, token) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const value = textarea.value;
  textarea.value = value.substring(0, start) + token + value.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + token.length;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/* ═══════════════════════════════════════════════════════════════
   Валидация имени
   ═══════════════════════════════════════════════════════════════ */

function bindNameValidation(modal, editing) {
  const nameEl = modal.querySelector('#cmdName');
  const hint = modal.querySelector('#cmdNameHint');
  let t = null;

  nameEl.addEventListener('input', () => {
    clearTimeout(t);
    const raw = nameEl.value.trim();
    const sanitized = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

    if (raw && sanitized !== raw) {
      hint.textContent = UI.commands.editorNameSanitized + '"' + sanitized + '"';
      hint.style.color = 'var(--orange)';
    } else {
      hint.textContent = F.nameHint;
      hint.style.color = 'var(--muted)';
    }
    if (!sanitized) return;

    t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          botId: store.get('activeBotId'),
          guildId: store.get('activeGuildId'),
          name: sanitized,
          ...(editing ? { excludeId: editing.id } : {}),
        });
        const result = await api.get(`/api/commands/check?${params}`);
        if (!result.valid && result.error === 'duplicate_name') {
          hint.textContent = UI.commands.editorNameDuplicate;
          hint.style.color = 'var(--red)';
        } else if (!result.valid && result.error === 'reserved_name') {
          hint.textContent = UI.commands.editorNameReserved;
          hint.style.color = 'var(--red)';
        } else if (result.valid) {
          hint.textContent = UI.commands.editorNameFree;
          hint.style.color = 'var(--green)';
        }
      } catch {}
    }, 400);
  });
}

/* ═══════════════════════════════════════════════════════════════
   Submit
   ═══════════════════════════════════════════════════════════════ */

async function submit(modal, view, draft, editing) {
  const nameEl = modal.querySelector('#cmdName');
  const descEl = modal.querySelector('#cmdDesc');
  const respEl = modal.querySelector('#cmdResponse');
  const colorEl = modal.querySelector('#cmdColor');

  draft.name = nameEl.value.trim();
  draft.description = descEl.value.trim();
  draft.response = respEl.value;
  draft.responseEmbedColor = colorEl ? colorEl.value : '#5865F2';

  if (!draft.name) { toast(F.name, 'warn'); throw new Error('no_name'); }
  if (draft.name.length < 2) { toast(UI.commands.minNameLength, 'warn'); throw new Error('short_name'); }
  if (!draft.response.trim()) { toast(F.response, 'warn'); throw new Error('no_response'); }

  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');

  const payload = {
    botId, guildId,
    name: draft.name,
    description: draft.description,
    response: draft.response,
    channelsMode: draft.channelsMode,
    channels: draft.channels,
    cooldownSeconds: Number(draft.cooldownSeconds) || 0,
    requireRoles: draft.requireRoles,
    excludeRoles: draft.excludeRoles,
    ephemeral: !!draft.ephemeral,
    responseMode: draft.responseMode,
    responseEmbedColor: draft.responseEmbedColor,
  };

  try {
    if (editing) {
      await api.put(`/api/commands/${editing.id}`, payload);
      toast(UI.toast.saved, 'success');
    } else {
      await api.post('/api/commands', payload);
      toast(UI.commands.created, 'success');
    }
    await view.render(view.container);
  } catch (err) {
    const code = err.data?.error;
    const mapped = UI.errors[code] || err.data?.message || err.message;
    toast(code === 'duplicate_name' || code === 'reserved_name'
      ? '⚠ ' + mapped
      : UI.common.error + ': ' + mapped, 'error');
    throw err;
  }
}