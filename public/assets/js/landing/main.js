/**
 * Точка входа лендинга. Импортирует все модули и запускает их.
 */

import { initTheme } from '../core/theme.js';
import { toast } from '../core/toast.js';
import { initSkeleton } from './skeleton.js';
import { initUI } from './ui.js';
import { initHero } from './hero.js';
import { initAction } from './action.js';
import { initTour } from './tour.js';
import { initModals } from './modals.js';

// 1. Скрыть skeleton после загрузки
initSkeleton();

// 2. Тема
initTheme();

// 3. Навигация, sticky CTA, scroll hint, parallax
initUI();

// 4. Hero (live-статус + интерактивный mockup)
initHero();

// 5. Discord simulator ("В действии")
initAction();

// 6. Tour
initTour();

// 7. Модалки (контакты)
initModals();

// 8. Год в футере
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Экспортируем toast для консоли (полезно при отладке)
window.__toast = toast;