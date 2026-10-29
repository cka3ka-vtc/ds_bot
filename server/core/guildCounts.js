// server/core/guildCounts.js
const cache = new Map();
const TTL = 5 * 60 * 1000;

export async function getNonBotMemberCount(guild, opts = {}) {
  if (!guild) return 0;
  const now = Date.now();
  const cached = cache.get(guild.id);
  if (cached && now - cached.ts < TTL) return cached.value;

  const total = guild.memberCount ?? 0;
  const cacheSize = guild.members?.cache?.size ?? 0;

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
    const botsInCache = guild.members?.cache?.filter((m) => m.user.bot).size ?? 0;
    const value = Math.max(0, total - botsInCache);
    cache.set(guild.id, { value, ts: now });
    return value;
  }
}