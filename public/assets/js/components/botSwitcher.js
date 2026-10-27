import { store } from '../core/store.js';
import { openModal } from '../core/modal.js';
import { api } from '../core/api.js';
import { toast } from '../core/toast.js';

function initials(name = '') {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'B';
}

export function renderBotSwitcher(container) {
  const bots = store.get('bots');
  const activeBot = bots.find(b => b.id === store.get('activeBotId')) || bots[0];

  container.innerHTML = `
    <button class="switcher-btn" data-bot-switcher type="button">
      <span class="switcher-avatar">
        ${activeBot?.avatarUrl
          ? `<img src="${activeBot.avatarUrl}" alt="">`
          : initials(activeBot?.name)}
      </span>
      <span class="switcher-info">
        <span class="switcher-name">
          ${activeBot?.name || 'Нет ботов'}
          ${activeBot?.isMain ? '<span class="badge-main">MAIN</span>' : ''}
        </span>
        <span class="switcher-meta">
          <i class="fa-solid fa-robot"></i> Бот
        </span>
      </span>
      <i class="fa-solid fa-chevron-down"></i>
    </button>
  `;

  container.querySelector('[data-bot-switcher]').addEventListener('click', openBotPicker);
}

function openBotPicker() {
  const bots = store.get('bots');
  const activeId = store.get('activeBotId');

  const list = bots.map(b => `
    <button class="switcher-btn" data-pick="${b.id}" type="button"
            style="margin-bottom:6px;${b.id === activeId ? 'border-color:var(--accent);background:var(--accent-soft);' : ''}">
      <span class="switcher-avatar">
        ${b.avatarUrl ? `<img src="${b.avatarUrl}" alt="">` : initials(b.name)}
      </span>
      <span class="switcher-info">
        <span class="switcher-name">
          ${b.name} ${b.isMain ? '<span class="badge-main">MAIN</span>' : ''}
        </span>
        <span class="switcher-meta"><i class="fa-solid fa-robot"></i> ${b.isMain ? 'Главный бот' : 'Мой бот'}</span>
      </span>
    </button>
  `).join('');

  openModal({
    title: 'Выбор бота',
    subtitle: 'Переключение между главным и вашими ботами',
    body: `${list}
      <hr style="border:none;border-top:1px solid var(--border);margin:16px 0;">
      <button class="btn btn-ghost" style="width:100%;" data-add-bot>
        <i class="fa-solid fa-plus"></i> Добавить своего бота
      </button>`,
    ctaLabel: 'Закрыть',
    onOpen: (modal) => {
      modal.querySelectorAll('[data-pick]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.pick;
          if (id !== activeId) switchBot(id);
          modal.remove();
        });
      });
      modal.querySelector('[data-add-bot]').addEventListener('click', () => {
        modal.remove();
        openAddBotModal();
      });
    },
  });
}

async function switchBot(botId) {
  store.set('activeBotId', botId);
  try { localStorage.setItem('activeBotId', botId); } catch {}
  // Guilds обновятся через подписку в app.js
  toast('Бот переключён', 'info');
}

function openAddBotModal() {
  openModal({
    title: 'Добавить своего бота',
    subtitle: 'Укажите токен — он будет зашифрован и сохранён',
    body: `
      <div class="form-field" style="margin-bottom:12px;">
        <label>Токен бота</label>
        <input type="password" id="newBotToken" placeholder="MTIz...">
        <span class="hint">Получить токен: discord.com/developers → ваше приложение → Bot → Reset Token</span>
      </div>
    `,
    ctaLabel: 'Добавить',
    onSubmit: async (modal) => {
      const token = modal.querySelector('#newBotToken').value.trim();
      if (!token) { toast('Введите токен', 'warn'); throw new Error('no_token'); }
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
      } catch (err) {
        toast('Не удалось добавить бота: ' + (err.data?.error || err.message), 'error');
        btn.disabled = false;
        btn.textContent = 'Добавить';
        throw err;
      }
    },
  });
}