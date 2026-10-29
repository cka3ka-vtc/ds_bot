// server/index.js
import 'dotenv/config';
import { bootstrap } from './app/bootstrap.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[unhandledRejection]', reason);
  console.error('promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('\n[uncaughtException] — фатальная ошибка:', err);
  process.exit(1);
});

bootstrap().catch((err) => {
  console.error('\n[FATAL] Не удалось запустить приложение:');
  console.error(err);
  process.exit(1);
});