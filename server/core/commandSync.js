// server/core/commandSync.js
import { BUILTIN_COMMANDS, BUILTIN_NAMES, toDiscordCommand } from '../../shared/builtin-commands.js';
import { retryDiscord } from './retry.js';

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

function buildDesiredCommands(db, botId, guildId) {
  const enabledModules = db.getEnabledModules(botId, guildId);
  const enabledSet = new Set(enabledModules);

  let builtinSettings = {};
  try { builtinSettings = db.getAllBuiltinSettings(botId, guildId) || {}; }
  catch {}

  const builtins = BUILTIN_COMMANDS
    .filter((c) => enabledSet.has(c.moduleKey))
    .filter((c) => {
      const s = builtinSettings[c.name];
      return !s || s.enabled !== false;
    })
    .map((c) => {
      const s = builtinSettings[c.name];
      const desc = (s?.description && s.description.trim()) || c.description;
      return {
        ...toDiscordCommand(c),
        description: desc.slice(0, 100),
      };
    });

  const customs = db
    .getCustomCommands(botId, guildId)
    .filter((c) => !!c.enabled)
    .filter((c) => (c.type || 'custom') === 'custom')
    .filter((c) => !BUILTIN_NAMES.has(c.name))
    .map((c) => ({
      name: sanitizeCommandName(c.name),
      description: (c.description || 'Пользовательская команда').slice(0, 100),
    }))
    .filter((c) => c.name.length >= 2);

  const byName = new Map();
  for (const cmd of [...builtins, ...customs]) {
    if (!byName.has(cmd.name)) byName.set(cmd.name, cmd);
  }
  return [...byName.values()];
}

export async function syncGuildCommands({ db, botManager, logger }, botId, guildId) {
  const inst = botManager.get(botId);
  if (!inst?.client?.isReady()) return;
  if (!inst.client.application) return;

  const guild = inst.client.guilds.cache.get(guildId);
  if (!guild) return;

  const desired = buildDesiredCommands(db, botId, guildId);

  try {
    await retryDiscord(() => guild.commands.set(desired), {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      label: 'guild.commands.set',
      logger,
      context: { bot_id: botId, guild_id: guildId },
    });
    logger.info({ botId, guildId, count: desired.length }, 'slash commands synced');
  } catch (err) {
    logger.warn({ err, botId, guildId }, 'slash command sync failed');
  }
}

/* Debounced variant для UI-роутов (см. рефакторинг #7) */
const SYNC_DEBOUNCE_MS = 1500;
const pendingSyncs = new Map();

export function scheduleGuildCommandsSync(ctx, botId, guildId) {
  const key = `${botId}:${guildId}`;
  const existing = pendingSyncs.get(key);
  if (existing?.timer) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pendingSyncs.delete(key);
    syncGuildCommands(ctx, botId, guildId).catch((err) => {
      ctx.logger?.warn({ err, botId, guildId }, 'scheduled command sync failed');
    });
  }, SYNC_DEBOUNCE_MS);

  if (typeof timer.unref === 'function') timer.unref();
  pendingSyncs.set(key, { timer, ctx, botId, guildId });
}

export async function flushPendingSyncs() {
  const entries = [...pendingSyncs.values()];
  pendingSyncs.clear();
  if (!entries.length) return;

  await Promise.allSettled(entries.map(({ timer, ctx, botId, guildId }) => {
    clearTimeout(timer);
    return syncGuildCommands(ctx, botId, guildId);
  }));
}

export async function ensureBuiltinCommands(guildOrId, logger, client) {
  const guildId = resolveGuildId(guildOrId);
  if (!guildId || !client?.application) return;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  try {
    const desired = BUILTIN_COMMANDS.map(toDiscordCommand);
    await retryDiscord(() => guild.commands.set(desired), {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
      label: 'ensureBuiltinCommands',
      logger,
      context: { guild_id: guildId },
    });
    logger?.info({ guildId, count: desired.length }, 'builtin commands ensured');
  } catch (err) {
    logger?.warn({ err, guildId }, 'failed to ensure builtin commands');
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

export { sanitizeCommandName, buildDesiredCommands };