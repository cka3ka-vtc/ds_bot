// public/assets/js/core/router.js
import { closeModal } from './modal.js';

export class Router {
  constructor({ views, defaultView = 'overview', container }) {
    this.views = views;
    this.defaultView = defaultView;
    this.container = container;
    this.currentName = null;
    this.currentView = null;

    window.addEventListener('hashchange', () => this._render());
    this._render();
  }

  navigate(name) {
    if (location.hash === `#${name}`) this._render();
    else location.hash = name;
  }

  rerender() { this._render(); }

  async _render() {
    const name = (location.hash.slice(1) || this.defaultView).split('?')[0];
    const view = this.views[name] || this.views[this.defaultView];
    if (!view) return;

    // Закрываем открытые модалки — при навигации они не должны
    // висеть поверх новой страницы.
    closeModal();

    if (this.currentView?.destroy) {
      try { this.currentView.destroy(); } catch {}
    }
    this.currentName = name;
    this.currentView = view;

    this.container.innerHTML = '';
    try {
      await view.render(this.container);
    } catch (err) {
      console.error(err);
      this.container.innerHTML = `<div class="empty-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <strong>Ошибка загрузки</strong>
        <span>${err.message || 'Попробуйте обновить страницу'}</span>
      </div>`;
    }

    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.dataset.nav === name);
    });
  }
}