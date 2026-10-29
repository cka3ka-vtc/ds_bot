// server/index.js
import 'dotenv/config';
import { bootstrap } from './app/bootstrap.js';

bootstrap().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});