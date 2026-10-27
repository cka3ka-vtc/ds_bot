/**
 * Убирает skeleton-прелоадер после загрузки страницы.
 * Минимальная задержка 250мс — чтобы не мигало.
 */

export function initSkeleton() {
  const start = Date.now();
  const run = () => {
    const wait = Math.max(0, 250 - (Date.now() - start));
    setTimeout(() => {
      const sk = document.getElementById('skeletonOverlay');
      if (sk) sk.classList.add('is-hidden');
      document.body.classList.remove('skeleton-active');
      setTimeout(() => sk?.parentNode && sk.remove(), 400);
    }, wait);
  };
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}