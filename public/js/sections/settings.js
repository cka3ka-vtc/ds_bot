/* ============================================================
   Настройки:
   - список ботов с переключением и добавлением
   - статус бота (activity) с типом и текстом
   - статистика активного бота
   - перезапуск онбординга и чек-листа
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml, formatNumber } from '../utils.js';
import { toast, confirmDialog, modal } from '../ui.js';

let bots = [];
let stats = null;

/* ============================================================
   Рендер
   ============================================================ */

export async function renderSettingsView() {
  const root = document.getElementById('view-settings');
  if (!root) return;

  root.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-spinner fa-spin"></i>
      <p class="empty-state-text">Загрузка…</p>
    </div>
  `;

  try {
    const data = await api.bots();
    bots = data.bots || [];
    stats = data.stats || {};
    renderInner(root);
  } catch (e) {
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3 class="empty-state-title">Ошибка загрузки</h3>
        <p class="empty-state-text">${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}

function renderInner(root) {
  const active = bots.find(b => b.isActive) || bots[0];
  const activity = active?.activity || { type: 'WATCHING', text: '', url: null };

  root.innerHTML = `
    <div class="section-intro">
      <h2><i class="fa-solid fa-gear"></i> Настройки бота</h2>
      <p>Управление активным ботом, переключение между токенами и статус в Discord.</p>
    </div>

    <div class="settings-grid">
      <!-- ===== Боты ===== -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2><i class="fa-solid fa-robot"></i> Боты</h2>
            <p>Управление токенами и переключение</p>
          </div>
        </div>
        <div class="card-body">
          <div class="bot-list">
            ${bots.map(b => `
              <div class="bot-item ${b.isActive ? 'active' : ''}">
                <div class="bot-item-icon"><i class="fa-solid fa-robot"></i></div>
                <div class="bot-item-info">
                  <strong>${escapeHtml(b.label)}</strong>
                  <span>
                    ${b.isActive
                      ? '<i class="fa-solid fa-circle" style="color:var(--success);"></i> Активен'
                      : 'Не активен'}
                  </span>
                </div>
                ${b.isActive ? '' : `<button class="btn btn-ghost btn-sm" data-switch-bot="${escapeHtml(b.id)}">Переключить</button>`}
                ${!b.isActive && bots.length > 1 ? `<button class="icon-btn danger" data-remove-bot="${escapeHtml(b.id)}" title="Удалить"><i class="fa-solid fa-trash"></i></button>` : ''}
              </div>
            `).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" data-add-bot style="margin-top:12px;">
            <i class="fa-solid fa-plus"></i> Добавить бота
          </button>
        </div>
      </div>

      <!-- ===== Статус ===== -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2><i class="fa-solid fa-signal"></i> Статус в Discord</h2>
            <p>Что видят пользователи</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label>Тип активности</label>
            <select class="input" id="activityType">
              <option value="WATCHING"  ${activity.type === 'WATCHING'  ? 'selected' : ''}>Смотрит</option>
              <option value="PLAYING"   ${activity.type === 'PLAYING'   ? 'selected' : ''}>Играет</option>
              <option value="LISTENING" ${activity.type === 'LISTENING' ? 'selected' : ''}>Слушает</option>
              <option value="COMPETING" ${activity.type === 'COMPETING' ? 'selected' : ''}>Соревнуется в</option>
              <option value="STREAMING" ${activity.type === 'STREAMING' ? 'selected' : ''}>Стримит</option>
            </select>
          </div>
          <div class="form-group">
            <label>Текст</label>
            <input class="input" id="activityText" maxlength="128" value="${escapeHtml(activity.text || '')}" placeholder="за сервером">
            <span class="hint">Например: «за сервером», «музыку», «в игру»</span>
          </div>
          <div class="form-group" id="activityUrlGroup" style="display:${activity.type === 'STREAMING' ? 'block' : 'none'};">
            <label>URL стрима</label>
            <input class="input" id="activityUrl" value="${escapeHtml(activity.url || '')}" placeholder="https://twitch.tv/...">
          </div>
          <button class="btn btn-primary btn-sm" data-save-activity>
            <i class="fa-solid fa-floppy-disk"></i> Применить статус
          </button>
        </div>
      </div>

      <!-- ===== Статистика ===== -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2><i class="fa-solid fa-chart-line"></i> Статистика</h2>
            <p>Активный бот</p>
          </div>
        </div>
        <div class="card-body">
          <div class="settings-stats">
            <div class="settings-stat"><span>Серверов</span><strong>${formatNumber(stats.guilds ?? 0)}</strong></div>
            <div class="settings-stat"><span>Пользователей</span><strong>${formatNumber(stats.users ?? 0)}</strong></div>
            <div class="settings-stat"><span>Пинг</span><strong>${stats.ping >= 0 ? stats.ping + ' мс' : '—'}</strong></div>
            <div class="settings-stat"><span>Память</span><strong>${stats.memoryMB ?? '—'} МБ</strong></div>
            <div class="settings-stat"><span>Uptime</span><strong>${formatUptime(stats.uptimeMs)}</strong></div>
            <div class="settings-stat"><span>Тег</span><strong>${escapeHtml(stats.tag || '—')}</strong></div>
          </div>
        </div>
      </div>

      <!-- ===== Онбординг ===== -->
      <div class="card">
        <div class="card-header">
          <div>
            <h2><i class="fa-solid fa-rotate"></i> Онбординг</h2>
            <p>Показать подсказки заново</p>
          </div>
        </div>
        <div class="card-body">
          <p style="color:var(--text-dim);margin-bottom:12px;font-size:13px;line-height:1.6;">
            Если вы закрыли приветственное окно и хотите посмотреть его снова —
            нажмите кнопку ниже. Сбрасывается только для текущего сервера.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" data-reset-onboarding>
              <i class="fa-solid fa-arrow-rotate-right"></i> Онбординг
            </button>
            <button class="btn btn-ghost btn-sm" data-reset-checklist>
              <i class="fa-solid fa-list-check"></i> Чек-лист
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  bindHandlers(root);
}

/* ============================================================
   Обработчики
   ============================================================ */

function bindHandlers(root) {
  /* Показ URL только для STREAMING */
  const typeSel = root.querySelector('#activityType');
  const urlGroup = root.querySelector('#activityUrlGroup');
  if (typeSel && urlGroup) {
    typeSel.addEventListener('change', () => {
      urlGroup.style.display = typeSel.value === 'STREAMING' ? 'block' : 'none';
    });
  }

  /* Переключение бота */
  root.querySelectorAll('[data-switch-bot]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.switchBot;
      const ok = await confirmDialog({
        title: 'Переключить бота?',
        text: 'Активный бот будет выключен, вместо него запустится другой. Команды и статус применятся к новому.',
        actionText: 'Переключить'
      });
      if (!ok) return;

      try {
        btn.disabled = true;
        await api.switchBot(id);
        toast('Бот переключён');
        await renderSettingsView();
      } catch (e) {
        toast('Ошибка: ' + e.message, { type: 'error' });
        btn.disabled = false;
      }
    });
  });

  /* Удаление бота */
  root.querySelectorAll('[data-remove-bot]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.removeBot;
      const ok = await confirmDialog({
        title: 'Удалить бота?',
        text: `Бот «${id}» будет удалён из config.json.`,
        actionText: 'Удалить'
      });
      if (!ok) return;

      try {
        await api.removeBot(id);
        toast('Бот удалён');
        await renderSettingsView();
      } catch (e) {
        toast('Ошибка: ' + e.message, { type: 'error' });
      }
    });
  });

  /* Добавление бота */
  root.querySelector('[data-add-bot]')?.addEventListener('click', openAddBotModal);

  /* Сохранение статуса */
  root.querySelector('[data-save-activity]')?.addEventListener('click', async () => {
    const type = root.querySelector('#activityType').value;
    const text = root.querySelector('#activityText').value.trim();
    const url = root.querySelector('#activityUrl').value.trim() || null;

    if (!text) return toast('Введите текст статуса', { type: 'error' });
    if (type === 'STREAMING' && !url) return toast('Для стрима нужен URL', { type: 'error' });

    try {
      await api.setActivity({ type, text, url });
      toast('Статус применён');
    } catch (e) {
      toast('Ошибка: ' + e.message, { type: 'error' });
    }
  });

  /* Сброс онбординга */
  root.querySelector('[data-reset-onboarding]')?.addEventListener('click', async () => {
    const { resetOnboarding } = await import('../onboarding.js');
    resetOnboarding(state.guildId);
    toast('Флаг сброшен. Перезайдите в раздел или перезагрузите страницу.');
  });

  /* Сброс чек-листа */
  root.querySelector('[data-reset-checklist]')?.addEventListener('click', async () => {
    const { resetChecklistHidden } = await import('../onboarding-checklist.js');
    resetChecklistHidden(state.guildId);
    toast('Чек-лист снова появится на дашборде.');
  });
}

