// server/app/events/helper-cache.js
//
// Кэш кастомных команд. Раньше interaction.js читал db.getCustomCommands()
// на каждое не-builtin взаимодействие — терялось ~5ms/запрос при N кастомах.
// Здесь — TTL 60s + явная инвалидация из роутов commands/custom.js.

import { TtlCache } from '../../core/ttl-cache.js';

const CACHE_TTL = 60_000;
const cache = new TtlCache({ ttl: CACHE_TTL, maxSize: 5000 });

function key(botId, guildId) {
  return `${botId}:${guildId}`;
}

export function getCachedCommands(db, botId, guildId) {
  const k = key(botId, guildId);
  const cached = cache.get(k);
  if (cached) return cached;

  const value = db.getCustomCommands(botId, guildId);
  cache.set(k, value);
  return value;
}

export function invalidateCommandsCache(botId, guildId) {
  cache.delete(key(botId, guildId));
}

export function clearAllCommandsCache() {
  cache.clear();
}