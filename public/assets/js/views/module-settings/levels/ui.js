// public/assets/js/views/module-settings/levels/ui.js
import { escapeHtml } from '../../../core/utils.js';
import { channelPickerHTML, rolePickerHTML } from '../pickers.js';
import { numStepper } from './helpers.js';
import { UI } from '/shared/ui-strings.js';
import { LEVELS_MSG } from '/shared/command-editor-strings.js';

const L = UI.levels;
const M = LEVELS_MSG;

export function buildPageHTML(cfg, channels = []) {
  const ev = cfg.enabledEvents;
  const evCfg = cfg.events;
  const activeMsgTab = 'levelUp';

  const textChannels = channels.filter((c) => c.type === 0);
  const hasVoiceChannels = channels.some((c) => c.type === 2 || c.type === 13);

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link"><i class="fa-solid fa-arrow-left"></i> ${UI.common.backToModules.replace('← ', '')}</a>
          <h1>${L.pageTitle}</h1>
          <p>${L.pageSubtitle}</p>
        </div>
      </div>

      <div class="gr-settings">

        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>${L.mainTitle}</h3><p>${L.mainSubtitle}</p></div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>${L.channelLabel}</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status data-tooltip="Канал не выбран">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'levels_channel', placeholder: 'Выберите текстовый канал...' })}
                </div>
                <span class="hint">${L.channelHint}</span>
              </div>

              <div class="form-field" style="margin-top:16px;">
                <label>${L.formulaLabel}</label>
                <div class="segmented-control" data-formula-seg>
                  <button type="button" data-value="classic" class="seg-btn ${cfg.formula !== 'linear' ? 'active' : ''}">${L.formulaClassic}</button>
                  <button type="button" data-value="linear"  class="seg-btn ${cfg.formula === 'linear' ? 'active' : ''}">${L.formulaLinear}</button>
                </div>
                <span class="hint" data-formula-hint></span>
              </div>

              <div class="form-grid-2" style="margin-top:12px;">
                <div class="form-field">
                  <label>${L.maxLevelLabel}</label>
                  ${numStepper({ value: cfg.maxLevel, min: 1, max: 500, data: 'data-max-level' })}
                  <span class="hint">${L.maxLevelHint}</span>
                </div>
                <div class="form-field">
                  <label>${L.boostLabel}</label>
                  ${numStepper({ value: cfg.boostMultiplier, min: 1, max: 10, step: 0.1, data: 'data-boost-multiplier' })}
                  <span class="hint">${L.boostHint}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>${L.inactivityTitle}</h3><p>${L.inactivitySubtitle}</p></div>
            </div>
            <div class="gr-section-body">
              <div class="inactivity ${cfg.inactivity.enabled ? 'is-on' : ''}">
                <div class="inactivity-head">
                  <div class="inactivity-head-left">
                    <div class="inactivity-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="inactivity-title">
                      <strong>${L.inactivityToggle}</strong>
                      <span>${L.inactivityToggleHint}</span>
                    </div>
                  </div>
                  <button type="button" class="toggle ${cfg.inactivity.enabled ? 'on' : ''}" data-inactivity-toggle role="switch" aria-checked="${cfg.inactivity.enabled}"></button>
                </div>

                <div class="inactivity-body">
                  <div class="form-field">
                    <label>${L.inactivityDays}</label>
                    ${numStepper({ value: cfg.inactivity.days, min: 1, max: 365, data: 'data-inactivity-days' })}
                  </div>
                  <div class="form-field">
                    <label>${L.inactivityPenalty}</label>
                    ${numStepper({ value: cfg.inactivity.penaltyXp, min: 1, max: 10000, step: 10, data: 'data-inactivity-penalty' })}
                  </div>

                  <div class="inactivity-roles-row ${cfg.rewards.enabled ? '' : 'is-disabled'}" data-inactivity-roles-row>
                    <div class="inactivity-roles-info">
                      <strong>${L.inactivityRemoveRoles}</strong>
                      <span data-inactivity-roles-note>${cfg.rewards.enabled ? L.inactivityRemoveRolesOn : L.inactivityRemoveRolesOff}</span>
                    </div>
                    <button type="button"
                            class="toggle ${cfg.inactivity.removeRolesOnDecrease ? 'on' : ''}"
                            data-inactivity-remove-roles-toggle
                            role="switch"
                            aria-checked="${cfg.inactivity.removeRolesOnDecrease}"
                            ${cfg.rewards.enabled ? '' : 'disabled aria-disabled="true"'}></button>
                  </div>
                </div>

                <div class="inactivity-warning" data-inactivity-warning>
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span data-inactivity-warning-text></span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>${L.xpTitle}</h3><p>${L.xpSubtitle}</p></div>
          </div>
          <div class="gr-section-body">
            <div class="xp-events">
              ${xpEventCard('message', 'fa-message', 'blue', L.xpMessage, L.xpMessageHint, evCfg.message, ev.message)}
              ${xpEventCard('command', 'fa-terminal', 'purple', L.xpCommand, L.xpCommandHint, evCfg.command, ev.command)}
              ${xpEventCard('voice',   'fa-volume-high', 'pink', L.xpVoice, L.xpVoiceHint, evCfg.voice, ev.voice)}
              ${dailyEventCard(cfg.dailyXp, cfg.dailyEnabled)}
            </div>
          </div>
        </section>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>${L.titlesTitle}</h3><p>${L.titlesSubtitle.replace('{title}', '<code>{title}</code>')}</p></div>
            <div class="section-head-right">
              <button type="button" class="btn btn-ghost btn-sm" data-add-title>
                <i class="fa-solid fa-plus"></i> ${L.titlesAdd}
              </button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="title-table" data-title-table></div>
            <div class="titles-hint">
              <i class="fa-solid fa-info-circle"></i>
              <span>${L.titlesHint}</span>
            </div>
          </div>
        </section>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>${L.rewardsTitle}</h3><p>${L.rewardsSubtitle}</p></div>
            <div class="section-head-right">
              <button type="button" class="toggle ${cfg.rewards.enabled ? 'on' : ''}" data-rewards-toggle role="switch" aria-checked="${cfg.rewards.enabled}" title="${cfg.rewards.enabled ? L.rewardsDisable : L.rewardsEnable}"></button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="rewards-panel ${cfg.rewards.enabled ? '' : 'disabled'}" data-rewards-panel>
              <div class="reward-table" data-reward-table></div>
              <button type="button" class="btn btn-ghost btn-sm" data-add-reward>
                <i class="fa-solid fa-plus"></i> ${L.rewardsAdd}
              </button>
            </div>
            <div class="rewards-disabled-note" data-rewards-disabled-note ${cfg.rewards.enabled ? 'hidden' : ''}>
              <i class="fa-solid fa-info-circle"></i>
              <span>${L.rewardsDisabledNote}</span>
            </div>
          </div>
        </section>

        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>${L.exclChannelsTitle}</h3><p>${L.exclChannelsSubtitle}${hasVoiceChannels ? ' — можно добавлять и голосовые' : ''}</p></div>
            </div>
            <div class="gr-section-body">
              <div class="chips" data-excl-channels></div>
              <div class="exclusion-picker">
                ${channelPickerHTML({ id: 'excl_channel_picker', placeholder: L.exclChannelsAdd })}
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>${L.exclRolesTitle}</h3><p>${L.exclRolesSubtitle}</p></div>
            </div>
            <div class="gr-section-body">
              <div class="chips" data-excl-roles></div>
              <div class="exclusion-picker">
                ${rolePickerHTML({ id: 'excl_role_picker', roles: [], placeholder: L.exclRolesAdd })}
              </div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div>
              <h3>${M.sectionTitle}</h3>
              <p>${M.sectionSubtitle}</p>
            </div>
            <div class="section-head-right">
              <button type="button" class="btn btn-ghost btn-sm" data-test-message>
                <i class="fa-solid fa-paper-plane"></i> ${M.testButton}
              </button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="gr-tabs" data-msg-tabs>
              <button type="button" class="gr-tab ${activeMsgTab === 'levelUp' ? 'active' : ''}" data-msg-tab="levelUp">${M.tabs.levelUp.title}</button>
              <button type="button" class="gr-tab ${activeMsgTab === 'rank' ? 'active' : ''}" data-msg-tab="rank">${M.tabs.rank.title}</button>
              <button type="button" class="gr-tab ${activeMsgTab === 'leaderboard' ? 'active' : ''}" data-msg-tab="leaderboard">${M.tabs.leaderboard.title}</button>
              <button type="button" class="gr-tab ${activeMsgTab === 'daily' ? 'active' : ''}" data-msg-tab="daily">${M.tabs.daily.title}</button>
            </div>
            <p class="gr-messages-tab-hint" data-msg-tab-hint>${M.tabs.levelUp.hint}</p>
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

