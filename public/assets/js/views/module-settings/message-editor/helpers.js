// public/assets/js/views/module-settings/message-editor/helpers.js
import { UI } from '/shared/ui-strings.js';

export const LIMITS = UI.msgEditor.limits;
export const TYPE_LABELS = UI.msgEditor.types;
export const TIME_FORMAT_CODES = Object.entries(UI.msgEditor.timeFormats);
export const CATEGORY_LABELS = UI.msgEditor.categories;

export function uid() {
  return 'b_' + Math.random().toString(36).slice(2, 10);
}

export function debounce(fn, ms = 200) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/**
 * Форматирует дату по коду Discord: t/T/d/D/f/F/R.
 * Для R учитывает прошлое/будущее — «через N ч» / «N ч назад».
 */
export function formatDateByCode(date, code) {
  const map = {
    t: { hour: '2-digit', minute: '2-digit' },
    T: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
    d: { day: '2-digit', month: '2-digit', year: 'numeric' },
    D: { day: '2-digit', month: 'long', year: 'numeric' },
    f: { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    F: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  };

  if (code === 'R') {
    const diff = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(diff);
    const future = diff > 0;

    if (abs < 60) return future ? 'через мгновение' : 'только что';
    if (abs < 3600) {
      const n = Math.round(abs / 60);
      return future ? `через ${n} мин` : `${n} мин назад`;
    }
    if (abs < 86400) {
      const n = Math.round(abs / 3600);
      return future ? `через ${n} ч` : `${n} ч назад`;
    }
    const n = Math.round(abs / 86400);
    return future ? `через ${n} дн` : `${n} дн назад`;
  }

  try { return date.toLocaleString('ru-RU', map[code] || map.f); }
  catch { return date.toISOString(); }
}

export function emptyMessageConfig() {
  return { displayMode: 'embed-color', accentColor: '#5865F2', title: '', subtitle: '', thumbnail: '', blocks: [] };
}