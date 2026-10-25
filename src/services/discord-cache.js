/* ============================================================
   Кэш данных Discord (каналы, роли, участники).

   Что кэшируем:
   - channels  — каналы + права бота на каждый канал
   - roles     — роли + возможность бота управлять ими
   - members   — участники (id, name, avatar)

   TTL 5 минут. Инвалидация по событиям клиента:
   guildMemberAdd/Remove, channelCreate/Update/Delete,
   roleCreate/Update/Delete.

   botPerms на канале — критично для UI: показывает пользователю,
   сможет ли бот отправить сообщение в выбранный канал.
   ============================================================ */

import { getClient } from '../discord/client.js';
import { readSection } from '../storage/index.js';

const TTL = 5 * 60 * 1000;

/* key = `${guildId}:${type}` → { data, expires } */
const cache = new Map();

/**
 * Навешивает обработчики инвалидации. Вызывается один раз при старте.
 */
export function initCache() {
  const client = getClient();

  client.on('guildMemberAdd', (m) => invalidate(m.guild.id, 'members'));
  client.on('guildMemberRemove', (m) => invalidate(m.guild.id, 'members'));

  client.on('channelCreate', (c) => invalidate(c.guild.id, 'channels'));
  client.on('channelDelete', (c) => invalidate(c.guild.id, 'channels'));
  client.on('channelUpdate', (c) => invalidate(c.guild.id, 'channels'));

  client.on('roleCreate', (r) => invalidate(r.guild.id, 'roles'));
  client.on('roleDelete', (r) => invalidate(r.guild.id, 'roles'));
  client.on('roleUpdate', (r) => invalidate(r.guild.id, 'roles'));
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

/**
 * Каналы с правами бота на каждый канал.
 * Возвращает только текстовые, голосовые и анонсные.
 * @param {string} guildId
 * @returns {Promise<Array<{ id, name, type, parentId, botPerms }>>}
 */
export async function getChannels(guildId) {
  return fetchWithCache(guildId, 'channels', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);
    const allowed = [0, 2, 5]; // text, voice, announcement
    const botMember = guild.members.me;

    return guild.channels.cache
      .filter(c => allowed.includes(c.type))
      .map(c => {
        const perms = botMember ? c.permissionsFor(botMember) : null;
        return {
          id: c.id,
          name: c.name,
          type: c.type,
          parentId: c.parentId || null,
          botPerms: {
            view:           perms?.has('ViewChannel')     ?? false,
            send:           perms?.has('SendMessages')    ?? false,
            manageMessages: perms?.has('ManageMessages')  ?? false,
            manageRoles:    perms?.has('ManageRoles')     ?? false
          }
        };
      })
      .sort((a, b) => a.type !== b.type ? a.type - b.type : a.name.localeCompare(b.name, 'ru'));
  });
}

/**
 * Роли с флагом manageable (может ли бот её выдать).
 * @param {string} guildId
 * @returns {Promise<Array<{ id, name, color, position, manageable }>>}
 */
export async function getRoles(guildId) {
  return fetchWithCache(guildId, 'roles', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);
    const botMember = guild.members.me;
    const botHighest = botMember?.roles?.highest?.position ?? 0;

    return guild.roles.cache
      .filter(r => r.id !== guild.id && !r.managed)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        manageable: r.position < botHighest
      }))
      .sort((a, b) => b.position - a.position);
  });
}

/**
 * Участники (id, username, displayName, avatar).
 * @param {string} guildId
 * @returns {Promise<Array<{ id, username, displayName, avatar }>>}
 */
export async function getMembers(guildId) {
  return fetchWithCache(guildId, 'members', async () => {
    const client = getClient();
    const guild = await client.guilds.fetch(guildId);

    /* Кэш клиента может быть неполным — тогда делаем полный fetch */
    const cachedSize = guild.members.cache.size;
    const collection = (cachedSize > 0 && cachedSize >= guild.memberCount)
      ? guild.members.cache
      : await guild.members.fetch();

    return collection
      .map(m => ({
        id: m.id,
        username: m.user.username,
        displayName: m.displayName || m.user.username,
        avatar: m.user.displayAvatarURL({ size: 64 })
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));
  });
}

/**
 * Полная инвалидация кэша гильдии.
 * @param {string} guildId
 */
export function invalidateGuild(guildId) {
  for (const type of ['channels', 'roles', 'members']) {
    invalidate(guildId, type);
  }
}

/**
 * Проверяет, включён ли модуль в настройках гильдии.
 * Если настройки нет — модуль считается включённым (default true).
 * @param {string} guildId
 * @param {'announcements'|'autodelete'|'birthdays'|'profiles'} module
 * @returns {boolean}
 */
export function isModuleEnabled(guildId, module) {
  const s = readSection(guildId, 'settings');
  if (!s) return true;
  if (s.botEnabled === false) return false;
  return s.modules?.[module] !== false;
}