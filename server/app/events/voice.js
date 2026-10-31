// server/app/events/voice.js
import { saveProfileThrottled, snapshotOf } from './helpers.js';

export function onVoice({ db, logger, payload }) {
  const { botId, guildId, oldState, newState } = payload;
  if (!guildId) return;

  const member = newState.member || oldState.member;
  if (!member || !member.user || member.user.bot) return;

  const userId = member.id;
  const wasInVoice = !!oldState.channelId;
  const isInVoice = !!newState.channelId;

  if (!wasInVoice && isInVoice) {
    const snap = snapshotOf(member);
    try {
      db.addEvent({
        botId, guildId, userId, type: 'voice_join',
        meta: { channelId: newState.channelId, ...snap },
      });
    } catch (err) {
      logger.warn({
        err,
        event: 'add_event_voice_failed',
        bot_id: botId,
        guild_id: guildId,
        user_id: userId,
      }, 'addEvent voice failed');
    }
    saveProfileThrottled(db, logger, { botId, guildId, userId, ...snap });
  }
}