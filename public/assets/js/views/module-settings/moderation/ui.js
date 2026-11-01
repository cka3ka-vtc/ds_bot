// public/assets/js/views/module-settings/moderation/ui.js
// Структура: вкладки внутри каждого фильтра.
// Для raid — только «Параметры» и «Лог» (у raid свои настройки действий).

import { escapeHtml } from '../../../core/utils.js';
import { channelPickerHTML, rolePickerHTML } from '../pickers.js';
import {
  FILTER_KEYS, FILTER_META, ACTION_OPTIONS, ESCALATION_ACTIONS,
  actionNeedsDuration, escalationRowNeedsDuration,
  RAID_AGE_ACTIONS, RAID_WAVE_ACTIONS, RAID_MODE_ACTIONS,
} from '/shared/moderation-config.js';
import { UI } from '/shared/ui-strings.js';
import { stepperHTML, chipsHTML } from './helpers.js';

const S = UI.moderationSettings;

/* ═════════════════ Верхний уровень ═════════════════ */

export function buildPageHTML(state) {
  const { config: cfg, channels, roles } = state;
  const onCount = Object.values(cfg.filters).filter((f) => f.enabled).length;

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link">
            <i class="fa-solid fa-arrow-left"></i> ${S.backToModules}
          </a>
          <h1>${S.pageTitle}</h1>
          <p>${S.pageSubtitle}</p>
        </div>
      </div>

      <div class="gr-settings">
        ${filtersHTML(cfg, channels, roles, onCount)}
        ${testHTML()}
      </div>

      ${savebarHTML()}
    </div>`;
}

function filtersHTML(cfg, channels, roles, onCount) {
  return `
    <section class="gr-section">
      <div class="gr-section-head">
        <div><h3>${S.filtersTitle}</h3><p>${S.filtersSubtitle}</p></div>
        <div class="section-head-right">
          <span class="badge pending" data-filter-counter>
            ${S.filtersActiveBadge(onCount, FILTER_KEYS.length)}
          </span>
        </div>
      </div>
      <div class="gr-section-body">
        <div class="filters-stack">
          ${FILTER_KEYS.map((k) => filterCardHTML(k, cfg.filters[k], channels, roles)).join('')}
        </div>
      </div>
    </section>`;
}

function filterCardHTML(key, fc, channels, roles) {
  const meta = FILTER_META[key];
  const isRaid = key === 'raid';

  return `
    <div class="filter-card ${fc.enabled ? '' : 'is-off'}" data-filter="${key}">
      <div class="filter-card-head">
        <div class="filter-icon ${meta.color}">
          <i class="fa-solid ${meta.icon}"></i>
        </div>
        <div class="filter-meta">
          <strong>${escapeHtml(meta.name)}</strong>
          <span>${escapeHtml(meta.desc)}</span>
        </div>
        <button type="button" class="btn btn-icon btn-ghost filter-expand-btn" data-expand aria-label="Настроить">
          <i class="fa-solid fa-sliders"></i>
        </button>
        <button type="button"
                class="toggle ${fc.enabled ? 'on' : ''}"
                data-filter-toggle
                role="switch"
                aria-checked="${fc.enabled}"></button>
      </div>

      <div class="filter-card-body" hidden>
        <div class="filter-tabs" role="tablist">
          <button type="button" class="filter-tab active" data-ftab="params" role="tab">
            <i class="fa-solid fa-sliders"></i> ${S.tabParams}
          </button>
          ${!isRaid ? `
            <button type="button" class="filter-tab" data-ftab="punish" role="tab">
              <i class="fa-solid fa-gavel"></i> ${S.tabPunish}
            </button>
            <button type="button" class="filter-tab" data-ftab="scope" role="tab">
              <i class="fa-solid fa-tower-broadcast"></i> ${S.tabScope}
            </button>
          ` : ''}
          <button type="button" class="filter-tab" data-ftab="log" role="tab">
            <i class="fa-solid fa-scroll"></i> ${S.tabLog}
          </button>
          ${!isRaid ? `
            <button type="button" class="filter-tab" data-ftab="dm" role="tab">
              <i class="fa-solid fa-envelope"></i> ${S.tabDm}
            </button>
          ` : ''}
        </div>

        <div class="filter-tab-panel" data-fpanel="params">
          ${paramsPanelHTML(key, fc, channels)}
        </div>

        ${!isRaid ? `
          <div class="filter-tab-panel" data-fpanel="punish" hidden>
            ${punishPanelHTML(key, fc, roles)}
          </div>
          <div class="filter-tab-panel" data-fpanel="scope" hidden>
            ${scopeSectionHTML(fc, key, channels, roles)}
          </div>
        ` : ''}

        <div class="filter-tab-panel" data-fpanel="log" hidden>
          ${logSectionHTML(fc)}
        </div>

        ${!isRaid ? `
          <div class="filter-tab-panel" data-fpanel="dm" hidden>
            ${dmSectionHTML(fc)}
          </div>
        ` : ''}
      </div>
    </div>`;
}

/* ─── Параметры ─── */

function paramsPanelHTML(key, fc, channels) {
  const isRaid = key === 'raid';
  return `
    <div class="sub-section">
      <div class="sub-section-title">
        <i class="fa-solid fa-sliders"></i> ${S.paramsSectionTitle}
      </div>
      <div data-filter-params></div>
    </div>

    <div class="sub-section">
      <div class="sub-section-title">
        <i class="fa-solid fa-bell"></i> ${S.notificationsSectionTitle}
      </div>

      <div class="form-field">
        <label>${S.logChannelLabel}</label>
        <div class="channel-row">
          <div class="channel-status ${fc.logChannelId ? 'ok' : 'empty'}" data-log-status>
            <i class="fa-solid ${fc.logChannelId ? 'fa-circle-check' : 'fa-circle-minus'}"></i>
          </div>
          ${channelPickerHTML({ id: `mod_${key}_log`, placeholder: S.logChannelPlaceholder })}
        </div>
        <span class="hint">${S.logChannelHint}</span>
      </div>

      ${!isRaid ? `
        <div class="form-toggle-row">
          <div class="form-toggle-label">
            <strong>${S.dmToggleLabel}</strong>
            <span>${S.dmToggleHint}</span>
          </div>
          <button type="button"
                  class="toggle ${fc.notifyDm ? 'on' : ''}"
                  data-dm-toggle
                  role="switch"
                  aria-checked="${fc.notifyDm}"></button>
        </div>
      ` : ''}
    </div>`;
}

/* ─── Наказания ─── */

function punishPanelHTML(key, fc, roles) {
  const fallbackHidden = fc.escalation.enabled;
  return `
    ${escalationSectionHTML(fc.escalation)}
    <div class="moderation-note" data-fallback-hint ${!fallbackHidden ? 'hidden' : ''}>
      <i class="fa-solid fa-circle-info"></i>
      <span>Действие по умолчанию скрыто, пока включена карта нарушений. Отключите карту, чтобы настроить fallback-действие.</span>
    </div>
    ${actionSectionHTML(fc, key, roles)}
  `;
}

function escalationSectionHTML(esc) {
  return `
    <div class="sub-section" data-escalation-section>
      <div class="sub-section-title">
        <i class="fa-solid fa-list-ol"></i> ${S.escalationTitle}
      </div>
      <span class="hint sub-section-subtitle">${S.escalationSubtitle}</span>

      <div class="form-toggle-row" style="padding-top:0;">
        <div class="form-toggle-label">
          <strong>${S.escalationToggle}</strong>
          <span>${S.escalationToggleHint}</span>
        </div>
        <button type="button"
                class="toggle ${esc.enabled ? 'on' : ''}"
                data-escalation-toggle
                role="switch"
                aria-checked="${esc.enabled}"></button>
      </div>

      <div class="escalation-table" data-escalation-table ${!esc.enabled ? 'hidden' : ''}>
        ${esc.rows.map((r, i) => escalationRowHTML(r, i)).join('')}
      </div>

      <div class="escalation-footer" data-escalation-footer ${!esc.enabled ? 'hidden' : ''}>
        <button type="button" class="btn btn-ghost btn-sm" data-escalation-add>
          <i class="fa-solid fa-plus"></i> ${S.escalationAddLevel}
        </button>
      </div>

      <div class="reset-block" data-reset-block>
        <div class="form-toggle-row">
          <div class="form-toggle-label">
            <strong>${S.resetToggleLabel}</strong>
            <span data-reset-hint>
              ${esc.resetEnabled
                ? S.resetToggleHintOn(esc.resetDays)
                : S.resetToggleHintOff}
            </span>
          </div>
          <button type="button"
                  class="toggle ${esc.resetEnabled ? 'on' : ''}"
                  data-reset-toggle
                  role="switch"
                  aria-checked="${esc.resetEnabled}"></button>
        </div>

        <div class="reset-days-row" data-reset-days-wrap ${!esc.resetEnabled ? 'hidden' : ''}>
          <label>${S.resetDaysLabel}</label>
          <div data-reset-days>
            ${stepperHTML(esc.resetDays, 1, 90, 1, S.resetDaysSuffix)}
          </div>
        </div>
      </div>

      <div class="moderation-note">
        <i class="fa-solid fa-circle-info"></i>
        <span>${S.escalationInfo}</span>
      </div>
    </div>`;
}

export function escalationRowHTML(row, i) {
  const colorClass = i === 0 ? 'low' : i === 1 ? 'mid' : 'high';
  const noDuration = !escalationRowNeedsDuration(row.action);
  return `
    <div class="escalation-row" data-escalation-row="${i}">
      <div class="escalation-level ${colorClass}">${i + 1}-е</div>
      <select class="input" data-esc-action>
        ${ESCALATION_ACTIONS.map((a) =>
          `<option value="${a.value}" ${row.action === a.value ? 'selected' : ''}>${escapeHtml(a.label)}</option>`,
        ).join('')}
      </select>
      <div data-esc-duration>
        ${stepperHTML(row.durationMin, 0, 10080, 5, 'МИН', noDuration)}
      </div>
      <button type="button" class="escalation-remove" data-esc-remove aria-label="${S.escalationRemoveLabel}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>`;
}

