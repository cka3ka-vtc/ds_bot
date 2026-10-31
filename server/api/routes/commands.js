// server/api/routes/commands.js
// Тонкий ре-экспорт: сохраняет обратную совместимость для `createApp()`
// (server/api/app.js импортирует { commandsRouter } из этого файла).
// Вся реализация — в ./commands/index.js и соседних файлах.
export { commandsRouter } from './commands/index.js';