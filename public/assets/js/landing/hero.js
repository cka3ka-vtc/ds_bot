// public/assets/js/landing/hero.js
/**
 * Hero-блок лендинга: реальная статистика + интерактивный mockup.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fmtNum(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6) {
    const v = n / 1000;
    return (v < 10 ? v.toFixed(1) : Math.round(v)).toString().replace('.', ',') + 'к';
  }
  const v = n / 1e6;
  return (v < 10 ? v.toFixed(1) : Math.round(v)).toString().replace('.', ',') + 'м';
}

export function initHero() {
  initLiveStatus();
  initMockupTabs();
  initMockupChart();
}

async function initLiveStatus() {
  const box = document.getElementById('liveStatus');
  if (!box) return;

  const serversEl = box.querySelector('[data-live="servers"]');
  const uptimeEl = box.querySelector('[data-live="uptime"]');
  const latencyEl = box.querySelector('[data-live="latency"]');

  const update = async () => {
    try {
      const res = await fetch('/api/public/stats');
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (serversEl) serversEl.textContent = fmtNum(data.servers);
      if (uptimeEl) uptimeEl.textContent = `${data.uptime}%`;
      if (latencyEl) latencyEl.textContent = `${data.latency} ms`;
      box.classList.add('loaded');
    } catch {
      // fallback — показываем «—»
      if (serversEl) serversEl.textContent = '—';
      if (uptimeEl) uptimeEl.textContent = '—';
      if (latencyEl) latencyEl.textContent = '—';
      box.classList.add('loaded');
    }
  };

  await update();
  setInterval(update, 30_000);
}

function initMockupTabs() {
  const sidebar = document.getElementById('tourSidebar');
  if (!sidebar) return;

  const items = sidebar.querySelectorAll('.side-item');
  const panels = document.querySelectorAll('.mockup-main .panel-view');

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      items.forEach((i) => {
        const active = i === item;
        i.classList.toggle('active', active);
        i.setAttribute('aria-selected', String(active));
      });
      panels.forEach((p) => {
        p.classList.toggle('active', p.dataset.panel === view);
      });
      if (view === 'overview') animateChart();
    });
  });
}

function initMockupChart() {
  const chart = document.querySelector('.chart-bars');
  if (!chart) return;

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animateChart(); obs.disconnect(); }
      });
    }, { threshold: 0.3 });
    obs.observe(chart);
  } else {
    animateChart();
  }
}

function animateChart() {
  const bars = document.querySelectorAll('.chart-bars span');
  bars.forEach((bar, i) => {
    const target = bar.dataset.height || '50%';
    bar.style.height = '0%';
    if (reducedMotion) { bar.style.height = target; return; }
    setTimeout(() => { bar.style.height = target; }, 40 + i * 30);
  });
}

export { animateChart };