function actionSectionHTML(fc, key, roles) {
  const noDuration = !actionNeedsDuration(fc.action);
  return `
    <div class="sub-section" data-fallback-action-section>
      <div class="sub-section-title">
        <i class="fa-solid fa-gavel"></i> ${S.actionSection}
      </div>
      <div class="form-field">
        <label>${S.actionFallbackLabel}</label>
        <select class="input" data-action-select>
          ${ACTION_OPTIONS.map((o) =>
            `<option value="${o.value}" ${fc.action === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`,
          ).join('')}
        </select>
      </div>
      <div class="action-config" data-action-config>
        <div class="form-field" data-extra="mute ban">
          <label>${S.actionDurationLabel}</label>
          ${stepperHTML(fc.durationMin, 1, 10080, 5, 'МИН', noDuration)}
        </div>
      </div>
    </div>`;
}

/* ─── Условия ─── */

function scopeSectionHTML(fc, key, channels, roles) {
  return `
    <div class="sub-section">
      <div class="sub-section-title"><i class="fa-solid fa-tower-broadcast"></i> ${S.scopeSection}</div>
      <div class="scope-row">
        <div class="segmented-control" data-scope-channels>
          <button type="button" class="seg-btn ${fc.channelsMode === 'all' ? 'active' : ''}" data-value="all">${S.scopeAll}</button>
          <button type="button" class="seg-btn ${fc.channelsMode === 'whitelist' ? 'active' : ''}" data-value="whitelist">${S.scopeWhitelist}</button>
          <button type="button" class="seg-btn ${fc.channelsMode === 'blacklist' ? 'active' : ''}" data-value="blacklist">${S.scopeBlacklist}</button>
        </div>
        <div data-scope-body="whitelist" ${fc.channelsMode !== 'whitelist' ? 'hidden' : ''}>
          <div class="chips" data-filter-channels-wl>
            ${chipsHTML(fc.channels, channels, 'channel', S.scopeChannelsEmpty)}
          </div>
          <div style="margin-top:8px;">
            ${channelPickerHTML({ id: `mod_${key}_ch_wl`, placeholder: S.scopeChannelsAdd })}
          </div>
        </div>
        <div data-scope-body="blacklist" ${fc.channelsMode !== 'blacklist' ? 'hidden' : ''}>
          <div class="chips" data-filter-channels-bl>
            ${chipsHTML(fc.channels, channels, 'channel', S.scopeChannelsEmpty)}
          </div>
          <div style="margin-top:8px;">
            ${channelPickerHTML({ id: `mod_${key}_ch_bl`, placeholder: S.scopeChannelsAdd })}
          </div>
        </div>
      </div>

      <div class="sub-section-title" style="margin-top:8px;">
        <i class="fa-solid fa-user-shield"></i> ${S.scopeRolesTitle}
      </div>
      <div class="chips" data-filter-roles>
        ${chipsHTML(fc.excludeRoles, roles, 'role', S.scopeRolesEmpty)}
      </div>
      <div style="margin-top:8px;">
        ${rolePickerHTML({ id: `mod_${key}_role`, roles, placeholder: S.scopeRolesAdd })}
      </div>
    </div>`;
}

/* ─── Лог ─── */

function logSectionHTML(fc) {
  const hasChannel = !!fc.logChannelId;
  return `
    <div class="sub-section">
      <div class="sub-section-title">
        <i class="fa-solid fa-scroll"></i> ${S.logEditorTitle}
      </div>
      ${!hasChannel ? `
        <div class="moderation-note moderation-note--warn">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span>${S.logChannelNotSet}</span>
        </div>
      ` : `
        <span class="hint">${S.logEditorHint}</span>
      `}
      <div data-filter-log-editor></div>
    </div>`;
}

/* ─── ЛС ─── */

function dmSectionHTML(fc) {
  return `
    <div data-dm-disabled-wrap ${fc.notifyDm ? 'hidden' : ''}>
      <div class="filter-empty-state">
        <i class="fa-solid fa-envelope-slash"></i>
        <strong>${S.dmDisabledTitle}</strong>
        <span>${S.dmDisabledHint}</span>
      </div>
    </div>
    <div data-dm-editor-wrap ${!fc.notifyDm ? 'hidden' : ''}>
      <div class="sub-section">
        <div class="sub-section-title">
          <i class="fa-solid fa-envelope"></i> ${S.dmEditorTitle}
        </div>
        <span class="hint">${S.dmEditorHint}</span>
        <div data-filter-dm-editor></div>
      </div>
    </div>`;
}

/* ─── Тест ─── */

function testHTML() {
  return `
    <section class="gr-section">
      <div class="gr-section-head">
        <div><h3>${S.testTitle}</h3><p>${S.testSubtitle}</p></div>
      </div>
      <div class="gr-section-body">
        <div class="form-field">
          <label>${S.testInputLabel}</label>
          <textarea class="input" rows="3" data-test-input>КУПИ ДЕШЕВЫЕ ПОДПИСЧИКИ!!! https://spam.example/xxx</textarea>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" data-test-run>
            <i class="fa-solid fa-flask"></i> ${S.testRun}
          </button>
          <span class="hint">${S.testHint}</span>
        </div>
        <div class="gr-perm-status" data-test-result hidden></div>
      </div>
    </section>`;
}

function savebarHTML() {
  return `
    <div class="module-page-savebar">
      <a href="#modules" class="btn btn-ghost">${S.cancel}</a>
      <button type="button" class="btn btn-primary" data-save>
        <i class="fa-solid fa-check"></i> ${S.save}
      </button>
    </div>`;
}

/* ─── Параметры фильтров (HTML) — экспортируется, чтобы filters.js мог рендерить ─── */

export function paramsHTML(key, fc) {
  const p = fc.params || {};

  switch (key) {
    case 'spam':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Сообщений</label>
          <div data-param-stepper="count">${stepperHTML(p.count, 2, 20, 1)}</div>
        </div>
        <div class="xp-input">
          <label>За секунд</label>
          <div data-param-stepper="windowSec">${stepperHTML(p.windowSec, 1, 30, 1, 'СЕК')}</div>
        </div>
      </div>`;

    case 'profanity':
      return `<div data-prof-params></div>`;

    case 'caps':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Порог капса</label>
          <div data-param-stepper="percent">${stepperHTML(p.percent, 30, 100, 5, '%')}</div>
        </div>
        <div class="xp-input">
          <label>Мин. длина</label>
          <div data-param-stepper="minLen">${stepperHTML(p.minLen, 5, 50, 1, 'СИМВ')}</div>
        </div>
      </div>`;

    case 'duplicates':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Повторов</label>
          <div data-param-stepper="count">${stepperHTML(p.count, 2, 10, 1)}</div>
        </div>
        <div class="xp-input">
          <label>Окно</label>
          <div data-param-stepper="windowSec">${stepperHTML(p.windowSec, 5, 300, 5, 'СЕК')}</div>
        </div>
      </div>`;

    case 'links':
      return `<div class="filter-params">
        <div class="xp-input" style="grid-column:1/-1;">
          <label>Разрешённые домены</label>
          <input type="text" class="input" data-param="allowedDomains"
                 value="${escapeAttr(p.allowedDomains || '')}"
                 placeholder="youtube.com, github.com">
        </div>
      </div>`;

    case 'invites':
      return `<div class="filter-params">
        <div class="xp-input" style="grid-column:1/-1;">
          <label>Разрешённые серверы (ID через запятую)</label>
          <input type="text" class="input" data-param="allowedGuilds"
                 value="${escapeAttr(p.allowedGuilds || '')}">
        </div>
      </div>`;

    case 'mentions':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Макс. упоминаний</label>
          <div data-param-stepper="maxMentions">${stepperHTML(p.maxMentions, 1, 30, 1)}</div>
        </div>
        <div class="xp-input">
          <label>@everyone / @here</label>
          <div class="form-toggle-row" style="height:40px;padding:0;border:none;">
            <span style="font-size:12px;color:var(--text-soft);">Блокировать</span>
            <button type="button"
                    class="toggle ${p.blockEveryone ? 'on' : ''}"
                    data-param-toggle="blockEveryone"
                    role="switch"
                    aria-checked="${p.blockEveryone}"></button>
          </div>
        </div>
      </div>`;

    case 'raid':
      return raidParamsHTML(p);

    case 'zalgo':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Макс. наложений</label>
          <div data-param-stepper="maxMarks">${stepperHTML(p.maxMarks, 1, 20, 1)}</div>
        </div>
        <div class="xp-input">
          <label>Мин. длина</label>
          <div data-param-stepper="minLen">${stepperHTML(p.minLen, 1, 100, 1, 'СИМВ')}</div>
        </div>
      </div>`;

    case 'emoji':
      return `<div class="filter-params">
        <div class="xp-input">
          <label>Макс. эмодзи</label>
          <div data-param-stepper="maxEmoji">${stepperHTML(p.maxEmoji, 2, 50, 1, 'ШТ')}</div>
        </div>
        <div class="xp-input">
          <label>Кастомные</label>
          <div class="form-toggle-row" style="height:40px;padding:0;border:none;">
            <span style="font-size:12px;color:var(--text-soft);">Считать</span>
            <button type="button"
                    class="toggle ${p.includeCustom ? 'on' : ''}"
                    data-param-toggle="includeCustom"
                    role="switch"
                    aria-checked="${p.includeCustom}"></button>
          </div>
        </div>
      </div>`;

    default:
      return '';
  }
}

/* ─── Антирейд: HTML подсекций ─── */

function raidParamsHTML(p) {
  const R = S.raid;
  const ageBanHidden = p.ageAction !== 'ban';
  const waveBanHidden = p.waveAction !== 'ban_all';
  const waveSlowmodeHidden = p.waveAction !== 'slowmode';
  const waveLockdownHidden = p.waveAction !== 'lockdown';
  const raidModeHidden = p.enableRaidMode === false;
  const raidModeBanHidden = p.raidModeAction !== 'ban';

  return `
    <div class="raid-settings">

      <div class="raid-subsection">
        <div class="raid-subsection-title">
          <i class="fa-solid fa-wave-square"></i>
          ${R.detectionTitle}
        </div>
        <span class="hint">${R.detectionHint}</span>
        <div class="filter-params">
          <div class="xp-input">
            <label>${R.joinsLabel}</label>
            <div data-param-stepper="joins">${stepperHTML(p.joins, 3, 100, 1)}</div>
          </div>
          <div class="xp-input">
            <label>${R.windowLabel}</label>
            <div data-param-stepper="windowSec">${stepperHTML(p.windowSec, 3, 300, 1, 'СЕК')}</div>
          </div>
        </div>
      </div>

      <div class="raid-subsection">
        <div class="raid-subsection-title">
          <i class="fa-solid fa-user-clock"></i>
          ${R.ageTitle}
        </div>
        <div class="form-toggle-row" style="padding-top:0;">
          <div class="form-toggle-label">
            <strong>${R.ageToggle}</strong>
            <span>${R.ageToggleHint}</span>
          </div>
          <button type="button"
                  class="toggle ${p.checkAccountAge ? 'on' : ''}"
                  data-param-toggle="checkAccountAge"
                  role="switch"
                  aria-checked="${p.checkAccountAge}"></button>
        </div>
        <div class="raid-dependent" data-raid-age-section ${!p.checkAccountAge ? 'hidden' : ''}>
          <div class="filter-params">
            <div class="xp-input">
              <label>${R.minAgeLabel}</label>
              <div data-param-stepper="minAccountAgeDays">${stepperHTML(p.minAccountAgeDays, 0, 365, 1, 'ДН')}</div>
            </div>
            <div class="xp-input">
              <label>${R.ageActionLabel}</label>
              <select class="input" data-param="ageAction">
                ${RAID_AGE_ACTIONS.map((a) =>
                  `<option value="${a.value}" ${p.ageAction === a.value ? 'selected' : ''}>${escapeAttr(a.label)}</option>`,
                ).join('')}
              </select>
            </div>
          </div>
          <div class="filter-params" data-raid-age-ban ${ageBanHidden ? 'hidden' : ''}>
            <div class="xp-input">
              <label>${R.ageBanDurationLabel}</label>
              <div data-param-stepper="ageBanDurationMin">${stepperHTML(p.ageBanDurationMin, 0, 10080, 60, 'МИН')}</div>
              <span class="hint">0 = ${R.ageBanForever}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="raid-subsection">
        <div class="raid-subsection-title">
          <i class="fa-solid fa-bolt"></i>
          ${R.waveTitle}
        </div>
        <span class="hint">${R.waveHint}</span>
        <div class="filter-params">
          <div class="xp-input">
            <label>${R.waveActionLabel}</label>
            <select class="input" data-param="waveAction">
              ${RAID_WAVE_ACTIONS.map((a) =>
                `<option value="${a.value}" ${p.waveAction === a.value ? 'selected' : ''}>${escapeAttr(a.label)}</option>`,
              ).join('')}
            </select>
          </div>
        </div>
        <div class="filter-params" data-raid-wave-ban ${waveBanHidden ? 'hidden' : ''}>
          <div class="xp-input">
            <label>${R.waveBanDurationLabel}</label>
            <div data-param-stepper="waveBanDurationMin">${stepperHTML(p.waveBanDurationMin, 1, 10080, 60, 'МИН')}</div>
          </div>
        </div>
        <div class="filter-params" data-raid-wave-slowmode ${waveSlowmodeHidden ? 'hidden' : ''}>
          <div class="xp-input">
            <label>${R.slowmodeSecLabel}</label>
            <div data-param-stepper="slowmodeSec">${stepperHTML(p.slowmodeSec, 5, 21600, 5, 'СЕК')}</div>
          </div>
        </div>
        <div class="filter-params" data-raid-wave-lockdown ${waveLockdownHidden ? 'hidden' : ''}>
          <div class="xp-input">
            <label>${R.lockdownDurationLabel}</label>
            <div data-param-stepper="lockdownDurationMin">${stepperHTML(p.lockdownDurationMin, 1, 1440, 5, 'МИН')}</div>
          </div>
        </div>
      </div>

      <div class="raid-subsection">
        <div class="raid-subsection-title">
          <i class="fa-solid fa-lock"></i>
          ${R.raidModeTitle}
        </div>
        <span class="hint">${R.raidModeHint}</span>
        <div class="form-toggle-row" style="padding-top:0;">
          <div class="form-toggle-label">
            <strong>${R.raidModeToggle}</strong>
          </div>
          <button type="button"
                  class="toggle ${p.enableRaidMode ? 'on' : ''}"
                  data-param-toggle="enableRaidMode"
                  role="switch"
                  aria-checked="${p.enableRaidMode}"></button>
        </div>
        <div class="raid-dependent" data-raid-mode-body ${raidModeHidden ? 'hidden' : ''}>
          <div class="filter-params">
            <div class="xp-input">
              <label>${R.raidModeActionLabel}</label>
              <select class="input" data-param="raidModeAction">
                ${RAID_MODE_ACTIONS.map((a) =>
                  `<option value="${a.value}" ${p.raidModeAction === a.value ? 'selected' : ''}>${escapeAttr(a.label)}</option>`,
                ).join('')}
              </select>
            </div>
            <div class="xp-input">
              <label>${R.raidModeDurationLabel}</label>
              <div data-param-stepper="raidModeDurationMin">${stepperHTML(p.raidModeDurationMin, 1, 1440, 5, 'МИН')}</div>
            </div>
          </div>
          <div class="filter-params" data-raid-mode-ban ${raidModeBanHidden ? 'hidden' : ''}>
            <div class="xp-input">
              <label>${R.raidModeBanDurationLabel}</label>
              <div data-param-stepper="raidModeBanDurationMin">${stepperHTML(p.raidModeBanDurationMin, 0, 10080, 60, 'МИН')}</div>
              <span class="hint">0 = ${R.ageBanForever}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="raid-subsection">
        <div class="raid-subsection-title">
          <i class="fa-solid fa-hourglass-half"></i>
          ${R.cooldownTitle}
        </div>
        <span class="hint">${R.cooldownHint}</span>
        <div class="filter-params">
          <div class="xp-input">
            <label>${R.cooldownMinLabel}</label>
            <div data-param-stepper="cooldownMin">${stepperHTML(p.cooldownMin, 0, 720, 5, 'МИН')}</div>
          </div>
        </div>
      </div>

    </div>`;
}

function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}