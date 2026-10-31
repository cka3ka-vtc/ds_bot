// public/assets/js/core/toast.js
let stack = null;

function ensureStack() {
  if (!stack) stack = document.getElementById('toastStack');
  return stack;
}

const ICONS = {
  success: 'fa-circle-check',
  info:    'fa-circle-info',
  warn:    'fa-triangle-exclamation',
  error:   'fa-circle-xmark',
};

/**
 * Тайминги для авто-скрытия. Ошибки и предупреждения живут дольше,
 * чтобы пользователь успел прочитать. success/info — короткие.
 */
const AUTO_HIDE_MS = {
  success: 2400,
  info:    2400,
  warn:    4000,
  error:   5000,
};

export function toast(text, type = 'success') {
  const container = ensureStack();
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('i');
  icon.className = `fa-solid ${ICONS[type] || ICONS.success}`;
  icon.setAttribute('aria-hidden', 'true');

  const msg = document.createElement('span');
  msg.className = 'toast-text';
  msg.textContent = String(text ?? '');

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Закрыть');
  closeBtn.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';

  el.appendChild(icon);
  el.appendChild(msg);
  el.appendChild(closeBtn);

  container.appendChild(el);

  // Плавное исчезновение
  const hide = () => {
    if (!el.parentNode) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  };

  const timer = setTimeout(hide, AUTO_HIDE_MS[type] ?? 2400);
  closeBtn.addEventListener('click', () => {
    clearTimeout(timer);
    hide();
  });
}