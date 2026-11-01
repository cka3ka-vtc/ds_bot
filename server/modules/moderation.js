// server/modules/moderation.js
// Тонкий реэкспорт: сохраняет обратную совместимость для registry.js,
// который динамически импортирует `server/modules/moderation.js` и берёт mod.default.
// Вся реализация — в ./moderation/index.js и соседних файлах.
export { default } from './moderation/index.js';