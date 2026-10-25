/* ============================================================
   Сервис отложенных сообщений.

   Аналогичен announcements.js, но:
   - без расписания (только одна дата publishAt)
   - без eventTime
   - упоминание и автоудаление опциональны
   ============================================================ */

import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../discord/components-builder.js';
import { buildMention } from './announcements.js';

/**
 * Отправляет отложенное сообщение в канал. Мутирует `item`.
 * @param {import('discord.js').Guild} guild
 * @param {object} item
 * @returns {Promise<{ messageId: string }>}
 * @throws Если канал недоступен или нет права SendMessages
 */
export async function sendDelayed(guild, item) {
  if (!item.channelId) throw new Error('Канал не выбран');

  const channel = await guild.channels.fetch(item.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) throw new Error('Канал недоступен');

  const perms = channel.permissionsFor(guild.members.me);
  if (!perms?.has('SendMessages')) throw new Error('Нет права SendMessages');

  const components = buildComponentsFromConfig(item.config, { section: 'delayed' });
  const mention = buildMention(item.mention);

  if (mention.content) {
    const textComp = { type: 10, content: mention.content };
    if (item.config.displayMode === 'flat' || !components.length) {
      components.unshift(textComp);
    } else {
      const container = components[0];
      if (container?.type === 17 && Array.isArray(container.components)) {
        container.components.unshift(textComp);
      } else {
        components.unshift(textComp);
      }
    }
  }

  const msg = await channel.send({
    allowedMentions: mention.allowedMentions,
    flags: FLAG_COMPONENTS_V2,
    components
  });

  item.lastSentAt = new Date().toISOString();
  item.lastMessageId = msg.id;
  item.messageDeleted = false;
  item._autoDeleteAt = (item.autoDelete?.enabled && item.autoDelete.minutes > 0)
    ? Date.now() + item.autoDelete.minutes * 60_000
    : null;
  item._failed = false;

  return { messageId: msg.id };
}