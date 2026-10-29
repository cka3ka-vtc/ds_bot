// shared/titles.js
// Единый источник истины для тематических званий.
// Импортируется и сервером (../../shared/titles.js), и клиентом (/shared/titles.js).

export const DEFAULT_TITLES = [
  { minLevel: 1,   name: 'Незаметный' },
  { minLevel: 5,   name: 'Читатель' },
  { minLevel: 10,  name: 'Тихоня' },
  { minLevel: 20,  name: 'Освоившийся' },
  { minLevel: 30,  name: 'Болтун' },
  { minLevel: 50,  name: 'Главный болтун' },
  { minLevel: 80,  name: 'Душа компании' },
  { minLevel: 100, name: 'Неудержимый' },
];

export function getTitleForLevel(level, titles = DEFAULT_TITLES) {
  if (!Array.isArray(titles) || !titles.length) return '';
  let best = '';
  for (const t of titles) {
    if (Number(t.minLevel) <= level) best = String(t.name || '');
  }
  return best;
}