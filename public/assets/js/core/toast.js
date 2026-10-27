let stack = null;

function ensureStack() {
  if (!stack) stack = document.getElementById('toastStack');
  return stack;
}

export function toast(text, type = 'success') {
  const icons = {
    success: 'fa-circle-check',
    info:    'fa-circle-info',
    warn:    'fa-triangle-exclamation',
    error:   'fa-circle-xmark',
  };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${text}</span>`;
  ensureStack().appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, 2400);
}