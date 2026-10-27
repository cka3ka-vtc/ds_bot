// public/assets/js/views/modules.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { escapeHtml } from '../core/utils.js';

export default {
  container: null,

  async render(container) {
    this.container = container;
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

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Модули</h1>
          <p>Включайте и отключайте функции бота</p>
        </div>
      </div>
      <div class="modules-grid" id="modulesGrid"></div>
    `;

    const grid = container.querySelector('#modulesGrid');
    grid.innerHTML = modules.map((m) => `
      <div class="module-card" data-key="${m.key}">
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
            <span class="dot"></span> ${m.enabled ? 'Включено' : 'Отключено'}
          </span>
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="btn btn-icon btn-ghost" data-open="${m.key}">
              <i class="fa-solid fa-gear"></i>
            </button>
            <button class="toggle ${m.enabled ? 'on' : ''}"
                    data-toggle="${m.key}"
                    role="switch" aria-checked="${m.enabled}"></button>
          </div>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.toggle;
        const enabled = btn.classList.toggle('on');
        btn.setAttribute('aria-checked', String(enabled));

        const card = btn.closest('.module-card');
        const status = card.querySelector('.module-status');
        status.classList.toggle('on', enabled);
        status.classList.toggle('off', !enabled);
        status.innerHTML = `<span class="dot"></span> ${enabled ? 'Включено' : 'Отключено'}`;

        try {
          await api.post(`/api/modules/${key}/toggle`, { botId, guildId, enabled });

          // ⚡ ФИКС: сначала обновляем локальный массив, потом считаем
          const mod = modules.find((m) => m.key === key);
          if (mod) mod.enabled = enabled;
          const total = modules.filter((m) => m.enabled).length;
          store.set('modulesEnabledCount', total);
        } catch (err) {
          btn.classList.toggle('on');
          status.classList.toggle('on', !enabled);
          status.classList.toggle('off', enabled);
          status.innerHTML = `<span class="dot"></span> ${!enabled ? 'Включено' : 'Отключено'}`;
          toast('Ошибка: ' + err.message, 'error');
        }
      });
    });

    grid.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => toast('Настройки модуля в разработке', 'info'));
    });
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