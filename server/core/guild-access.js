// server/core/guild-access.js
// Единый checkMemberAdmin + кэш (admin/manage_guild) с TTL.
// Используется в auth-middleware.js и routes/guilds.js.

import { TtlCache } from './ttl-cache.js';

const ADMIN_TTL = 2 * 60_000;
const adminCache = new TtlCache({ ttl: ADMIN_TTL });

/**
 * Проверка, что member — админ/manage_guild на гильдии.
 * Возвращает boolean. Ошибки/недоступность бота → false.
 */
export async function checkMemberAdmin(inst, guildId, userId) {
  const key = `${inst.id}:${guildId}:${userId}`;
  const cached = adminCache.get(key);
  if (cached !== undefined) return cached;

  if (!inst?.client?.isReady?.()) return false;

  try {
    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) {
      adminCache.set(key, false);
      return false;
    }
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

/** Сброс кэша для конкретной пары (bot, guild, user). */
export function invalidateGuildAccess(botId, guildId, userId) {
  adminCache.delete(`${botId}:${guildId}:${userId}`);
}

/** Периодическая очистка (вызывается из bootstrap). */
export function cleanupGuildAccessCache() {
  adminCache.cleanup();
}