// server/app/startup.js
import { config } from '../config.js';
import { encrypt } from '../core/crypto.js';
import { eventBus } from '../core/eventBus.js';
import { ensureBuiltinCommands } from '../core/commandSync.js';

export async function ensureMainBot({ db, botManager, logger }) {
  const existing = db.getMainBot();
  if (existing) {
    if (!botManager.get(existing.id)) {
      logger.warn(
        { botId: existing.id },
        'main bot exists in DB but not running — check DISCORD_MAIN_BOT_TOKEN in .env',
      );
    }
    return;
  }

  logger.info('first start — creating main bot from .env');
  const { BotInstance } = await import('../bots/instance.js');
  const instance = new BotInstance({
    token: config.DISCORD_MAIN_BOT_TOKEN,
    isMain: true,
    logger,
    eventBus,
  });

  try {
    await instance.start();
  } catch (err) {
    // Не роняем процесс: бот может быть недоступен, но панель должна работать
    logger.error(
      { err: err?.message || err },
      'failed to start main bot — check DISCORD_MAIN_BOT_TOKEN; web panel continues',
    );
    return;
  }

  try {
    db.createBot({
      id: instance.id,
      owner_id: null,
      name: instance.name,
      avatar_url: instance.avatarUrl,
      token_encrypted: encrypt(config.DISCORD_MAIN_BOT_TOKEN),
      is_main: 1,
    });
  } catch (err) {
    logger.error({ err }, 'failed to save main bot to DB — continuing');
    return;
  }

  botManager.bots.set(instance.id, instance);
}

async function runWithConcurrency(items, limit, fn) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { results[idx] = await fn(items[idx]); }
      catch (err) { results[idx] = { error: err }; }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function syncGuildsOnStartup({ db, botManager, logger }) {
  for (const inst of botManager.all()) {
    if (!inst.client) continue;

    let guildsList;
    try {
      const fetched = await inst.client.guilds.fetch({
        withCounts: true, force: true, cache: true,
      });
      guildsList = [...fetched.values()];
    } catch (err) {
      logger.warn({ err, botId: inst.id }, 'failed to sync guilds with counts, using cache');
      guildsList = [...inst.client.guilds.cache.values()];
    }

    await runWithConcurrency(guildsList, 10, async (guild) => {
      try {
        db.upsertGuild({
          id: guild.id, bot_id: inst.id, name: guild.name, icon: guild.icon,
          owner_id: guild.ownerId, member_count: guild.memberCount,
          discord_created_at: guild.createdTimestamp ? Math.floor(guild.createdTimestamp / 1000) : null,
          online_count: guild.approximatePresenceCount ?? null,
        });
      } catch (err) {
        logger.warn({ err, guildId: guild.id }, 'upsertGuild failed');
      }
    });

    await runWithConcurrency(guildsList, 5, async (guild) => {
      try {
        await ensureBuiltinCommands(guild, logger, inst.client);
      } catch (err) {
        logger.warn({ err, guildId: guild.id, botId: inst.id }, 'builtin commands failed');
      }
    });

    logger.info({ botId: inst.id, guilds: guildsList.length }, 'guilds synced on startup');
  }
}