function xpEventCard(key, icon, color, title, subtitle, evCfg, enabled) {
  return `
    <div class="xp-event ${enabled ? '' : 'disabled'}" data-event-card="${key}">
      <div class="xp-event-head">
        <div class="xp-event-icon ${color}"><i class="fa-solid ${icon}"></i></div>
        <div class="xp-event-title">
          <strong>${title}</strong>
          <span>${subtitle}</span>
        </div>
        <button type="button" class="toggle ${enabled ? 'on' : ''}" data-event-toggle="${key}" role="switch" aria-checked="${enabled}"></button>
      </div>
      <div class="xp-event-body">
        <div class="xp-input">
          <label>${L.xpLabel}</label>
          ${numStepper({ value: evCfg.xp, min: 0, max: 100, suffix: 'XP' })}
        </div>
        <div class="xp-input">
          <label>${L.cooldownLabel}</label>
          ${numStepper({ value: evCfg.cooldownMin, min: 1, max: 1440, suffix: 'мин' })}
        </div>
      </div>
    </div>
  `;
}

function dailyEventCard(dailyXp, dailyEnabled) {
  return `
    <div class="xp-event ${dailyEnabled ? '' : 'disabled'}" data-event-card="daily">
      <div class="xp-event-head">
        <div class="xp-event-icon green"><i class="fa-solid fa-gift"></i></div>
        <div class="xp-event-title">
          <strong>${L.xpDaily}</strong>
          <span>${L.xpDailyHint.replace('/daily', '<code>/daily</code>')}</span>
        </div>
        <button type="button" class="toggle ${dailyEnabled ? 'on' : ''}" data-event-toggle="daily" role="switch" aria-checked="${dailyEnabled}"></button>
      </div>
      <div class="xp-event-body">
        <div class="xp-input">
          <label>${L.xpLabel}</label>
          ${numStepper({ value: dailyXp, min: 1, max: 5000, step: 10, suffix: 'XP', data: 'data-daily-xp' })}
        </div>
        <div class="xp-input">
          <label>${L.cooldownLabel}</label>
          <div class="xp-static-value" title="${L.dailyCooldownStatic}">
            <i class="fa-solid fa-clock"></i> ${L.dailyCooldownStatic}
          </div>
        </div>
      </div>
    </div>
  `;
}