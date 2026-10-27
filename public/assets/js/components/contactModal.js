// public/assets/js/components/contactModal.js
import { openModal } from '../core/modal.js';

export function openContactModal({ title = 'Связаться с нами', subtitle = 'Отвечаем в течение 24 часов' } = {}) {
  return openModal({
    title,
    subtitle,
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
}