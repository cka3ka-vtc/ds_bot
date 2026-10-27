// server/core/commandSync.js

/**
 * Утилита для синхронизации кастомных команд из БД с Discord.
 * Регистрирует per-guild slash-команды — изменения видны мгновенно.
 */

function sanitizeCommandName(name) {
  // Discord: ^[-_\p{L}\p{N}]{1,32}$
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 32);
}

export async function syncGuildCommands({ db, botManager, logger }, botId, guildId) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return;

  const guild = inst.client.guilds.cache.get(guildId);
  if (!guild) return;

  const customs = db
    .getCustomCommands(botId, guildId)
    .filter((c) => c.enabled === 1 && c.type === 'custom');

  const payload = customs
    .map((c) => ({
      name: sanitizeCommandName(c.name),
      description: (c.description || 'Пользовательская команда').slice(0, 100),
    }))
    .filter((c) => c.name.length >= 1);

  try {
    await guild.commands.set(payload);
    logger.info(
      { botId, guildId, count: payload.length },
      'slash commands synced',
    );
  } catch (err) {
    logger.warn({ err, botId, guildId }, 'slash command sync failed');
  }
}

export async function syncAllGuildCommands({ db, botManager, logger }) {
  for (const inst of botManager.all()) {
    if (!inst.client?.isReady()) continue;
    for (const guild of inst.client.guilds.cache.values()) {
      await syncGuildCommands({ db, botManager, logger }, inst.id, guild.id);
    }
  }
}

export { sanitizeCommandName };