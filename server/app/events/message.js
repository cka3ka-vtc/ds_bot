// server/app/events/message.js
import { saveProfileThrottled, snapshotOf } from './helpers.js';

export function onMessage({ db, logger, payload }) {
  const { botId, guildId, message } = payload;
  if (!guildId || !message || message.author.bot) return;

  const snap = snapshotOf(message.member || message.author);

  try {
    db.addEvent({
      botId, guildId, userId: message.author.id, type: 'message',
      meta: { channelId: message.channel.id, ...snap },
    });
  } catch (err) {
    logger.warn({ err }, 'addEvent message failed');
  }

  saveProfileThrottled(db, logger, { botId, guildId, userId: message.author.id, ...snap });
}