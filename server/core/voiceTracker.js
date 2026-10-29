// server/core/voiceTracker.js
// Отслеживание голосовой активности для начисления XP.
// Ключ: botId:guildId:userId. Тик раз в минуту.

const sessions = new Map();

function key(botId, guildId, userId) {
  return `${botId}:${guildId}:${userId}`;
}

export function startVoice(botId, guildId, userId, channelId) {
  const k = key(botId, guildId, userId);
  if (sessions.has(k)) return;
  sessions.set(k, {
    botId, guildId, userId, channelId,
    startedAt: Date.now(),
    lastAwardAt: 0,
  });
}

export function stopVoice(botId, guildId, userId) {
  sessions.delete(key(botId, guildId, userId));
}

export function getActiveSessions(botId, guildId) {
  const out = [];
  for (const s of sessions.values()) {
    if (botId && s.botId !== botId) continue;
    if (guildId && s.guildId !== guildId) continue;
    out.push(s);
  }
  return out;
}

export function touchAward(botId, guildId, userId) {
  const s = sessions.get(key(botId, guildId, userId));
  if (s) s.lastAwardAt = Date.now();
}

export function clearGuild(botId, guildId) {
  for (const [k, s] of sessions) {
    if (s.botId === botId && s.guildId === guildId) sessions.delete(k);
  }
}