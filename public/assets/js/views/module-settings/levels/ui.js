// public/assets/js/views/module-settings/levels/ui.js
import { escapeHtml } from '../../../core/utils.js';
import { channelPickerHTML, rolePickerHTML } from '../pickers.js';
import { numStepper } from './helpers.js';

export function buildPageHTML(cfg) {
  const ev = cfg.enabledEvents;
  const evCfg = cfg.events;

  return `
    <div class="module-page">
      <div class="view-head">
        <div class="view-title">
          <a href="#modules" class="back-link"><i class="fa-solid fa-arrow-left"></i> К модулям</a>
          <h1>Уровни</h1>
          <p>Система опыта, званий и награды</p>
        </div>
      </div>

      <div class="gr-settings">

        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>Основное</h3><p>Канал и формула</p></div>
            </div>
            <div class="gr-section-body">
              <div class="form-field">
                <label>Канал объявлений</label>
                <div class="channel-row">
                  <div class="channel-status empty" data-channel-status data-tooltip="Канал не выбран">
                    <i class="fa-solid fa-circle-minus"></i>
                  </div>
                  ${channelPickerHTML({ id: 'levels_channel' })}
                </div>
                <span class="hint">Сюда будут приходить сообщения о повышении уровня</span>
              </div>

              <div class="form-field" style="margin-top:16px;">
                <label>Формула уровней</label>
                <div class="segmented-control" data-formula-seg>
                  <button type="button" data-value="classic" class="seg-btn ${cfg.formula !== 'linear' ? 'active' : ''}">Классическая</button>
                  <button type="button" data-value="linear"  class="seg-btn ${cfg.formula === 'linear' ? 'active' : ''}">Линейная</button>
                </div>
                <span class="hint" data-formula-hint></span>
              </div>

              <div class="form-grid-2" style="margin-top:12px;">
                <div class="form-field">
                  <label>Максимальный уровень</label>
                  ${numStepper({ value: cfg.maxLevel, min: 1, max: 500, data: 'data-max-level' })}
                  <span class="hint">Дальше XP не начисляется</span>
                </div>
                <div class="form-field">
                  <label>Множитель за буст</label>
                  ${numStepper({ value: cfg.boostMultiplier, min: 1, max: 10, step: 0.1, data: 'data-boost-multiplier' })}
                  <span class="hint">Бустеры сервера получают больше XP</span>
                </div>
              </div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>Снятие за неактивность</h3><p>Мотивация оставаться активным</p></div>
            </div>
            <div class="gr-section-body">
              <div class="inactivity ${cfg.inactivity.enabled ? 'is-on' : ''}">
                <div class="inactivity-head">
                  <div class="inactivity-head-left">
                    <div class="inactivity-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="inactivity-title">
                      <strong>Снимать XP за неактивность</strong>
                      <span>Штраф раз в сутки для тех, кто давно не заходил</span>
                    </div>
                  </div>
                  <button type="button" class="toggle ${cfg.inactivity.enabled ? 'on' : ''}" data-inactivity-toggle role="switch" aria-checked="${cfg.inactivity.enabled}"></button>
                </div>

                <div class="inactivity-body">
                  <div class="form-field">
                    <label>Дней неактивности</label>
                    ${numStepper({ value: cfg.inactivity.days, min: 1, max: 365, data: 'data-inactivity-days' })}
                  </div>
                  <div class="form-field">
                    <label>Штраф XP / сутки</label>
                    ${numStepper({ value: cfg.inactivity.penaltyXp, min: 1, max: 10000, step: 10, data: 'data-inactivity-penalty' })}
                  </div>

                  <div class="inactivity-roles-row ${cfg.rewards.enabled ? '' : 'is-disabled'}" data-inactivity-roles-row>
                    <div class="inactivity-roles-info">
                      <strong>Снимать роли при понижении</strong>
                      <span data-inactivity-roles-note>${
                        cfg.rewards.enabled
                          ? 'Только автороли, выданные модулем и не соответствующие новому уровню'
                          : 'Недоступно: награды отключены'
                      }</span>
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
            <div><h3>Начисления XP</h3><p>Свои XP и кулдаун (в минутах) для каждого события</p></div>
          </div>
          <div class="gr-section-body">
            <div class="xp-events">
              ${xpEventCard('message', 'fa-message', 'blue', 'Сообщения', 'Текстовые каналы', evCfg.message, ev.message)}
              ${xpEventCard('command', 'fa-terminal', 'purple', 'Команды', 'Слэш-команды бота', evCfg.command, ev.command)}
              ${xpEventCard('voice',   'fa-volume-high', 'pink', 'Голосовой канал', 'Кроме AFK и заглушённых', evCfg.voice, ev.voice)}
              ${dailyEventCard(cfg.dailyXp, cfg.dailyEnabled)}
            </div>
          </div>
        </section>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>Звания</h3><p>Тематические названия уровней — выводятся через токен <code>{title}</code></p></div>
            <div class="section-head-right">
              <button type="button" class="btn btn-ghost btn-sm" data-add-title>
                <i class="fa-solid fa-plus"></i> Добавить звание
              </button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="title-table" data-title-table></div>
            <div class="titles-hint">
              <i class="fa-solid fa-info-circle"></i>
              <span>Звание подставляется автоматически по текущему уровню — используется в сообщении о повышении и в карточке участника.</span>
            </div>
          </div>
        </section>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>Награды за уровни</h3><p>Роли выдаются автоматически при достижении</p></div>
            <div class="section-head-right">
              <button type="button" class="toggle ${cfg.rewards.enabled ? 'on' : ''}" data-rewards-toggle role="switch" aria-checked="${cfg.rewards.enabled}" title="${cfg.rewards.enabled ? 'Отключить награды' : 'Включить награды'}"></button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="rewards-panel ${cfg.rewards.enabled ? '' : 'disabled'}" data-rewards-panel>
              <div class="reward-table" data-reward-table></div>
              <button type="button" class="btn btn-ghost btn-sm" data-add-reward>
                <i class="fa-solid fa-plus"></i> Добавить награду
              </button>
            </div>
            <div class="rewards-disabled-note" data-rewards-disabled-note ${cfg.rewards.enabled ? 'hidden' : ''}>
              <i class="fa-solid fa-info-circle"></i>
              <span>Награды отключены. Роли не выдаются и не снимаются, но уже выданные остаются у участников.</span>
            </div>
          </div>
        </section>

        <div class="gr-grid-2">
          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>Исключённые каналы</h3><p>Где не начисляется XP</p></div>
            </div>
            <div class="gr-section-body">
              <div class="exclusion-picker">
                ${channelPickerHTML({ id: 'excl_channel_picker', placeholder: '+ Добавить канал в исключения' })}
              </div>
              <div class="chips" data-excl-channels></div>
            </div>
          </section>

          <section class="gr-section">
            <div class="gr-section-head">
              <div><h3>Исключённые роли</h3><p>Кому не начисляется XP</p></div>
            </div>
            <div class="gr-section-body">
              <div class="exclusion-picker">
                ${rolePickerHTML({ id: 'excl_role_picker', roles: [], placeholder: '+ Добавить роль в исключения' })}
              </div>
              <div class="chips" data-excl-roles></div>
            </div>
          </section>
        </div>

        <section class="gr-section">
          <div class="gr-section-head">
            <div><h3>Сообщение о повышении</h3><p>Как увидят участники в канале объявлений</p></div>
            <div class="section-head-right">
              <button type="button" class="btn btn-ghost btn-sm" data-test-message>
                <i class="fa-solid fa-paper-plane"></i> Отправить тест
              </button>
            </div>
          </div>
          <div class="gr-section-body">
            <div class="gr-editor-container" data-editor-container></div>
          </div>
        </section>

      </div>

      <div class="module-page-savebar">
        <a href="#modules" class="btn btn-ghost">Отмена</a>
        <button type="button" class="btn btn-primary" data-save>
          <i class="fa-solid fa-check"></i> Сохранить
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
          <label>Выдаваемый XP</label>
          ${numStepper({ value: evCfg.xp, min: 0, max: 100, suffix: 'XP' })}
        </div>
        <div class="xp-input">
          <label>Кулдаун</label>
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
          <strong>Ежедневная награда</strong>
          <span>Команда <code>/daily</code> раз в 24 часа</span>
        </div>
        <button type="button" class="toggle ${dailyEnabled ? 'on' : ''}" data-event-toggle="daily" role="switch" aria-checked="${dailyEnabled}"></button>
      </div>
      <div class="xp-event-body">
        <div class="xp-input">
          <label>Выдаваемый XP</label>
          ${numStepper({ value: dailyXp, min: 1, max: 5000, step: 10, suffix: 'XP', data: 'data-daily-xp' })}
        </div>
        <div class="xp-input">
          <label>Кулдаун</label>
          <div class="xp-static-value" title="Фиксированный интервал">
            <i class="fa-solid fa-clock"></i> 24 часа
          </div>
        </div>
      </div>
    </div>
  `;
}

export { escapeHtml };