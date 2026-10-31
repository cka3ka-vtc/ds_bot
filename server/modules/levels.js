// server/modules/levels.js
// Тонкий ре-экспорт: сохраняет обратную совместимость для registry.js,
// который динамически импортирует `server/modules/levels.js` и берёт mod.default.
// Вся реализация — в ./levels/index.js и соседних файлах.
export { default } from './levels/index.js';