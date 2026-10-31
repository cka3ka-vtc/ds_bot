// public/assets/js/core/modal.js
let activeModal = null;
let previousFocus = null;

function getFocusable(container) {
  return Array.from(
    container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function focusFirst(container) {
  const focusable = getFocusable(container);
  if (focusable.length) {
    try { focusable[0].focus({ preventScroll: true }); } catch {}
    return true;
  }
  return false;
}

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

    previousFocus = document.activeElement;

    const root = document.getElementById('modalRoot');
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-header">
          <div>
            <h3 id="modalTitle"></h3>
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
      document.removeEventListener('keydown', onKey);
      if (previousFocus && previousFocus.focus) {
        try { previousFocus.focus({ preventScroll: true }); } catch {}
      }
      previousFocus = null;
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
      } catch {
        // ошибку покажет вызывающий через toast
      }
    });

    const onKey = (e) => {
      if (activeModal !== modal) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusable(contentEl);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);

    // Первичный фокус — сразу после добавления в DOM.
    requestAnimationFrame(() => focusFirst(contentEl));

    // Если onOpen асинхронный (загружает данные) — после него фокус
    // проставится повторно (в модалках типа openMemberDetail до этого
    // в body был спиннер, и фокус ушёл на кнопку закрытия).
    if (onOpen) {
      Promise.resolve()
        .then(() => onOpen(modal))
        .then(() => {
          if (activeModal === modal) {
            requestAnimationFrame(() => focusFirst(contentEl));
          }
        })
        .catch(() => {});
    }
  });
}

export function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}