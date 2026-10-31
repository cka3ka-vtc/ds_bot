// server/api/routes/auth.js
// Тонкий ре-экспорт: сохраняет обратную совместимость для createApp()
// (server/api/app.js импортирует { authRouter } из этого файла).
// Вся реализация — в ./auth/index.js и соседних файлах.
export { authRouter } from './auth/index.js';