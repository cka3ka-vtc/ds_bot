/* ============================================================
   Точка входа приложения.
   Запускает бота, HTTP-сервер и graceful shutdown.
   ============================================================ */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadConfig } from './src/config/index.js';
import { preloadPresences, verifyIntents } from './src/discord/client.js';
import { BotManager } from './src/discord/bot-manager.js';
import { registerCommands } from './src/discord/register-commands.js';
import { registerInteractionHandlers } from './src/discord/interactions/index.js';
import { initLegacyRedirect } from './src/discord/legacy-redirect.js';
import { initAutodelete } from './src/discord/autodelete.js';
import { startScheduler, recoverScheduler, stopScheduler } from './src/discord/scheduler/index.js';
import { initMessageTracker } from './src/services/message-tracker.js';
import { initCache } from './src/services/discord-cache.js';
import { flushAll as flushLogs } from './src/services/guild-logger.js';
import registerRoutes from './src/routes/api.js';
import { errorHandler } from './src/middleware/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = loadConfig();

/* ============================================================
   Express
   ============================================================ */
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   Менеджер ботов.
   Всё, что нужно повесить на конкретный клиент (обработчики
   messageCreate, interactionCreate и т. д.), вешается здесь,
   внутри onReady. Это гарантирует, что при переключении
   бота (botManager.switchTo) на новый клиент подключатся
   ВСЕ обработчики заново.
   ============================================================ */
const botManager = new BotManager({
  onReady: async (client, bot) => {
    console.log('═'.repeat(60));
    console.log(`✅ Бот "${bot.label}" авторизован: ${client.user.tag}`);
    console.log(`📊 Серверов: ${client.guilds.cache.size}`);

    verifyIntents();
    await preloadPresences();

    /* Планировщик + кэш */
    recoverScheduler();
    startScheduler();
    initCache();

    /* Обработчики событий Discord — на каждом старте */
    initAutodelete(client);
    initLegacyRedirect(client);
    initMessageTracker(client);
    registerInteractionHandlers(client);

    /* Slash-команды */
    try {
      await registerCommands(client, client.token);
    } catch (e) {
      console.error('[register-commands] ❌', e.stack || e.message);
      console.error('   Проверьте scope «applications.commands»:');
      console.error('   Discord Developer Portal → OAuth2 → URL Generator → Scopes: bot + applications.commands');
    }

    console.log('═'.repeat(60));
  }
  /* onInteraction не передаём — обработчик вешает registerInteractionHandlers */
});

app.locals.botManager = botManager;
app.locals.registerCommands = registerCommands;

/* ============================================================
   Маршруты
   ============================================================ */
registerRoutes(app);
app.use(errorHandler);

/* ============================================================
   Запуск
   ============================================================ */
let httpServer = null;

async function start() {
  try {
    await botManager.start();

    httpServer = app.listen(config.port || 3000, () => {
      console.log(`🌐 Панель: http://localhost:${config.port || 3000}`);
    });
  } catch (err) {
    console.error('❌ Не удалось авторизовать бота:', err.message);
    if (/disallowed intents/i.test(err.message)) {
      console.error('   Включите интенты: SERVER MEMBERS, PRESENCE, MESSAGE CONTENT');
    }
    if (/invalid token/i.test(err.message)) {
      console.error('   Проверьте токен в config.json');
    }
    process.exit(1);
  }
}

/* ============================================================
   Graceful shutdown
   ============================================================ */
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Получен ${signal}, завершаемся…`);

  try { stopScheduler(); } catch {}
  try { flushLogs(); } catch {}

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
      setTimeout(resolve, 10_000).unref();
    });
  }

  try { await botManager.stop(); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

start();