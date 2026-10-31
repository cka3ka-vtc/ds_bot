// server/app/events/guild.js
import { syncGuildCommands, ensureBuiltinCommands } from '../../core/commandSync.js';
import { clearGuild as clearVoiceGuild } from '../../core/voiceTracker.js';

export async function onGuildCreate({ db, botManager, logger, payload }) {
  const { client, guild } = payload;
  if (!guild) return;

  let enriched = guild;
  try {
    enriched = await client.guilds.fetch({
      guild: guild.id, withCounts: true, force: true,
    });
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, 'guildCreate: withCounts fetch failed');
  }

  db.upsertGuild({
    id: enriched.id,
    bot_id: client.user.id,
    name: enriched.name,
    icon: enriched.icon,
    owner_id: enriched.ownerId,
    member_count: enriched.memberCount,
    discord_created_at: enriched.createdTimestamp
      ? Math.floor(enriched.createdTimestamp / 1000)
      : null,
    online_count: enriched.approximatePresenceCount ?? null,
  });

  logger.info(
    {
      botId: client.user.id,
      guildId: guild.id,
      memberCount: enriched.memberCount ?? null,
      online: enriched.approximatePresenceCount ?? null,
    },
    'guild added',
  );

  try {
    await syncGuildCommands({ db, botManager, logger }, client.user.id, guild.id);
    await ensureBuiltinCommands(guild, logger, client);
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, 'failed to sync commands on guildCreate');
  }
}

export function onGuildDelete({ db, registry, logger, payload }) {
  const { client, guild } = payload;
  if (!guild) return;

  const botId = client.user.id;

  // 1) Удаляем запись из MAIN (guilds.bot_id).
  db.deleteGuild(botId, guild.id);

  // 2) Удаляем per-guild SQLite-файл.
  try {
    const ok = db.guildManager.delete(botId, guild.id);
    if (!ok) {
      logger.warn({ botId, guildId: guild.id }, 'guild-db: delete returned false');
    }
  } catch (err) {
    logger.warn({ err, botId, guildId: guild.id }, 'guild-db: delete failed');
  }

  // 3) Чистим cooldown-карты модуля «Уровни».
  try {
    const levels = registry?.get?.('levels');
    levels?.clearGuildCooldowns?.(guild.id);
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, 'levels: clearGuildCooldowns failed');
  }

  // 4) Чистим голосовые сессии.
  try {
    clearVoiceGuild(botId, guild.id);
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, 'voiceTracker: clearGuild failed');
  }

  logger.info({ botId, guildId: guild.id }, 'guild removed + data purged');
}