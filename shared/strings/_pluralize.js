// shared/strings/_pluralize.js
// Хелпер для русской плюрализации.
// Используется в UI.words.* и в других местах, где нужно
// склонение существительного по числу.

export function pluralize(n, one, few, many) {
  n = Math.abs(Number(n) || 0);
  const m = n % 10;
  const h = n % 100;
  if (m === 1 && h !== 11) return one;
  if (m >= 2 && m <= 4 && (h < 12 || h > 14)) return few;
  return many;
}

export default pluralize;