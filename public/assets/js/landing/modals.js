/**
 * Модалки лендинга: контакты.
 */

import { openModal } from '../core/modal.js';

export function initModals() {
  document.querySelectorAll('[data-open-contacts]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal({
        title: 'Свяжитесь с нами',
        subtitle: 'Отвечаем в течение 24 часов',
        body: `
          <div class="contact-list">
            <a href="mailto:hello@botpanel.gg" class="contact-link">
              <i class="fa-solid fa-envelope"></i>
              <div><strong>Email</strong><span>hello@botpanel.gg</span></div>
            </a>
            <a href="https://discord.gg/botpanel" target="_blank" rel="noopener" class="contact-link">
              <i class="fa-brands fa-discord"></i>
              <div><strong>Discord</strong><span>discord.gg/botpanel</span></div>
            </a>
          </div>
        `,
        ctaLabel: 'Закрыть',
      });
    });
  });
}