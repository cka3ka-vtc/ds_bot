// server/app/events/helpers.js
const profileCache = new Map();
const PROFILE_TTL = 5 * 60 * 1000;

export function saveProfileThrottled(db, logger, data) {
  const key = `${data.botId}:${data.guildId}:${data.userId}`;
  const last = profileCache.get(key) || 0;
  if (Date.now() - last < PROFILE_TTL) return;
  try {
    db.upsertUserProfile(data);
    db.markActive(data.botId, data.guildId, data.userId);
    profileCache.set(key, Date.now());
  } catch (err) {
    logger.debug({ err, userId: data.userId }, 'profile upsert failed');
  }
}

export function invalidateProfile(botId, guildId, userId) {
  profileCache.delete(`${botId}:${guildId}:${userId}`);
}

export function snapshotOf(member) {
  const user = member.user || member;
  const displayName = member.displayName || user.globalName || user.username;
  return {
    username: user.username || null,
    displayName: displayName || null,
    avatarUrl: user.displayAvatarURL?.({ size: 128 }) || null,
  };
}