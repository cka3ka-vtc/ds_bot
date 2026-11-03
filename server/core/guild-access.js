// server/core/guild-access.js
//
// Проверка прав пользователя на гильдии + TTL-кэш.
// Используется в auth-middleware (requireBotAccess) и в guilds-debug.

import { TtlCache } from './ttl-cache.js';

const ADMIN_TTL = 2 * 60_000;
const adminCache = new TtlCache({ ttl: ADMIN_TTL });

/**
 * Проверка, что member — админ/manage_guild на гильдии.
 * Возвращает boolean. Ошибки/недоступность → false.
 */
export async function checkMemberAdmin(inst, guildId, userId) {
  const key = `${inst.id}:${guildId}:${userId}`;
  const cached = adminCache.get(key);
  if (cached !== undefined) return cached;

  if (!inst?.client?.isReady?.()) return false;

  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) { adminCache.set(key, false); return false; }

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    }
    const value = !!(
      member?.permissions?.has?.('Administrator')
      || member?.permissions?.has?.('ManageGuild')
    );
    adminCache.set(key, value);
    return value;
  } catch {
    adminCache.set(key, false);
    return false;
  }
}

/**
 * Verbose-версия для debug-роута guilds-debug:
 * возвращает полную информацию (bitfield, роли) вместо boolean.
 * НЕ кэшируется — вызывается редко.
 */
export async function checkMemberAdminVerbose(inst, guildId, userId) {
  if (!inst?.client?.isReady?.()) return { value: false, member: null };

  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return { value: false, member: null };

    let member = guild.members.cache.get(userId);
    if (!member) {
      member = await guild.members.fetch({ user: userId, force: false }).catch(() => null);
    }
    if (!member) return { value: false, member: null };

    return {
      value: !!(member.permissions?.has?.('Administrator')
             || member.permissions?.has?.('ManageGuild')),
      member: {
        hasAdministrator: member.permissions?.has?.('Administrator') || false,
        hasManageGuild: member.permissions?.has?.('ManageGuild') || false,
        hasManageRoles: member.permissions?.has?.('ManageRoles') || false,
        hasManageChannels: member.permissions?.has?.('ManageChannels') || false,
        permissionsBitfield: member.permissions?.bitfield?.toString?.() || null,
        roles: member.roles?.cache
          ? [...member.roles.cache.values()]
              .filter((r) => r.name !== '@everyone')
              .map((r) => ({
                id: r.id, name: r.name,
                permissions: r.permissions?.bitfield?.toString?.() || '0',
              }))
          : [],
      },
    };
  } catch (err) {
    return { value: false, member: { error: err.message } };
  }
}

export function invalidateGuildAccess(botId, guildId, userId) {
  adminCache.delete(`${botId}:${guildId}:${userId}`);
}

export function cleanupGuildAccessCache() {
  adminCache.cleanup();
}