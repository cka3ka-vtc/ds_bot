// public/assets/js/views/overview/kpi-bind.js
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { UI } from '/shared/ui-strings.js';
import { openJoinedModal, openLeftModal, openActiveModal } from './userModals.js';

/**
 * Кнопка «Обновить». ФИКС: точечное обновление через view._autoRefresh(false)
 * вместо полного _renderUI() — иначе сбрасывались скролл, фокус на кнопке,
 * текущий chart-фильтр и могла закрыться открытая модалка.
 */
export function bindRefresh(view) {
  const btn = view.container.querySelector('[data-refresh]');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!store.get('activeBotId') || !store.get('activeGuildId')) {
      toast(UI.common.selectServer, 'warn');
      return;
    }
    try {
      await view._autoRefresh(false);
    } catch (err) {
      const code = err?.data?.error;
      if (code === 'bot_offline') {
        toast(UI.common.botOffline, 'warn');
      } else {
        toast(UI.common.error, 'error');
      }
    }
  });
}

/** Пункты навигации (карточки/ссылки с [data-nav]) → роутер по хэшу. */
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
 *   - action = 'joined' | 'left' | 'active' — открывают модалку;
 *   - nav = 'members' — переход на раздел участников.
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