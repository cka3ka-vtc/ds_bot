// server/core/commandSync.js
// Синхронизация слэш-команд с Discord через guild.commands.set() (атомарно).

import { BUILTIN_COMMANDS, BUILTIN_NAMES, toDiscordCommand } from '../../shared/builtin-commands.js';

function sanitizeCommandName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 32);
}

function resolveGuildId(guildOrId) {
  if (!guildOrId) return null;
  if (typeof guildOrId === 'string') return guildOrId;
  return guildOrId.id || null;
}

/** Собирает полный желаемый список команд для гильдии: builtin + custom. */
function buildDesiredCommands(db, botId, guildId) {
  const enabledModules = db.getEnabledModules(botId, guildId);
  const enabledSet = new Set(enabledModules);

  const builtins = BUILTIN_COMMANDS
    .filter((c) => enabledSet.has(c.moduleKey))
    .map(toDiscordCommand);

  const customs = db
    .getCustomCommands(botId, guildId)
    .filter((c) => c.enabled === 1 && c.type === 'custom' && !BUILTIN_NAMES.has(c.name))
    .map((c) => ({
      name: sanitizeCommandName(c.name),
      description: (c.description || 'Пользовательская команда').slice(0, 100),
    }))
    .filter((c) => c.name.length >= 2);

  // Дедупликация по имени (custom не может перезаписать builtin)
  const byName = new Map();
  for (const cmd of [...builtins, ...customs]) {
    if (!byName.has(cmd.name)) byName.set(cmd.name, cmd);
  }
  return [...byName.values()];
}

/**
 * Полная синхронизация: set() заменит все команды гильдии на желаемый список.
 * Не трогает другие гильдии.
 */
export async function syncGuildCommands({ db, botManager, logger }, botId, guildId) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return;
  if (!inst.client.application) return;

  const guild = inst.client.guilds.cache.get(guildId);
  if (!guild) return;

  const desired = buildDesiredCommands(db, botId, guildId);

  try {
    await guild.commands.set(desired);
    logger.info({ botId, guildId, count: desired.length }, 'slash commands synced');
  } catch (err) {
    logger.warn({ err, botId, guildId }, 'slash command sync failed');
  }
}

/** Совместимость: раньше вызывали ensureBuiltinCommands(guild, logger, client). */
export async function ensureBuiltinCommands(guildOrId, logger, client) {
  const guildId = resolveGuildId(guildOrId);
  if (!guildId || !client?.application) return;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  try {
    const desired = BUILTIN_COMMANDS.map(toDiscordCommand);
    await guild.commands.set(desired);
    logger?.info({ guildId, count: desired.length }, 'builtin commands ensured');
  } catch (err) {
    logger?.warn({ err, guildId }, 'failed to ensure builtin commands');
  }
}

/** Массовая синхронизация при старте. */
export async function syncAllGuildCommands({ db, botManager, logger }) {
  for (const inst of botManager.all()) {
    if (!inst.client?.isReady()) continue;
    for (const guild of inst.client.guilds.cache.values()) {
      await syncGuildCommands({ db, botManager, logger }, inst.id, guild.id);
    }
  }
}

export { sanitizeCommandName, buildDesiredCommands };