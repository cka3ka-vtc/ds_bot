/**
 * Интерактивный тур по mockup в hero.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const STEPS = [
  { sel: '#tourMockup', title: 'Пример интерфейса', text: 'Это упрощённый вид — реальная панель немного другая.' },
  { sel: '#tourSidebar', title: 'Пять разделов', text: 'Обзор, модули, модерация, команды и настройки.' },
  { sel: '#tourStats', title: 'Ключевые метрики', text: 'Участники, активность и аптайм — обновляются в реальном времени.' },
  { sel: '#tourSidebar .side-item[data-view="modules"]', title: 'Управление модулями', text: '9 модулей: приветствия, уровни, тикеты, сообщения и другие.' },
];

export function initTour() {
  const overlay = document.getElementById('tourOverlay');
  const spot = document.getElementById('tourSpotlight');
  const tip = document.getElementById('tourTooltip');
  const label = document.getElementById('tourStepLabel');
  const title = document.getElementById('tourTitle');
  const text = document.getElementById('tourText');
  const prevBtn = document.getElementById('tourPrev');
  const nextBtn = document.getElementById('tourNext');
  const skipBtn = document.getElementById('tourSkip');
  const startBtn = document.getElementById('tourStartBtn');

  if (!overlay || !startBtn) return;

  let idx = 0;
  let active = false;

  const mobile = () => window.matchMedia('(max-width: 700px)').matches;

  function position(rect) {
    const pad = 8;
    spot.style.top = rect.top - pad + 'px';
    spot.style.left = rect.left - pad + 'px';
    spot.style.width = rect.width + pad * 2 + 'px';
    spot.style.height = rect.height + pad * 2 + 'px';

    if (mobile()) {
      tip.style.top = '';
      tip.style.left = '';
      tip.style.right = '16px';
      tip.style.bottom = '16px';
      tip.style.width = '';
      return;
    }
    tip.style.bottom = '';
    tip.style.right = '';
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(340, vw - 32);
    tip.style.width = w + 'px';
    const th = tip.offsetHeight || 200;
    const gap = 16;
    let left = rect.right + gap;
    let top = rect.top;
    if (left + w > vw - 8) left = rect.left - w - gap;
    if (left < 8) { left = Math.max(8, (vw - w) / 2); top = rect.bottom + gap; }
    if (top + th > vh - 8) top = Math.max(8, rect.top - th - gap);
    if (top < 8) top = 8;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function show() {
    const step = STEPS[idx];
    const target = document.querySelector(step.sel);
    if (!target) return next();

    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => {
      if (!active) return;
      position(target.getBoundingClientRect());
      label.textContent = (idx + 1) + ' / ' + STEPS.length;
      title.textContent = step.title;
      text.textContent = step.text;
      prevBtn.disabled = idx === 0;
      nextBtn.textContent = idx === STEPS.length - 1 ? 'Понятно' : 'Далее';
    }, reducedMotion ? 0 : 380);
  }

  function start() {
    if (active) return;
    active = true;
    idx = 0;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    show();
  }
  function next() {
    if (idx >= STEPS.length - 1) return end();
    idx++;
    show();
  }
  function prev() {
    if (idx <= 0) return;
    idx--;
    show();
  }
  function end() {
    active = false;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
  }

  nextBtn.addEventListener('click', next);
  prevBtn.addEventListener('click', prev);
  skipBtn.addEventListener('click', end);
  overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target === spot) end(); });

  document.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') end();
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  });

  window.addEventListener('resize', () => {
    if (!active) return;
    const t = document.querySelector(STEPS[idx].sel);
    if (t) position(t.getBoundingClientRect());
  });

  startBtn.addEventListener('click', start);
}