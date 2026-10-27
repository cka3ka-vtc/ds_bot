// public/assets/js/views/bots.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { escapeHtml, initials, userAvatarUrl } from '../core/utils.js';
import { openAddBotModal } from '../components/addBotModal.js';

export default {
  async render(container) {
    const bots = await api.get('/api/bots');
    store.set('bots', bots);
    const activeId = store.get('activeBotId');

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Мои боты</h1>
          <p>Управляйте ботом, подключайте собственных и выбирайте активного</p>
        </div>
        <div class="view-actions">
          <a href="/auth/discord/bot-invite" class="btn btn-primary">
            <i class="fa-brands fa-discord"></i> Добавить бота на сервер
          </a>
          <button class="btn btn-ghost" data-add-bot>
            <i class="fa-solid fa-plus"></i> Добавить своего бота
          </button>
        </div>
      </div>
      <div class="bots-grid">
        ${bots.map((b) => this._card(b, activeId)).join('')}
      </div>
    `;

    container.querySelectorAll('[data-activate]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        store.set('activeBotId', btn.dataset.activate);
        try { localStorage.setItem('activeBotId', btn.dataset.activate); } catch {}
        toast('Бот активирован', 'success');
        await this.render(container);
      });
    });

    container.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Удалить этого бота? Он будет остановлен.')) return;
        try {
          await api.del(`/api/bots/${btn.dataset.delete}`);
          toast('Бот удалён', 'success');
          await this.render(container);
        } catch (err) {
          toast('Ошибка: ' + (err.data?.error || err.message), 'error');
        }
      });
    });

    container.querySelector('[data-add-bot]').addEventListener('click', async () => {
      const bot = await openAddBotModal();
      if (bot) await this.render(container);
    });
  },

  _card(b, activeId) {
    const avatarUrl = b.avatarUrl || userAvatarUrl(b.id, null);
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" alt="">`
      : escapeHtml(initials(b.name));
    const isActive = b.id === activeId;

    return `
      <div class="bot-card ${isActive ? 'active' : ''}">
        <div class="bot-card-head">
          <div class="bot-avatar">${avatarHtml}</div>
          <div class="bot-info">
            <div class="bot-name">
              ${escapeHtml(b.name)}
              ${b.isMain ? '<span class="badge-main">MAIN</span>' : ''}
            </div>
            <div class="bot-meta">ID: ${escapeHtml(b.id)}</div>
          </div>
        </div>
        <div class="bot-actions">
          ${isActive
            ? `<span class="badge online">Активен</span>`
            : `<button class="btn btn-ghost btn-sm" data-activate="${b.id}">
                 <i class="fa-solid fa-play"></i> Активировать
               </button>`}
          ${!b.isMain
            ? `<button class="btn btn-ghost btn-sm" data-delete="${b.id}"
                       style="margin-left:auto;color:var(--red);">
                 <i class="fa-solid fa-trash"></i>
               </button>`
            : ''}
        </div>
      </div>
    `;
  },
};