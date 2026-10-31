// server/api/routes/modules.js
// Тонкий ре-экспорт: сохраняет обратную совместимость для `createApp()`
// (server/api/app.js импортирует { modulesRouter } из этого файла).
// Вся реализация — в ./modules/index.js и соседних файлах.
export { modulesRouter } from './modules/index.js';