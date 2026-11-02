// public/assets/js/views/module-settings/moderation/setup/filters.js

import { bindChannelPicker, bindRolePicker } from '../../pickers.js';
import { MessageEditor, emptyMessageConfig } from '../../message-editor.js';
import { UI } from '/shared/ui-strings.js';
import {
  FILTER_KEYS, FILTER_META, filterDmDefault, filterLogDefault, actionNeedsDuration,
} from '/shared/moderation-config.js';
import {
  chipsHTML, bindChips, refreshChips,
  bindSteppers, readStepper, setStepperDisabled,
} from '../helpers.js';
import { paramsHTML } from '../ui.js';
import { bindEscalation } from './escalation.js';

const S = UI.moderationSettings;

export function setupFilters(ctx) {
  const { root, cfg } = ctx;

  FILTER_KEYS.forEach((key) => {
    const card = root.querySelector(`.filter-card[data-filter="${key}"]`);
    if (!card) return;
    const fc = cfg.filters[key];

    const paramsEl = card.querySelector('[data-filter-params]');
    if (paramsEl) paramsEl.innerHTML = paramsHTML(key, fc);

    bindFilterTabs(card);
    bindExpand(card);
    bindToggle(card, key, fc, ctx);
    bindParams(card, key, fc);

    if (key === 'raid') {
      bindRaidParams(card, fc);
    }

    bindParamsNotifications(card, key, fc, ctx);

    if (key !== 'raid') {
      bindEscalation(ctx, card, fc.escalation);
      bindActionSection(card, key, fc, ctx);
      bindScopeSection(card, key, fc, ctx);
      bindDmSection(card, key, fc, ctx);
    }

    bindLogSection(card, key, fc, ctx);

    if (key === 'profanity') {
      import('./profanity.js')
        .then(({ setupProfanity }) => setupProfanity(ctx, card, fc))
        .catch((err) => console.error('profanity setup failed', err));
    }
  });

  bindSteppers(root);
}

/* ─── Вкладки ─── */

function bindFilterTabs(card) {
  const tabs = card.querySelectorAll('.filter-tab');
  const panels = card.querySelectorAll('.filter-tab-panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.ftab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      panels.forEach((p) => { p.hidden = p.dataset.fpanel !== target; });
    });
  });
}

/* ─── Раскрытие ─── */

function bindExpand(card) {
  const btn = card.querySelector('[data-expand]');
  const body = card.querySelector('.filter-card-body');
  btn?.addEventListener('click', () => {
    const expanded = card.classList.toggle('expanded');
    if (body) body.hidden = !expanded;
    btn.setAttribute('aria-expanded', String(expanded));
  });
}

/* ─── Toggle фильтра ─── */

function bindToggle(card, key, fc, ctx) {
  const btn = card.querySelector('[data-filter-toggle]');
  btn?.addEventListener('click', () => {
    btn.classList.toggle('on');
    const on = btn.classList.contains('on');
    btn.setAttribute('aria-checked', String(on));
    card.classList.toggle('is-off', !on);
    fc.enabled = on;
    updateCounter(ctx);
  });
}

function updateCounter(ctx) {
  const { root, cfg, S: Strings } = ctx;
  const total = Object.keys(cfg.filters).length;
  const on = Object.values(cfg.filters).filter((f) => f.enabled).length;
  const counter = root.querySelector('[data-filter-counter]');
  if (!counter) return;
  counter.textContent = Strings.filtersActiveBadge(on, total);
  counter.classList.remove('online', 'offline', 'pending');
  counter.classList.add(on === total ? 'online' : on === 0 ? 'offline' : 'pending');
}

/* ─── Параметры (кроме raid) ─── */

function bindParams(card, key, fc) {
  if (key === 'profanity') return;
  if (key === 'raid') return;

  card.querySelectorAll('[data-param-stepper]').forEach((wrap) => {
    const param = wrap.dataset.paramStepper;
    wrap.querySelector('.num-stepper-input')?.addEventListener('change', () => {
      fc.params[param] = readStepper(wrap);
    });
  });

  card.querySelectorAll('[data-param]').forEach((el) => {
    const param = el.dataset.param;
    const handler = () => { fc.params[param] = el.value; };
    el.addEventListener('input', handler);
    if (el.tagName === 'SELECT') el.addEventListener('change', handler);
  });

  card.querySelectorAll('[data-param-toggle]').forEach((t) => {
    const param = t.dataset.paramToggle;
    t.addEventListener('click', () => {
      t.classList.toggle('on');
      fc.params[param] = t.classList.contains('on');
      t.setAttribute('aria-checked', String(fc.params[param]));
    });
  });
}

/* ─── Антирейд ─── */

