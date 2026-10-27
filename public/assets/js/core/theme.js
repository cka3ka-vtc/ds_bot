/**
 * Управление темой. Используется и на лендинге, и в панели.
 * Слушает клик на любой [data-theme-toggle].
 */

export function initTheme() {
  applyIcon();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

export function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('theme', t); } catch {}
  applyIcon();
}

function applyIcon() {
  const t = document.documentElement.getAttribute('data-theme') || 'light';
  document.querySelectorAll('[data-theme-toggle] i').forEach((i) => {
    i.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  });
}