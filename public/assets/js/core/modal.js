let activeModal = null;

/**
 * Открывает модал. Возвращает Promise, который резолвится
 * результатом onClickCTA (если передан) или null при закрытии.
 */
export function openModal({ title, subtitle, body, ctaLabel = 'Сохранить', onOpen, onSubmit }) {
  return new Promise((resolve) => {
    closeModal();  // закрыть предыдущий

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

    modal.querySelector('h3').textContent = title || '';
    modal.querySelector('p').textContent = subtitle || '';
    modal.querySelector('.modal-body').innerHTML = body || '';

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