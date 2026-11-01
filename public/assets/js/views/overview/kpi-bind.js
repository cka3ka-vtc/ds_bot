// public/assets/js/views/overview/kpi-bind.js
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { UI } from '/shared/ui-strings.js';
import { openJoinedModal, openLeftModal, openActiveModal } from './userModals.js';

/**
 * Кнопка «Обновить» — fetch + полный ре-рендер.
 */
export function bindRefresh(view) {
  const btn = view.container.querySelector('[data-refresh]');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    try {
      view.data = await view._fetch(store.get('activeBotId'), store.get('activeGuildId'));
      view._renderUI();
      toast(UI.common.updated, 'success');
    } catch {}
  });
}

/**
 * Ссылки [data-nav] — переход по хэшу (например, «Все события» → #moderation).
 */
export function bindNavLinks(view) {
  view.container.querySelectorAll('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      location.hash = el.dataset.nav;
    });
  });
}

/**
 * KPI-карточки:
 *   - action = 'joined' | 'left' | 'active' — открывают модалки;
 *   - nav = 'members' — переход на раздел участников.
 *
 * Клик по иконке-подсказке (.kpi-hint) игнорируется.
 * Клавиатура: Enter/Space на карточке = клик.
 */
export function bindKpiCards(view) {
  view.container.querySelectorAll('[data-kpi-action], [data-kpi-nav]').forEach((card) => {
    const action = card.dataset.kpiAction;
    const nav = card.dataset.kpiNav;

    const run = () => {
      if (action === 'joined') openJoinedModal();
      else if (action === 'left') openLeftModal();
      else if (action === 'active') openActiveModal();
      else if (nav) location.hash = nav;
    };

    card.addEventListener('click', (e) => {
      if (e.target.closest('.kpi-hint')) return;
      run();
    });

    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        run();
      }
    });
  });
}