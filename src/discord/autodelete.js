import { readSection, writeSection } from '../storage/index.js';
import { logInfo, logError } from './logger.js';

const RULES_TTL = 5000;
const CHANNELS_TTL = 5000;

const rulesCache = new Map();
const channelsCache = new Map();   // guildId -> { channelIds: Set, expires }
const queues = new Map();
const dirty = new Set();

const COMMAND_NAMES = [
  '!hb',
  '!vtc', '!steam', '!hmp', '!tmp', '!company',
  '!profile'
];

let initialized = false;
let flushTimer = null;

export function initAutodelete(client) {
  if (initialized) {
    console.warn('[autodelete] already initialized — skip');
    return;
  }
  initialized = true;
  client.on('messageCreate', handleMessage);
  console.log('[autodelete] ✓ messageCreate handler REGISTERED');
}

/* Возвращает Set всех каналов, в которых команды активны (birthdays + profiles) */
function getCommandChannels(guildId) {
  const entry = channelsCache.get(guildId);
  if (entry && entry.expires > Date.now()) return entry.channelIds;

  const set = new Set();

  const birthdays = readSection(guildId, 'birthdays');
  if (birthdays?.settings?.channelId) set.add(birthdays.settings.channelId);

  const profiles = readSection(guildId, 'profiles');
  if (profiles?.settings?.channelId) set.add(profiles.settings.channelId);

  channelsCache.set(guildId, { channelIds: set, expires: Date.now() + CHANNELS_TTL });
  return set;
}

export function invalidateCommandChannels(guildId) {
  channelsCache.delete(guildId);
}

function isCommandMessage(content) {
  if (!content || !content.length) return false;
  const trimmed = content.trimStart().toLowerCase();
  if (!trimmed) return false;
  return COMMAND_NAMES.some(c => trimmed === c || trimmed.startsWith(c + ' '));
}

async function handleMessage(message) {
  try {
    if (!message.guild) return;
    if (message.system) return;

    const guildId = message.guild.id;
    const ourBotId = message.client.user?.id;
    const isOurBot = message.author.id === ourBotId;

    if (isOurBot) return;

    const commandChannels = getCommandChannels(guildId);
    if (commandChannels.has(message.channel.id)) {
      if (isCommandMessage(message.content)) return;

      await deleteMessageWithLog(
        message, guildId,
        'command_channel_lock',
        'Удалено постороннее сообщение в канале команд'
      );
      return;
    }

    if (message.author.bot) return;

    if (isCommandMessage(message.content)) return;

    const rules = getRules(guildId);
    if (!rules.length) return;

    const rule = rules.find(r => r.enabled && r.channelId === message.channel.id);
    if (!rule) return;

    if (rule.mode === 'instant') {
      await deleteMessageWithLog(
        message, guildId,
        'autodelete_instant',
        `Мгновенно удалено сообщение в #${message.channel.name}`
      );
      return;
    }

    if (rule.mode === 'delayed' && rule.deleteAfterMinutes > 0) {
      const deleteAt = Date.now() + rule.deleteAfterMinutes * 60000;
      addToQueue(guildId, {
        channelId: message.channel.id,
        messageId: message.id,
        deleteAt
      });
    }
  } catch (e) {
    console.error('[autodelete] handler error:', e.message);
  }
}

async function deleteMessageWithLog(message, guildId, logType, logMessage) {
  try {
    await message.delete();
    logInfo(guildId, logType, logMessage, {
      channelId: message.channel.id,
      messageId: message.id,
      authorId: message.author.id,
      preview: (message.content || '').slice(0, 100)
    });
  } catch (e) {
    logError(guildId, logType, e.message, {
      channelId: message.channel.id,
      messageId: message.id
    }, e.stack);
  }
}

function getRules(guildId) {
  const entry = rulesCache.get(guildId);
  if (entry && entry.expires > Date.now()) return entry.rules;
  const data = readSection(guildId, 'autodelete');
  const rules = data?.items || [];
  rulesCache.set(guildId, { rules, expires: Date.now() + RULES_TTL });
  return rules;
}

export function invalidateAutodeleteRules(guildId) {
  rulesCache.delete(guildId);
}

function addToQueue(guildId, item) {
  if (!queues.has(guildId)) {
    const data = readSection(guildId, 'autodelete-queue');
    queues.set(guildId, data?.items || []);
  }
  queues.get(guildId).push(item);
  dirty.add(guildId);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueues();
  }, 2000);
}

function flushQueues() {
  for (const guildId of dirty) {
    const items = queues.get(guildId) || [];
    try { writeSection(guildId, 'autodelete-queue', { items }); }
    catch (e) { console.error('flushQueues error:', e.message); }
  }
  dirty.clear();
}

export function shutdownAutodelete() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  flushQueues();
}

export async function processAutodeleteQueue(client) {
  for (const guild of client.guilds.cache.values()) {
    if (!queues.has(guild.id)) {
      const data = readSection(guild.id, 'autodelete-queue');
      if (!data?.items?.length) continue;
      queues.set(guild.id, data.items);
    }

    const queue = queues.get(guild.id);
    if (!queue?.length) continue;

    const now = Date.now();
    const remaining = [];
    let changed = false;

    for (const item of queue) {
      if (item.deleteAt > now) { remaining.push(item); continue; }
      changed = true;

      try {
        const channel = await client.channels.fetch(item.channelId).catch(() => null);
        if (!channel) continue;
        const msg = await channel.messages.fetch(item.messageId).catch(() => null);
        if (!msg) continue;

        if (isCommandMessage(msg.content)) continue;
        if (msg.author.id === client.user?.id) continue;

        const commandChannels = getCommandChannels(guild.id);
        if (commandChannels.has(item.channelId)) {
          await msg.delete().catch(() => {});
          continue;
        }

        await msg.delete();
        logInfo(guild.id, 'autodelete_delayed', 'Сообщение удалено по таймеру', {
          channelId: item.channelId, messageId: item.messageId
        });
      } catch (e) {
        logError(guild.id, 'autodelete_delayed', e.message, { messageId: item.messageId }, e.stack);
      }
    }

    if (changed) {
      queues.set(guild.id, remaining);
      dirty.add(guild.id);
    }
  }
  flushQueues();
}