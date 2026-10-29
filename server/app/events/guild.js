// server/app/events/guild.js
import { syncGuildCommands, ensureBuiltinCommands } from '../../core/commandSync.js';

export async function onGuildCreate({ db, botManager, logger, payload }) {
  const { client, guild } = payload;
  if (!guild) return;

  db.upsertGuild({
    id: guild.id,
    bot_id: client.user.id,
    name: guild.name,
    icon: guild.icon,
    owner_id: guild.ownerId,
    member_count: guild.memberCount,
    discord_created_at: guild.createdTimestamp
      ? Math.floor(guild.createdTimestamp / 1000)
      : null,
    online_count: guild.approximatePresenceCount ?? null,
  });
  logger.info({ botId: client.user.id, guildId: guild.id }, 'guild added');

  try {
    await syncGuildCommands({ db, botManager, logger }, client.user.id, guild.id);
    await ensureBuiltinCommands(guild, logger, client);
  } catch (err) {
    logger.warn({ err, guildId: guild.id }, 'failed to sync commands on guildCreate');
  }
}

export function onGuildDelete({ db, logger, payload }) {
  const { client, guild } = payload;
  if (!guild) return;
  db.deleteGuild(client.user.id, guild.id);
  logger.info({ botId: client.user.id, guildId: guild.id }, 'guild removed');
}