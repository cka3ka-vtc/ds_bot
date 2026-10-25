/* ============================================================
   Welcome-баннер на экране выбора сервера.

   Показывается один раз в жизни браузера (localStorage).
   ============================================================ */

const KEY = 'welcome_shown_v1';

/**
 * Показывает баннер, если ещё не показывали.
 * @param {HTMLElement} container - #serverSelect
 */
export function maybeShowWelcome(container) {
  if (!container) return;
  if (localStorage.getItem(KEY) === '1') return;
  if (container.querySelector('.welcome-banner')) return;

  const banner = document.createElement('div');
  banner.className = 'welcome-banner';
  banner.innerHTML = `
    <div class="welcome-banner-icon"><i class="fa-solid fa-hand-wave"></i></div>
    <div class="welcome-banner-body">
      <strong>Добро пожаловать в Ckaзka Dev</strong>
      <span>Управляйте правилами, объявлениями, профилями и днями рождения — всё в одной панели.</span>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" data-dismiss-welcome>Понятно</button>
  `;

  container.insertBefore(banner, container.firstChild);

  banner.querySelector('[data-dismiss-welcome]').addEventListener('click', () => {
    localStorage.setItem(KEY, '1');
    banner.remove();
  });
}