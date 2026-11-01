// public/assets/js/views/overview/layout.js
import { UI } from '/shared/ui-strings.js';
import { renderKpiGrid } from './kpi.js';
import { renderChartSection } from './chart.js';
import { renderTopCommands, renderTopChannels, renderUpcomingBirthdays } from './lists.js';

const BIRTHDAYS_LIMIT = 5;

/**
 * Возвращает полный HTML страницы дашборда.
 *
 * @param {object} view — объект-страница (chartFilter, channelFilter, data, ...)
 * @param {object} parts
 * @param {string} parts.eventsFiltersHTML — HTML фильтров «Последних событий»
 * @param {string} parts.eventsBodyHTML    — HTML списка «Последних событий»
 */
export function renderLayout(view, { eventsFiltersHTML, eventsBodyHTML }) {
  const d = view.data;
  const cf = view.channelFilter;
  const hasChannelStats = (d.topChannels?.text?.length || 0) + (d.topChannels?.voice?.length || 0) > 0;
  const me = d.modulesEnabled || {};

  const topCommandsTooltip = `${UI.overview.topCommands.hint} Данные за 7 дней.`;
  const topChannelsTooltip = `${UI.overview.topChannels.hint} Данные за 7 дней.`;

  const birthdaysSub = me.birthdays
    ? `${BIRTHDAYS_LIMIT} ближайших`
    : 'требуется модуль';

  return `
    <div class="view-head">
      <div class="view-title">
        <h1>${UI.pages.overview.title}</h1>
        <p>${UI.pages.overview.subtitle}</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-ghost" data-refresh>
          <i class="fa-solid fa-rotate"></i> ${UI.overview.refresh}
        </button>
      </div>
    </div>

    ${renderKpiGrid(d)}

    <div class="overview-grid three-cols">

      <!-- Ближайшие дни рождения -->
      <div class="card">
        <div class="card-head">
          <div>
            <span class="card-title">Ближайшие дни рождения</span>
            <span class="card-sub">${birthdaysSub}</span>
          </div>
        </div>
        <div class="card-body" style="padding:12px;">
          ${renderUpcomingBirthdays(d.upcomingBirthdays, me.birthdays)}
        </div>
      </div>

      <!-- Топ команд -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="kpi-label-group">
              <span class="card-title">${UI.overview.topCommands.title}</span>
              <button class="kpi-hint" type="button"
                      data-tooltip="${topCommandsTooltip}">?</button>
            </div>
          </div>
        </div>
        <div class="card-body" style="padding:12px;">
          ${renderTopCommands(d.topCommands)}
        </div>
      </div>

      <!-- Популярные каналы -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="kpi-label-group">
              <span class="card-title">${UI.overview.topChannels.title}</span>
              <button class="kpi-hint" type="button"
                      data-tooltip="${topChannelsTooltip}">?</button>
            </div>
          </div>
          ${hasChannelStats ? `
            <div class="chart-filters" role="tablist">
              <button class="chart-filter ${cf === 'text' ? 'active' : ''}" data-channel-filter="text">${UI.overview.topChannels.filterText}</button>
              <button class="chart-filter ${cf === 'voice' ? 'active' : ''}" data-channel-filter="voice">${UI.overview.topChannels.filterVoice}</button>
            </div>
          ` : ''}
        </div>
        <div class="card-body" style="padding:12px;" id="topChannelsBody">
          <div data-channel-list="text" ${cf !== 'text' ? 'hidden' : ''}>
            ${renderTopChannels(d.topChannels.text, 'text')}
          </div>
          <div data-channel-list="voice" ${cf !== 'voice' ? 'hidden' : ''}>
            ${renderTopChannels(d.topChannels.voice, 'voice')}
          </div>
        </div>
      </div>
    </div>

    <div class="overview-grid two-cols">

      <!-- Активность -->
      ${renderChartSection(d, view.chartFilter)}

      <!-- Последние события -->
      <div class="card">
        <div class="card-head">
          <div><span class="card-title">${UI.overview.recentEvents.title}</span></div>
          ${eventsFiltersHTML}
        </div>
        <div class="card-body" style="padding:8px;" id="eventsBody">
          ${eventsBodyHTML}
        </div>
      </div>
    </div>
  `;
}