/* ============================================================
   Модалка истории версий (бэкапы).

   Показывает список ежедневных бэкапов раздела и позволяет
   восстановить любую версию.
   ============================================================ */

import { api } from './api.js';
import { state } from './state.js';
import { modal, confirmDialog, toast } from './ui.js';
import { escapeHtml } from './utils.js';

const SECTIONS = ['rules', 'messages', 'announcements', 'delayed', 'autodelete', 'birthdays', 'profiles'];

/**
 * Открывает модалку с бэкапами раздела.
 * @param {string} section
 */
export async function openBackupsModal(section) {
  if (!SECTIONS.includes(section)) return;

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-close>Закрыть</button>`;

  const m = modal({
    title: `История версий — ${section}`,
    body: '<div data-list style="padding:8px 0;"><div class="empty-state"><span>Загрузка…</span></div></div>',
    footer
  });

  footer.querySelector('[data-close]').addEventListener('click', () => m.close());

  const listEl = m.bodyEl.querySelector('[data-list]');

  try {
    const items = await api.backups(state.guildId, section);

    if (!items?.length) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:32px 20px;">
          <p>Пока нет резервных копий</p>
          <span>Бэкап создаётся автоматически при сохранении раздела</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = items.map(b => `
      <div class="list-card" style="margin-bottom:8px;">
        <div class="list-card-head">
          <div class="list-card-icon">
            <i class="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div class="list-card-title-block">
            <div class="list-card-title">${escapeHtml(b.date)}</div>
            <div class="list-card-sub">${new Date(b.timestamp).toLocaleString('ru-RU')}</div>
          </div>
          <div class="list-card-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-restore="${escapeHtml(b.filename)}">
              Восстановить
            </button>
          </div>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-restore]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Восстановить версию?',
          text: 'Текущее состояние раздела будет перезаписано. Продолжить?',
          actionText: 'Восстановить'
        });
        if (!ok) return;

        try {
          await api.restoreBackup(state.guildId, section, btn.dataset.restore);
          toast('Версия восстановлена');
          m.close();
          await reloadSection(section);
        } catch (e) {
          toast('Ошибка: ' + e.message, { type: 'error' });
        }
      });
    });
  } catch (e) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:32px 20px;">
        <p>Ошибка загрузки</p>
        <span>${escapeHtml(e.message)}</span>
      </div>
    `;
  }
}

/**
 * Перезагружает раздел после восстановления бэкапа.
 * @param {string} section
 */
async function reloadSection(section) {
  if (section === 'rules') {
    const { renderRulesView } = await import('./sections/rules.js');
    const fresh = await api.getData(state.guildId, 'rules').catch(() => null);
    if (fresh) { state.rules = fresh; renderRulesView(); }
    return;
  }
  if (section === 'messages') {
    const { renderMessagesList } = await import('./sections/messages.js');
    const fresh = await api.getData(state.guildId, 'messages').catch(() => null);
    if (fresh) { state.messages = fresh.items || []; renderMessagesList(); }
    return;
  }
  if (section === 'announcements') {
    const { renderAnnouncementsList } = await import('./sections/announcements.js');
    const fresh = await api.getData(state.guildId, 'announcements').catch(() => null);
    if (fresh) { state.announcements = fresh.items || []; renderAnnouncementsList(); }
    return;
  }
  if (section === 'delayed') {
    const { renderDelayedList } = await import('./sections/delayed.js');
    const fresh = await api.getData(state.guildId, 'delayed').catch(() => null);
    if (fresh) { state.delayed = fresh.items || []; renderDelayedList(); }
    return;
  }
  if (section === 'autodelete') {
    const { renderAutodeleteList } = await import('./sections/autodelete.js');
    const fresh = await api.getData(state.guildId, 'autodelete').catch(() => null);
    if (fresh) { state.autodelete = fresh.items || []; renderAutodeleteList(); }
    return;
  }
  if (section === 'birthdays' || section === 'profiles') {
    const fresh = await api.getData(state.guildId, section).catch(() => null);
    if (!fresh) return;
    state[section] = fresh;
    if (state.currentSection === 'birthdays') {
      const m = await import('./sections/birthdays.js');
      m.renderBirthdaysView();
    }
    if (state.currentSection === 'profiles') {
      const m = await import('./sections/profiles.js');
      m.renderProfilesView();
    }
  }
}