function bindRaidParams(card, fc) {
  const p = fc.params;

  card.querySelectorAll('[data-param-stepper]').forEach((wrap) => {
    const param = wrap.dataset.paramStepper;
    wrap.querySelector('.num-stepper-input')?.addEventListener('change', () => {
      p[param] = readStepper(wrap);
    });
  });

  card.querySelectorAll('[data-param]').forEach((el) => {
    const param = el.dataset.param;
    const handler = () => { p[param] = el.value; syncVisibility(); };
    el.addEventListener('change', handler);
  });

  card.querySelectorAll('[data-param-toggle]').forEach((t) => {
    const param = t.dataset.paramToggle;
    t.addEventListener('click', () => {
      t.classList.toggle('on');
      p[param] = t.classList.contains('on');
      t.setAttribute('aria-checked', String(p[param]));
      syncVisibility();
    });
  });

  function syncVisibility() {
    const ageOn = p.checkAccountAge !== false;
    card.querySelectorAll('[data-raid-age-section]').forEach((el) => {
      el.hidden = !ageOn;
    });
    const ageBanVisible = p.ageAction === 'ban';
    card.querySelectorAll('[data-raid-age-ban]').forEach((el) => {
      el.hidden = !ageBanVisible;
    });
    const wave = p.waveAction;
    card.querySelectorAll('[data-raid-wave-ban]').forEach((el) => {
      el.hidden = wave !== 'ban_all';
    });
    card.querySelectorAll('[data-raid-wave-slowmode]').forEach((el) => {
      el.hidden = wave !== 'slowmode';
    });
    card.querySelectorAll('[data-raid-wave-lockdown]').forEach((el) => {
      el.hidden = wave !== 'lockdown';
    });
    const rmOn = p.enableRaidMode !== false;
    card.querySelectorAll('[data-raid-mode-body]').forEach((el) => {
      el.hidden = !rmOn;
    });
    const rmBanVisible = p.raidModeAction === 'ban';
    card.querySelectorAll('[data-raid-mode-ban]').forEach((el) => {
      el.hidden = !rmBanVisible;
    });
  }

  syncVisibility();
}

/* ─── Уведомления ─── */

function bindParamsNotifications(card, key, fc, ctx) {
  const { channels, S: Strings } = ctx;

  const statusEl = card.querySelector('[data-log-status]');
  function setStatus(ok) {
    if (!statusEl) return;
    statusEl.className = 'channel-status ' + (ok ? 'ok' : 'empty');
    statusEl.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-minus'}"></i>`;
    statusEl.setAttribute('data-tooltip', ok ? Strings.channelStatusOk : Strings.channelStatusEmpty);
  }

  const logPicker = bindChannelPicker(card, {
    id: `mod_${key}_log`,
    channels,
    onSelect: (ch) => {
      fc.logChannelId = ch?.id || '';
      setStatus(!!ch);
      updateLogChannelNote(card, fc, Strings);
    },
  });
  if (fc.logChannelId) {
    const ch = channels.find((c) => c.id === fc.logChannelId);
    if (ch && logPicker) logPicker.setValue?.(ch);
  }

  const dmToggle = card.querySelector('[data-dm-toggle]');
  if (!dmToggle) return;

  const dmEditorWrap = card.querySelector('[data-dm-editor-wrap]');
  const dmDisabledWrap = card.querySelector('[data-dm-disabled-wrap]');
  dmToggle.addEventListener('click', () => {
    dmToggle.classList.toggle('on');
    const on = dmToggle.classList.contains('on');
    dmToggle.setAttribute('aria-checked', String(on));
    fc.notifyDm = on;
    if (dmEditorWrap) dmEditorWrap.hidden = !on;
    if (dmDisabledWrap) dmDisabledWrap.hidden = on;
    if (on) mountDmEditor(card, fc, ctx);
  });
}

function updateLogChannelNote(card, fc, Strings) {
  const panel = card.querySelector('[data-fpanel="log"]');
  if (!panel) return;
  const note = panel.querySelector('.moderation-note');
  const hint = panel.querySelector('.hint');
  if (fc.logChannelId) {
    if (note) note.style.display = 'none';
    if (hint) hint.style.display = '';
  } else {
    if (note) note.style.display = '';
    if (hint) hint.style.display = 'none';
  }
}

/* ─── Действие по умолчанию ─── */

function bindActionSection(card, key, fc, ctx) {
  const section = card.querySelector('[data-fallback-action-section]');
  const hint = card.querySelector('[data-fallback-hint]');
  const sel = card.querySelector('[data-action-select]');
  const cfg = card.querySelector('[data-action-config]');
  if (!section || !sel) return;

  function updateVisibility() {
    const hide = !!fc.escalation.enabled;
    section.hidden = hide;
    if (hint) hint.hidden = !hide;
  }
  updateVisibility();
  card.addEventListener('moderation:escalation-changed', updateVisibility);

  const durWrap = cfg?.querySelector('[data-extra="mute ban"]');
  const durStepper = durWrap?.querySelector('.num-stepper');

  function updateExtras() {
    const v = sel.value;
    cfg?.querySelectorAll('[data-extra]').forEach((el) => {
      const show = String(el.dataset.extra || '').split(' ').includes(v);
      el.hidden = !show;
    });
    if (durStepper) {
      setStepperDisabled(durStepper, !actionNeedsDuration(v));
    }
  }

  sel.addEventListener('change', () => {
    fc.action = sel.value;
    updateExtras();
  });

  durWrap?.querySelector('.num-stepper-input')?.addEventListener('change', () => {
    fc.durationMin = Math.max(1, readStepper(durWrap) || 10);
  });

  updateExtras();
}

