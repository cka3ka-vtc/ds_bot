// server/app/events/message.js
import { saveProfileThrottled, snapshotOf } from './helpers.js';

export function onMessage({ db, logger, payload }) {
  const { botId, guildId, message } = payload;
  if (!guildId || !message || message.author.bot) return;

  const userId = message.author.id;
  const snap = snapshotOf(message.member || message.author);

  try {
    db.addEvent({
      botId, guildId, userId, type: 'message',
      meta: { channelId: message.channel.id, ...snap },
    });
  } catch (err) {
    logger.warn({
      err,
      event: 'add_event_message_failed',
      bot_id: botId,
      guild_id: guildId,
      user_id: userId,
    }, 'addEvent message failed');
  }

  saveProfileThrottled(db, logger, { botId, guildId, userId, ...snap });
}