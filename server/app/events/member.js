// server/app/events/member.js
import { saveProfileThrottled, snapshotOf, invalidateProfile } from './helpers.js';

export function onMemberJoin({ db, logger, payload }) {
  const { botId, guildId, member } = payload;
  if (!guildId || !member || !member.user || member.user.bot) return;

  const snap = snapshotOf(member);

  try {
    db.addEvent({ botId, guildId, userId: member.id, type: 'member_join', meta: snap });
  } catch (err) {
    logger.warn({ err }, 'addEvent member_join failed');
  }

  try {
    db.upsertUserProfile({ botId, guildId, userId: member.id, ...snap });
    db.markActive(botId, guildId, member.id);
  } catch (err) {
    logger.debug({ err }, 'profile upsert (join) failed');
  }

  invalidateProfile(botId, guildId, member.id);
}

export function onMemberLeave({ db, logger, payload }) {
  const { botId, guildId, member } = payload;
  if (!guildId || !member || !member.user || member.user.bot) return;

  const snap = snapshotOf(member);

  try {
    db.upsertUserProfile({ botId, guildId, userId: member.id, ...snap });
    db.markLeft(botId, guildId, member.id);
  } catch (err) {
    logger.debug({ err }, 'profile upsert (leave) failed');
  }

  try {
    db.addEvent({ botId, guildId, userId: member.id, type: 'member_leave', meta: snap });
  } catch (err) {
    logger.warn({ err }, 'addEvent member_leave failed');
  }

  invalidateProfile(botId, guildId, member.id);
}