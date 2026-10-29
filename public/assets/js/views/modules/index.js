// public/assets/js/views/modules/index.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { openableModules, renderModulesGrid } from './grid.js';

export default {
  container: null,

  async render(container) {
    this.container = container;

    const hash = location.hash.slice(1) || '';
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const sub = new URLSearchParams(query).get('sub');

    if (sub && openableModules[sub]) {
      return openableModules[sub].render(container);
    }

    const botId = store.get('activeBotId');
    const guildId = store.get('activeGuildId');
    if (!botId || !guildId) {
      return this._empty(container, 'Выберите сервер', 'Сначала выберите сервер в сайдбаре');
    }

    container.innerHTML = '<div class="boot-screen"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>';

    let modules = [];
    try {
      modules = await api.get(`/api/modules?botId=${botId}&guildId=${guildId}`);
    } catch (err) {
      return this._empty(container, 'Не удалось загрузить модули', err.message);
    }

    store.set('modulesEnabledCount', modules.filter((m) => m.enabled).length);
    renderModulesGrid(this, modules);
  },

  destroy() {
    const hash = location.hash.slice(1) || '';
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const sub = new URLSearchParams(query).get('sub');
    if (sub && openableModules[sub]) openableModules[sub].destroy?.();
    this.container = null;
  },

  _empty(container, title, text) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-puzzle-piece"></i>
        <strong>${title}</strong>
        <span>${text}</span>
      </div>`;
  },
};