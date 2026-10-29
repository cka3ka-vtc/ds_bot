// server/core/commandSync.js
import { BUILTIN_COMMANDS, toDiscordCommand } from '../../shared/builtin-commands.js';

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

export async function ensureBuiltinCommands(guildOrId, logger, client) {
  const guildId = resolveGuildId(guildOrId);
  if (!guildId) return;
  if (!client?.application) return;

  try {
    const existing = await client.application.commands.fetch({ guildId });

    for (const raw of BUILTIN_COMMANDS) {
      const payload = toDiscordCommand(raw);
      const existingCmd = existing.find((c) => c.name === payload.name);
      if (!existingCmd) {
        await client.application.commands.create(payload, guildId);
      } else if (existingCmd.description !== payload.description) {
        await existingCmd.edit(payload);
      }
    }

    logger?.info({ guildId, count: existing.size }, 'builtin commands ensured');
  } catch (err) {
    logger?.warn({ err, guildId }, 'failed to ensure builtin commands');
  }
}

export async function syncGuildCommands({ db, botManager, logger }, botId, guildId) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return;

  const client = inst.client;
  if (!client.application) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const customs = db
    .getCustomCommands(botId, guildId)
    .filter((c) => c.enabled === 1 && c.type === 'custom');

  const customPayload = customs
    .map((c) => ({
      name: sanitizeCommandName(c.name),
      description: (c.description || 'Пользовательская команда').slice(0, 100),
    }))
    .filter((c) => c.name.length >= 1);

  try {
    const existing = await client.application.commands.fetch({ guildId });

    for (const [, cmd] of existing) {
      const isBuiltin = BUILTIN_COMMANDS.some((b) => b.name === cmd.name);
      const isCustomNow = customPayload.some((c) => c.name === cmd.name);
      if (!isBuiltin && !isCustomNow) {
        await cmd.delete().catch(() => {});
      }
    }

    for (const c of customPayload) {
      const existingCmd = existing.find((x) => x.name === c.name);
      if (!existingCmd) {
        await client.application.commands.create(c, guildId).catch(() => {});
      } else if (existingCmd.description !== c.description) {
        await existingCmd.edit(c).catch(() => {});
      }
    }

    logger.info({ botId, guildId, count: customPayload.length }, 'slash commands synced');
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