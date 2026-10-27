/**
 * UI-хелперы лендинга:
 *  - мобильное меню
 *  - sticky CTA при прокрутке
 *  - скрытие scroll-hint
 *  - parallax blob-фонов
 */

export function initUI() {
  initMobileMenu();
  initStickyCta();
  initScrollHint();
  initBlobParallax();
}

function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('navLinks');
  if (!toggle || !nav) return;

  const icon = toggle.querySelector('i');

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (icon) {
      icon.classList.toggle('fa-bars', !open);
      icon.classList.toggle('fa-xmark', open);
    }
  };

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!nav.classList.contains('open'));
  });

  nav.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => setOpen(false)),
  );

  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });
}

function initStickyCta() {
  const sticky = document.getElementById('stickyCta');
  const heroCta = document.querySelector('.hero-cta');
  if (!sticky || !heroCta) return;

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const heroBottom = heroCta.getBoundingClientRect().bottom + y;
    const docHeight = document.documentElement.scrollHeight;
    const wh = window.innerHeight;
    if (y > heroBottom && y + wh < docHeight - 120) {
      sticky.classList.remove('hidden');
    } else {
      sticky.classList.add('hidden');
    }
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initScrollHint() {
  const hint = document.getElementById('scrollHint');
  if (!hint) return;
  let hidden = false;
  window.addEventListener('scroll', () => {
    if (hidden) return;
    if (window.scrollY > 80) {
      hint.classList.add('hidden');
      hidden = true;
    }
  }, { passive: true });
}

function initBlobParallax() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      document.body.style.setProperty('--blob-shift', `${window.scrollY * 0.08}px`);
      ticking = false;
    });
  }, { passive: true });
}