// server/app/bootstrap.js
import { config } from '../config.js';
import { logger } from '../core/logger.js';
import { initDb } from '../db/index.js';
import { eventBus } from '../core/eventBus.js';
import { BotManager } from '../bots/manager.js';
import { ModuleRegistry } from '../modules/registry.js';
import { createApp } from '../api/app.js';
import { syncAllGuildCommands } from '../core/commandSync.js';
import { ensureMainBot, syncGuildsOnStartup } from './startup.js';
import { registerAllEvents } from './events/index.js';
import { configCache } from '../core/config-cache.js';

export async function bootstrap() {
  logger.info({
    port: config.PORT,
    host: config.HOST,
    env: config.NODE_ENV,
    db: config.DATABASE_PATH,
    hasMainToken: !!config.DISCORD_MAIN_BOT_TOKEN,
    hasJwt: !!config.JWT_SECRET,
  }, 'boot: starting');

  const db = initDb(config.DATABASE_PATH, logger);
  logger.info({ main: config.DATABASE_PATH, guildsDir: './data/guilds/' }, 'boot: db initialized');

  // Применяем миграции ко всем существующим БД гильдий
  await db.guildManager.applyAllMigrations();

  const botManager = new BotManager({ db, logger, eventBus });
  const registry = new ModuleRegistry({ db, logger, eventBus, botManager });

  registerAllEvents({ db, botManager, registry, logger });
  logger.info('boot: event handlers registered');

  // ═══ Веб-сервер стартует первым ═══
  const app = createApp({ db, botManager, registry, logger });

  const server = await new Promise((resolve, reject) => {
    const srv = app.listen(config.PORT, config.HOST, () => resolve(srv));
    srv.once('error', reject);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal({ port: config.PORT },
        `❌ Порт ${config.PORT} уже занят. Измените PORT в .env или остановите другой процесс.`);
    } else if (err.code === 'EACCES') {
      logger.fatal({ port: config.PORT },
        `❌ Нет прав для прослушивания порта ${config.PORT}. Используйте порт > 1024.`);
    } else {
      logger.fatal({ err }, '❌ Ошибка HTTP-сервера');
    }
    process.exit(1);
  });

  logger.info(`🚀 Панель запущена: http://localhost:${config.PORT} (${config.HOST})`);
  logger.info('   Веб-сервер работает. Боты стартуют в фоне...');

  // ═══ Боты и модули — в фоне ═══
  (async () => {
    try {
      await botManager.restoreAll();
      logger.info({ count: botManager.all().length }, 'bots: restored');
    } catch (err) { logger.error({ err }, 'bots: restoreAll failed — continuing'); }

    try { await ensureMainBot({ db, botManager, logger }); }
    catch (err) { logger.error({ err }, 'bots: ensureMainBot failed — continuing'); }

    try { await syncGuildsOnStartup({ db, botManager, logger }); }
    catch (err) { logger.error({ err }, 'bots: syncGuildsOnStartup failed — continuing'); }

    try {
      await registry.load();
      logger.info({ modules: registry.all().length, missing: registry.missingModules }, 'modules: loaded');
    } catch (err) { logger.error({ err }, 'modules: load failed — continuing'); }

    try { await syncAllGuildCommands({ db, botManager, logger }); }
    catch (err) { logger.error({ err }, 'commands: sync failed — continuing'); }

    logger.info('boot: background initialization complete');
  })();

  // ═══ Фоновые задачи обслуживания ═══
  const timers = [];

  timers.push(setInterval(() => configCache.cleanup(), 5 * 60_000));

  timers.push(setInterval(() => {
    try {
      const ev = db.purgeOldEvents(config.RETENTION_EVENTS_DAYS);
      const lg = db.purgeOldLogs(config.RETENTION_LOGS_DAYS);
      const au = db.purgeOlderThan(config.RETENTION_AUDIT_DAYS);
      if (ev || lg || au) {
        logger.info({ events: ev, logs: lg, audit: au }, 'retention: old data purged');
      }
    } catch (err) {
      logger.warn({ err }, 'retention failed');
    }
  }, 24 * 60 * 60_000));

  // ═══ Graceful shutdown ═══
  let shuttingDown = false;
  const stop = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down...');
    timers.forEach((t) => clearInterval(t));
    server.close();
    try { await registry.unregisterAll(); } catch (err) { logger.warn({ err }, 'registry shutdown failed'); }
    try { await botManager.shutdown(); } catch (err) { logger.warn({ err }, 'botManager shutdown failed'); }
    try { db.guildManager.closeAll(); } catch {}
    try { db.main.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  return { db, botManager, registry, server };
}