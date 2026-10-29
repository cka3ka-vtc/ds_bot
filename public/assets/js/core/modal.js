// public/assets/js/core/modal.js
let activeModal = null;

/**
 * Открывает модаль.
 *  - wide: расширенная версия (820px) — для таблиц/списков
 *  - fullscreen: 1300px, 94vh — для тяжёлых редакторов
 *  - если onSubmit не передан — «Отмена» скрывается (информационные модалки)
 */
export function openModal({
  title,
  subtitle,
  body,
  ctaLabel = 'Сохранить',
  onOpen,
  onSubmit,
  wide = false,
  fullscreen = false,
}) {
  return new Promise((resolve) => {
    closeModal();

    const root = document.getElementById('modalRoot');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" role="dialog">
        <div class="modal-header">
          <div>
            <h3></h3>
            <p></p>
          </div>
          <button class="modal-close" type="button" aria-label="Закрыть">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body"></div>
        <div class="form-actions">
          <button class="btn btn-ghost" data-close>Отмена</button>
          <button class="btn btn-primary" data-cta>${ctaLabel}</button>
        </div>
      </div>
    `;

    const contentEl = modal.querySelector('.modal-content');
    if (fullscreen) {
      contentEl.style.maxWidth = '1300px';
      contentEl.style.maxHeight = '94vh';
    } else if (wide) {
      contentEl.style.maxWidth = '820px';
    }

    modal.querySelector('h3').textContent = title || '';
    modal.querySelector('p').textContent = subtitle || '';
    modal.querySelector('.modal-body').innerHTML = body || '';

    if (!onSubmit) {
      const cancelBtn = modal.querySelector('[data-close]');
      if (cancelBtn) cancelBtn.style.display = 'none';
    }

    root.appendChild(modal);
    activeModal = modal;

    const close = (result = null) => {
      modal.remove();
      activeModal = null;
      resolve(result);
    };

    modal.querySelector('.modal-close').addEventListener('click', () => close());
    modal.querySelector('[data-close]').addEventListener('click', () => close());
    modal.querySelector('.modal-backdrop').addEventListener('click', () => close());

    modal.querySelector('[data-cta]').addEventListener('click', async () => {
      if (!onSubmit) return close();
      try {
        const result = await onSubmit(modal);
        close(result);
      } catch (err) {
        // ошибку покажет вызывающий через toast
      }
    });

    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && activeModal === modal) {
        document.removeEventListener('keydown', esc);
        close();
      }
    });

    if (onOpen) onOpen(modal);
  });
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}