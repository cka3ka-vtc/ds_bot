// server/app/events/voice.js
import { saveProfileThrottled, snapshotOf } from './helpers.js';

export function onVoice({ db, logger, payload }) {
  const { botId, guildId, oldState, newState } = payload;
  if (!guildId) return;

  const member = newState.member || oldState.member;
  if (!member || !member.user || member.user.bot) return;

  const wasInVoice = !!oldState.channelId;
  const isInVoice = !!newState.channelId;

  if (!wasInVoice && isInVoice) {
    const snap = snapshotOf(member);
    try {
      db.addEvent({
        botId, guildId, userId: member.id, type: 'voice_join',
        meta: { channelId: newState.channelId, ...snap },
      });
    } catch (err) {
      logger.warn({ err }, 'addEvent voice failed');
    }
    saveProfileThrottled(db, logger, { botId, guildId, userId: member.id, ...snap });
  }
}