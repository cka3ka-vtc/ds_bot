// server/app/startup.js
//
// Применяется один раз при старте bootstrap:
//   1) если main-бота нет в БД — создать из .env
//   2) синхронизировать список гильдий из Discord в main-БД
//
// КРИТИЧЕСКИЙ ФИКС: ensureBuiltinCommands удалён из syncGuildsOnStartup —
// он затирал кастомные команды, а следом syncAllGuildCommands (в bootstrap)
// всё равно выполнял полный sync через guild.commands.set(builtin+custom).
// Порядок: syncGuildsOnStartup → registry.load → syncAllGuildCommands.

import { config } from '../config.js';
import { encrypt } from '../core/crypto.js';
import { eventBus } from '../core/eventBus.js';
import { runWithConcurrency } from '../core/concurrency.js';

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
          discord_created_at: guild.createdTimestamp
            ? Math.floor(guild.createdTimestamp / 1000)
            : null,
          online_count: guild.approximatePresenceCount ?? null,
        });
      } catch (err) {
        logger.warn({ err, guildId: guild.id }, 'upsertGuild failed');
      }
    });

    logger.info({ botId: inst.id, guilds: guildsList.length }, 'guilds synced on startup');
  }
}