/* ─── Условия ─── */

function bindScopeSection(card, key, fc, ctx) {
  const { channels, roles, S: Strings } = ctx;

  const seg = card.querySelector('[data-scope-channels]');
  seg?.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b === btn));
      fc.channelsMode = btn.dataset.value;
      card.querySelectorAll('[data-scope-body]').forEach((b) => {
        b.hidden = b.dataset.scopeBody !== btn.dataset.value;
      });
    });
  });

  const channelsEls = card.querySelectorAll(
    '[data-filter-channels-wl], [data-filter-channels-bl]',
  );
  const rolesEl = card.querySelector('[data-filter-roles]');

  function redrawChannels() {
    channelsEls.forEach((el) => {
      el.innerHTML = chipsHTML(fc.channels, channels, 'channel', Strings.scopeChannelsEmpty);
    });
  }

  channelsEls.forEach((el) => {
    bindChips(el, (id) => {
      fc.channels = fc.channels.filter((x) => x !== id);
      redrawChannels();
    });
  });

  bindChips(rolesEl, (id) => {
    fc.excludeRoles = fc.excludeRoles.filter((x) => x !== id);
    refreshChips(rolesEl, fc.excludeRoles, roles, 'role', Strings.scopeRolesEmpty);
  });

  bindChannelPicker(card, {
    id: `mod_${key}_ch_wl`,
    channels,
    onSelect: (ch) => {
      if (!ch) return;
      if (!fc.channels.includes(ch.id)) fc.channels.push(ch.id);
      redrawChannels();
    },
  });
  bindChannelPicker(card, {
    id: `mod_${key}_ch_bl`,
    channels,
    onSelect: (ch) => {
      if (!ch) return;
      if (!fc.channels.includes(ch.id)) fc.channels.push(ch.id);
      redrawChannels();
    },
  });

  bindRolePicker(card, {
    id: `mod_${key}_role`,
    roles,
    onSelect: (r) => {
      if (!r) return;
      if (!fc.excludeRoles.includes(r.id)) fc.excludeRoles.push(r.id);
      refreshChips(rolesEl, fc.excludeRoles, roles, 'role', Strings.scopeRolesEmpty);
    },
  });
}

/* ─── Лог ─── */

function bindLogSection(card, key, fc, ctx) {
  const editorEl = card.querySelector('[data-filter-log-editor]');
  if (!editorEl) return;

  const isRaid = key === 'raid';
  const filterName = FILTER_META[key]?.name || key;

  const ed = new MessageEditor(editorEl, fc.templateLog || emptyMessageConfig(), {
    bot: ctx.bot || { name: 'Bot', avatarUrl: null },
    roles: ctx.roles || [],
    context: isRaid ? 'moderation.raid' : 'moderation.log',
    presetKey: null,
    resetFactory: () => filterLogDefault(key),
    // Прокидываем корректное имя фильтра для preview — иначе {filter}
    // в превью всегда показывал «Антиспам» (статичное значение контекста).
    previewTokens: { filter: filterName },
    guildId: ctx.guildId,
    botId: ctx.botId,
  });
  ed.onChange = (c) => { fc.templateLog = c; };
  ed.mount();
  ctx._editors[`log_${key}`] = ed;
}

/* ─── ЛС ─── */

function bindDmSection(card, key, fc, ctx) {
  if (fc.notifyDm) mountDmEditor(card, fc, ctx);
}

function mountDmEditor(card, fc, ctx) {
  const editorEl = card.querySelector('[data-filter-dm-editor]');
  if (!editorEl) return;
  const key = card.dataset.filter;
  const editorKey = `dm_${key}`;
  if (ctx._editors[editorKey]) return;

  const initial = (fc.templateDm && Array.isArray(fc.templateDm.blocks) && fc.templateDm.blocks.length)
    ? fc.templateDm
    : filterDmDefault(key);
  fc.templateDm = initial;

  const filterName = FILTER_META[key]?.name || key;

  const ed = new MessageEditor(editorEl, initial, {
    bot: ctx.bot || { name: 'Bot', avatarUrl: null },
    roles: ctx.roles || [],
    context: 'moderation.dm',
    presetKey: null,
    resetFactory: () => filterDmDefault(key),
    previewTokens: { filter: filterName },
    guildId: ctx.guildId,
    botId: ctx.botId,
  });
  ed.onChange = (c) => { fc.templateDm = c; };
  ed.mount();
  ctx._editors[editorKey] = ed;
}