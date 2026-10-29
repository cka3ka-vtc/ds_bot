// public/assets/js/views/modules/grid.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { escapeHtml } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import greetingsSettingsPage from '../module-settings/greetings.js';
import levelsSettingsPage from '../module-settings/levels/index.js';

export const openableModules = {
  greetings: greetingsSettingsPage,
  levels: levelsSettingsPage,
};

export function renderModulesGrid(view, modules) {
  const container = view.container;
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');

  container.innerHTML = `
    <div class="view-head">
      <div class="view-title">
        <h1>${UI.pages.modules.title}</h1>
        <p>${UI.pages.modules.subtitle}</p>
      </div>
    </div>
    <div class="modules-grid" id="modulesGrid"></div>
  `;

  const grid = container.querySelector('#modulesGrid');
  grid.innerHTML = modules.map((m) => {
    const openable = !!openableModules[m.key];
    const stateClass = m.enabled ? 'is-enabled' : 'is-disabled';
    const statusLabel = m.enabled ? UI.common.enabled : UI.common.disabled;
    const openTitle = openable ? UI.modulesGrid.openSettings : UI.modulesGrid.openSettingsDisabled;

    return `
      <div class="module-card ${stateClass}" data-key="${m.key}">
        <div class="module-head">
          <div>
            <div class="module-name">${escapeHtml(m.name)}</div>
            <div class="module-cat">${escapeHtml(m.category)}</div>
          </div>
          <span class="module-icon ${m.color}"><i class="fa-solid ${m.icon}"></i></span>
        </div>
        <p class="module-desc">${escapeHtml(m.description)}</p>
        <div class="module-foot">
          <span class="module-status ${m.enabled ? 'on' : 'off'}">
            <span class="dot"></span> ${statusLabel}
          </span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-icon btn-ghost" data-open="${m.key}"
                    title="${openTitle}"
                    ${openable ? '' : 'disabled style="opacity:.5;"'}>
              <i class="fa-solid fa-gear"></i>
            </button>
            <button class="toggle ${m.enabled ? 'on' : ''}"
                    data-toggle="${m.key}"
                    role="switch" aria-checked="${m.enabled}"
                    aria-label="${escapeHtml(m.name)}"></button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.toggle;
      const enabled = btn.classList.toggle('on');
      btn.setAttribute('aria-checked', String(enabled));

      const card = btn.closest('.module-card');
      card.classList.toggle('is-enabled', enabled);
      card.classList.toggle('is-disabled', !enabled);

      const status = card.querySelector('.module-status');
      status.classList.toggle('on', enabled);
      status.classList.toggle('off', !enabled);
      status.innerHTML = `<span class="dot"></span> ${enabled ? UI.common.enabled : UI.common.disabled}`;

      try {
        await api.post(`/api/modules/${key}/toggle`, { botId, guildId, enabled });
        const mod = modules.find((m) => m.key === key);
        if (mod) mod.enabled = enabled;
        store.set('modulesEnabledCount', modules.filter((m) => m.enabled).length);
      } catch (err) {
        btn.classList.toggle('on');
        card.classList.toggle('is-enabled', !enabled);
        card.classList.toggle('is-disabled', enabled);
        status.classList.toggle('on', !enabled);
        status.classList.toggle('off', enabled);
        status.innerHTML = `<span class="dot"></span> ${!enabled ? UI.common.enabled : UI.common.disabled}`;
        toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
      }
    });
  });

  grid.querySelectorAll('[data-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.open;
      if (openableModules[key]) location.hash = `#modules?sub=${key}`;
      else toast(UI.modulesGrid.inDevelopment, 'info');
    });
  });
}