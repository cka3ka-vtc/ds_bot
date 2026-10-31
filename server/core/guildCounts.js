// server/core/guildCounts.js
const cache = new Map();
const TTL = 5 * 60 * 1000;

/**
 * Возвращает количество участников без ботов.
 *
 * @param {Guild} guild
 * @param {object} [opts]
 * @param {number} [opts.timeout=5000] — сколько ждать guild.members.fetch()
 * @param {boolean} [opts.force=false] — игнорировать локальный кэш
 *
 * Кэш НЕ обновляется событиями guildMemberAdd/Remove автоматически —
 * но в этих событиях вызывается invalidateGuildCount(), поэтому следующий
 * вызов getNonBotMemberCount() пересчитает значение с учётом изменения.
 */
export async function getNonBotMemberCount(guild, opts = {}) {
  if (!guild) return 0;
  const now = Date.now();

  if (!opts.force) {
    const cached = cache.get(guild.id);
    if (cached && now - cached.ts < TTL) return cached.value;
  }

  const total = guild.memberCount ?? 0;
  const cacheSize = guild.members?.cache?.size ?? 0;

  // Если кэш участников уже полный — считаем локально, без сети.
  if (cacheSize >= total && total > 0) {
    const value = guild.members.cache.filter((m) => !m.user.bot).size;
    cache.set(guild.id, { value, ts: now });
    return value;
  }

  try {
    await guild.members.fetch({ withPresences: false, time: opts.timeout || 5000 });
    const value = guild.members.cache.filter((m) => !m.user.bot).size;
    cache.set(guild.id, { value, ts: now });
    return value;
  } catch {
    // Fallback: memberCount из Discord обновляется на join/leave сразу,
    // а ботов в кэше обычно видно — вычитаем их.
    const botsInCache = guild.members?.cache?.filter((m) => m.user.bot).size ?? 0;
    const value = Math.max(0, total - botsInCache);
    cache.set(guild.id, { value, ts: now });
    return value;
  }
}

/**
 * Сбрасывает кэш для конкретной гильдии.
 * Вызывается из событий guildMemberAdd/Remove, чтобы {count} в приветствии
 * отражал актуальное число участников.
 */
export function invalidateGuildCount(guildId) {
  if (!guildId) return;
  cache.delete(String(guildId));
}

/** Полный сброс кэша (на случай ручной инвалидации). */
export function invalidateAllGuildCounts() {
  cache.clear();
}