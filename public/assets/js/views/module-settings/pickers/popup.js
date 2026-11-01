// public/assets/js/views/module-settings/pickers/popup.js
// Позиционирование и управление жизненным циклом выпадающих попапов.
// Используется channel.js, role.js, emoji.js и внешними пикерами
// (time-dropdown, tokens-dropdown в message-editor).

/**
 * Позиционирует fixed-попап относительно anchor.
 * Автоматически переворачивает вверх, если не хватает места внизу.
 */
export function positionPopup(popup, anchor, minWidth = 220) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  popup.style.position = 'fixed';
  popup.style.zIndex = '5000';
  popup.style.minWidth = Math.max(minWidth, rect.width) + 'px';
  const pw = popup.offsetWidth || minWidth;
  const ph = popup.offsetHeight || 320;
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
  if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 4);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

/**
 * Создаёт попап с контентом, добавляет в body, позиционирует и навешивает
 * закрытие по клику вне / resize / scroll. Возвращает DOM-элемент.
 * При следующем вызове предыдущий .picker-popup удаляется.
 */
export function openPickerPopup(anchor, innerHtml, opts = {}) {
  document.querySelectorAll('.picker-popup').forEach((p) => p.remove());

  const popup = document.createElement('div');
  popup.className = 'picker-popup';
  popup.innerHTML = innerHtml;
  document.body.appendChild(popup);
  positionPopup(popup, anchor, opts.minWidth || 240);

  const cleanup = () => {
    popup.remove();
    document.removeEventListener('mousedown', closeOnOutside);
    window.removeEventListener('resize', cleanup);
    window.removeEventListener('scroll', closeOnScroll, true);
  };
  const closeOnOutside = (e) => {
    if (popup.contains(e.target) || anchor.contains(e.target)) return;
    cleanup();
  };
  const closeOnScroll = (e) => {
    // Скролл внутри попапа не должен его закрывать
    if (e && e.target && popup.contains(e.target)) return;
    cleanup();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('resize', cleanup);
    window.addEventListener('scroll', closeOnScroll, true);
  }, 0);

  return popup;
}