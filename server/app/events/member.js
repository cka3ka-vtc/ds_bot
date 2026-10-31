// server/app/events/member.js
import { saveProfileThrottled, snapshotOf, invalidateProfile } from './helpers.js';
import { invalidateGuildCount } from '../../core/guildCounts.js';

export function onMemberJoin({ db, logger, payload }) {
  const { botId, guildId, member } = payload;
  if (!guildId || !member || !member.user || member.user.bot) return;

  invalidateGuildCount(guildId);

  const userId = member.id;
  const snap = snapshotOf(member);

  try {
    db.addEvent({ botId, guildId, userId, type: 'member_join', meta: snap });
  } catch (err) {
    logger.warn({
      err,
      event: 'add_event_join_failed',
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
    }, 'addEvent member_join failed');
  }

  try {
    db.upsertUserProfile({ botId, guildId, userId, ...snap });
    db.markActive(botId, guildId, userId);
  } catch (err) {
    logger.debug({
      err,
      event: 'profile_upsert_join_failed',
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
    }, 'profile upsert (join) failed');
  }

  invalidateProfile(botId, guildId, userId);
}

export function onMemberLeave({ db, logger, payload }) {
  const { botId, guildId, member } = payload;
  if (!guildId || !member || !member.user || member.user.bot) return;

  invalidateGuildCount(guildId);

  const userId = member.id;
  const snap = snapshotOf(member);

  try {
    db.upsertUserProfile({ botId, guildId, userId, ...snap });
    db.markLeft(botId, guildId, userId);
  } catch (err) {
    logger.debug({
      err,
      event: 'profile_upsert_leave_failed',
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
    }, 'profile upsert (leave) failed');
  }

  try {
    db.addEvent({ botId, guildId, userId, type: 'member_leave', meta: snap });
  } catch (err) {
    logger.warn({
      err,
      event: 'add_event_leave_failed',
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
    }, 'addEvent member_leave failed');
  }

  invalidateProfile(botId, guildId, userId);
}