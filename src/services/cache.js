import { getClient } from '../discord/client.js';

const TTL = 5 * 60 * 1000; // 5 минут
const cache = new Map();

export function initCache() {
  const client = getClient();
  client.on('guildMemberAdd', (m) => invalidate(m.guild.id, 'members'));
  client.on('guildMemberRemove', (m) => invalidate(m.guild.id, 'members'));
  client.on('channelCreate', (c) => invalidate(c.guild.id, 'channels'));
  client.on('channelDelete', (c) => invalidate(c.guild.id, 'channels'));
  client.on('roleCreate', (r) => invalidate(r.guild.id, 'roles'));
  client.on('roleDelete', (r) => invalidate(r.guild.id, 'roles'));
}

function cacheKey(guildId, type) { return `${guildId}:${type}`; }

function invalidate(guildId, type) {
  cache.delete(cacheKey(guildId, type));
}

async function fetchWithCache(guildId, type, fetcher) {
  const key = cacheKey(guildId, type);
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  const data = await fetcher();
  cache.set(key, { data, expires: Date.now() + TTL });
  return data;
}

export async function getChannels(guildId) {
  return fetchWithCache(guildId, 'channels', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);
    const allowed = [0, 2, 5];
    return guild.channels.cache
      .filter(c => allowed.includes(c.type))
      .map(c => ({ id: c.id, name: c.name, type: c.type, parentId: c.parentId || null }))
      .sort((a, b) => a.type !== b.type ? a.type - b.type : a.name.localeCompare(b.name, 'ru'));
  });
}

export async function getRoles(guildId) {
  return fetchWithCache(guildId, 'roles', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);
    return guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .map(r => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
      .sort((a, b) => b.position - a.position);
  });
}

export async function getMembers(guildId) {
  return fetchWithCache(guildId, 'members', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);

    /* Загружаем ВСЕХ участников.
       guild.members.cache может быть неполным — если прелоад ещё не завершился
       или лимит был меньше memberCount, вызываем fetch() без limit. */
    let collection;
    const cachedSize = guild.members.cache.size;
    if (cachedSize > 0 && cachedSize >= guild.memberCount) {
      collection = guild.members.cache;
    } else {
      /* fetch() без limit — Discord.js запрашивает порциями, возвращает всех */
      collection = await guild.members.fetch();
    }

    return collection.map(m => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName || m.user.username,
      avatar: m.user.displayAvatarURL({ size: 64 })
    })).sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
  });
}

export function invalidateGuild(guildId) {
  for (const type of ['channels', 'roles', 'members']) {
    invalidate(guildId, type);
  }
}