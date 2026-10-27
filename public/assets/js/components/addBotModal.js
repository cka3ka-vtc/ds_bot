// public/assets/js/components/addBotModal.js
import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { toast } from '../core/toast.js';
import { openModal } from '../core/modal.js';

/**
 * Общая модалка добавления пользовательского бота.
 * По успеху кладёт бота в store и localStorage, возвращает созданного бота.
 */
export function openAddBotModal() {
  return openModal({
    title: 'Добавить своего бота',
    subtitle: 'Укажите токен — он будет зашифрован и сохранён',
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
        throw new Error('no_token');
      }
      const btn = modal.querySelector('[data-cta]');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Проверка...';
      try {
        const bot = await api.post('/api/bots', { token });
        const bots = await api.get('/api/bots');
        store.set('bots', bots);
        store.set('activeBotId', bot.id);
        try { localStorage.setItem('activeBotId', bot.id); } catch {}
        toast('Бот добавлен', 'success');
        return bot;
      } catch (err) {
        toast('Не удалось добавить: ' + (err.data?.error || err.message), 'error');
        btn.disabled = false;
        btn.textContent = 'Добавить';
        throw err;
      }
    },
  });
}