// server/modules/birthdays.js
// Тонкий ре-экспорт: сохраняет обратную совместимость для registry.js,
// который динамически импортирует `server/modules/birthdays.js` и берёт mod.default.
// Вся реализация — в ./birthdays/index.js и соседних файлах.
export { default } from './birthdays/index.js';