/* ============================================================
   Quick-start модалка при первом заходе в гильдию.

   Показывается один раз на гильдию (localStorage).
   Флаг ставится при любом закрытии (карточка / «Пропустить» /
   крестик / ESC), чтобы не показывать снова.
   ============================================================ */

import { modal } from './ui.js';
import { state } from './state.js';

const KEY = (guildId) => `onboarding_done_${guildId}`;

/**
 * Показывает онбординг, если ещё не показывали.
 * @param {(section: string) => void} switchView
 */
export async function maybeShowOnboarding(switchView) {
  const guildId = state.guildId;
  console.log('[onboarding] check for guild', guildId);

  if (!guildId) {
    console.log('[onboarding] no guild — skip');
    return;
  }

  const container = document.getElementById('modalsContainer');
  if (!container) {
    console.warn('[onboarding] #modalsContainer не найден — пропускаем');
    return;
  }

  if (localStorage.getItem(KEY(guildId)) === '1') {
    console.log('[onboarding] уже показывали — skip');
    return;
  }

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-skip>Пропустить</button>`;

  const body = `
    <p style="color:var(--text-dim);margin-bottom:16px;line-height:1.6;">
      Добро пожаловать! Давайте настроим бота за 3 шага. Выберите, с чего начать — разделы можно открыть и позже.
    </p>
    <div class="choice-grid">
      <button type="button" class="choice-card" data-choice="rules">
        <div class="choice-card-icon"><i class="fa-solid fa-file-lines"></i></div>
        <strong>Правила сервера</strong>
        <span>Создать и отправить правила в канал</span>
      </button>
      <button type="button" class="choice-card" data-choice="profiles">
        <div class="choice-card-icon"><i class="fa-solid fa-user"></i></div>
        <strong>Профили</strong>
        <span>Настроить канал и шаблон профиля</span>
      </button>
      <button type="button" class="choice-card" data-choice="birthdays">
        <div class="choice-card-icon"><i class="fa-solid fa-cake-candles"></i></div>
        <strong>Дни рождения</strong>
        <span>Канал, роль и шаблон поздравления</span>
      </button>
    </div>
  `;

  const m = modal({ title: '👋 Быстрый старт', body, footer });

  const close = (choice) => {
    localStorage.setItem(KEY(guildId), '1');
    m.close();
    if (choice) {
      try { switchView(choice); }
      catch (e) { console.error('[onboarding] switchView failed:', e); }
    }
  };

  /* Клик по карточке */
  m.bodyEl.querySelectorAll('[data-choice]').forEach(btn => {
    btn.addEventListener('click', () => close(btn.dataset.choice));
  });

  /* «Пропустить» */
  footer.querySelector('[data-skip]').addEventListener('click', () => close(null));

  /* Закрытие крестиком / ESC — тоже ставим флаг */
  const origClose = m.close;
  m.close = () => {
    localStorage.setItem(KEY(guildId), '1');
    origClose();
  };

  console.log('[onboarding] модалка показана');
}

/**
 * Сбрасывает флаг онбординга (для кнопки «Пройти заново»).
 * @param {string} guildId
 */
export function resetOnboarding(guildId) {
  localStorage.removeItem(KEY(guildId));
}