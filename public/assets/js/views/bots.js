// public/assets/js/views/bots.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';

export default {
  async render(container) {
    const bots = await api.get('/api/bots');
    store.set('bots', bots);
    const activeId = store.get('activeBotId');

    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>Мои боты</h1>
          <p>Главный бот платформы и ваши собственные боты</p>
        </div>
        <div class="view-actions">
          <a href="/auth/discord/bot-invite" class="btn btn-primary">
            <i class="fa-brands fa-discord"></i> Добавить главного бота на сервер
          </a>
          <button class="btn btn-ghost" data-add-bot>
            <i class="fa-solid fa-plus"></i> Добавить своего бота
          </button>
        </div>
      </div>

      <div class="bots-grid">
        ${bots.map((b) => `
          <div class="bot-card ${b.id === activeId ? 'active' : ''}">
            <div class="bot-card-head">
              <div class="bot-avatar">
                ${b.avatarUrl
                  ? `<img src="${b.avatarUrl}" alt="">`
                  : escapeHtml(b.name?.[0] || 'B')}
              </div>
              <div class="bot-info">
                <div class="bot-name">
                  ${escapeHtml(b.name)}
                  ${b.isMain ? '<span class="badge-main">MAIN</span>' : ''}
                </div>
                <div class="bot-meta">ID: ${b.id}</div>
              </div>
            </div>
            <div class="bot-actions">
              ${b.id !== activeId
                ? `<button class="btn btn-ghost btn-sm" data-activate="${b.id}">
                     <i class="fa-solid fa-play"></i> Использовать
                   </button>`
                : `<span class="badge online">Активен</span>`}
              ${!b.isMain
                ? `<button class="btn btn-ghost btn-sm" data-delete="${b.id}"
                          style="margin-left:auto;color:var(--red);">
                     <i class="fa-solid fa-trash"></i>
                   </button>`
                : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('[data-activate]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.activate;
        store.set('activeBotId', id);
        try {
          localStorage.setItem('activeBotId', id);
        } catch {}
        toast('Бот активирован', 'success');
        await this.render(container);
      });
    });

    container.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.delete;
        if (!confirm('Удалить этого бота? Он будет остановлен.')) return;
        try {
          await api.del(`/api/bots/${id}`);
          toast('Бот удалён', 'success');
          await this.render(container);
        } catch (err) {
          toast('Ошибка: ' + (err.data?.error || err.message), 'error');
        }
      });
    });

    container.querySelector('[data-add-bot]').addEventListener('click', () => this.openAdd(container));
  },

  openAdd(container) {
    openModal({
      title: 'Добавить своего бота',
      subtitle: 'Токен будет зашифрован перед сохранением',
      body: `
        <div class="form-field">
          <label>Токен бота</label>
          <input type="password" id="newBotToken" placeholder="MTIz...">
          <span class="hint">discord.com/developers → Bot → Reset Token</span>
        </div>
      `,
      ctaLabel: 'Добавить',
      onSubmit: async (modal) => {
        const token = modal.querySelector('#newBotToken').value.trim();
        if (!token) {
          toast('Введите токен', 'warn');
          throw new Error();
        }
        try {
          const bot = await api.post('/api/bots', { token });
          store.set('activeBotId', bot.id);
          try {
            localStorage.setItem('activeBotId', bot.id);
          } catch {}
          toast('Бот добавлен', 'success');
          await this.render(container);
        } catch (err) {
          toast('Не удалось добавить: ' + (err.data?.error || err.message), 'error');
          throw err;
        }
      },
    });
  },
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}