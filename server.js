import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initClient, getClient, preloadPresences, verifyIntents } from './src/discord/client.js';
import { startScheduler, recoverScheduler, stopScheduler } from './src/discord/scheduler.js';
import { registerInteractionHandlers } from './src/discord/interactions.js';
import { initAutodelete } from './src/discord/autodelete.js';
import { initBirthdayCommands } from './src/discord/birthday-commands.js';
import { initProfileCommands } from './src/discord/profile-commands.js';
import { initMessageTracker } from './src/discord/message-tracker.js';
import registerRoutes from './src/routes/api.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { initCache } from './src/services/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

initClient(config.token);
const client = getClient();

/* Обработчики команд регистрируются первыми (prependListener),
   чтобы гарантированно сработать раньше autodelete. */
initBirthdayCommands(client);
initProfileCommands(client);
registerInteractionHandlers(client);
initAutodelete(client);
initMessageTracker(client);

let readyFired = false;
const onReady = async () => {
  if (readyFired) return;
  readyFired = true;

  console.log('════════════════════════════════════════════');
  console.log(`✅ Бот авторизован: ${client.user.tag}`);
  console.log(`📡 Серверов: ${client.guilds.cache.size}`);

  verifyIntents();

  console.log('👥 Предзагрузка участников и присутствий…');
  await preloadPresences();

  recoverScheduler();
  startScheduler();
  initCache();

  console.log('════════════════════════════════════════════');
};

client.once('clientReady', onReady);
client.once('ready', onReady);
client.on('error', (err) => console.error('[Discord client error]', err.message));
client.on('warn', (msg) => console.warn('[Discord warn]', msg));

registerRoutes(app);
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(errorHandler);

process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Получен ${signal}, завершаем…`);
  try { stopScheduler(); } catch {}
  try { client.destroy(); } catch {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

client.login(config.token)
  .then(() => {
    const PORT = config.port || 3000;
    app.listen(PORT, () => console.log(`🌐 Панель: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Не удалось авторизовать бота:', err.message);
    if (/disallowed intents/i.test(err.message)) {
      console.error('');
      console.error('   Включите привилегированные интенты:');
      console.error('   → Discord Developer Portal → Bot → Privileged Gateway Intents');
      console.error('   → SERVER MEMBERS INTENT     ✓');
      console.error('   → PRESENCE INTENT           ✓');
      console.error('   → MESSAGE CONTENT INTENT    ✓');
    }
    if (/invalid token/i.test(err.message)) {
      console.error('   Проверьте поле "token" в config.json');
    }
    process.exit(1);
  });