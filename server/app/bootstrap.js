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

export async function bootstrap() {
  const db = initDb(config.DATABASE_PATH, logger);
  const botManager = new BotManager({ db, logger, eventBus });
  const registry = new ModuleRegistry({ db, logger, eventBus, botManager });

  await botManager.restoreAll();
  await ensureMainBot({ db, botManager, logger });
  await syncGuildsOnStartup({ db, botManager, logger });

  await registry.load();
  await syncAllGuildCommands({ db, botManager, logger });

  registerAllEvents({ db, botManager, registry, logger });

  const app = createApp({ db, botManager, registry, logger });
  const server = app.listen(config.PORT, () => {
    logger.info(`🚀 API на http://localhost:${config.PORT}`);
  });

  const stop = async () => {
    logger.info('shutting down...');
    server.close();
    await botManager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  return { db, botManager, registry, server };
}