/* ============================================================
   Модалка добавления бота
   ============================================================ */

function openAddBotModal() {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `
    <button class="btn btn-ghost" data-cancel>Отмена</button>
    <button class="btn btn-primary" data-save>Сохранить</button>
  `;

  const body = `
    <div class="form-group">
      <label>ID (латиница, без пробелов)</label>
      <input class="input" data-bot-id placeholder="main">
    </div>
    <div class="form-group">
      <label>Название</label>
      <input class="input" data-bot-label placeholder="Основной">
    </div>
    <div class="form-group">
      <label>Токен</label>
      <div style="display:flex;gap:6px;">
        <input class="input" data-bot-token placeholder="Discord token" style="flex:1;">
        <button type="button" class="btn btn-ghost btn-sm" data-validate>Проверить</button>
      </div>
      <span class="hint" data-validate-result></span>
    </div>
  `;

  const m = modal({ title: 'Добавить бота', body, footer });

  footer.querySelector('[data-cancel]').addEventListener('click', () => m.close());

  footer.querySelector('[data-validate]').addEventListener('click', async () => {
    const token = m.bodyEl.querySelector('[data-bot-token]').value.trim();
    if (!token) return;

    const result = m.bodyEl.querySelector('[data-validate-result]');
    result.textContent = 'Проверка…';
    result.style.color = '';

    try {
      const r = await api.validateToken(token);
      result.textContent = r.ok ? `✅ Валиден: ${r.tag}` : `❌ ${r.error}`;
      result.style.color = r.ok ? 'var(--success)' : 'var(--danger)';
    } catch (e) {
      result.textContent = '❌ ' + e.message;
      result.style.color = 'var(--danger)';
    }
  });

  footer.querySelector('[data-save]').addEventListener('click', async () => {
    const id = m.bodyEl.querySelector('[data-bot-id]').value.trim();
    const label = m.bodyEl.querySelector('[data-bot-label]').value.trim();
    const token = m.bodyEl.querySelector('[data-bot-token]').value.trim();

    if (!id || !token) return toast('ID и токен обязательны', { type: 'error' });

    try {
      await api.addBot(id, { label: label || id, token });
      m.close();
      toast('Бот добавлен');
      await renderSettingsView();
    } catch (e) {
      toast('Ошибка: ' + e.message, { type: 'error' });
    }
  });
}

/* ============================================================
   Утилита: uptime
   ============================================================ */

function formatUptime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}