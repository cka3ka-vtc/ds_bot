// public/assets/js/landing/modals.js
import { openContactModal } from '../components/contactModal.js';

export function initModals() {
  const triggers = document.querySelectorAll('[data-contacts], [data-open-contacts]');
  triggers.forEach((btn) => {
    btn.addEventListener('click', () => {
      openContactModal({ title: 'Связаться с нами', subtitle: 'Отвечаем в течение 24 часов' });
    });
  });
}