/* ============================================================
   Трекер внешних удалений.

   Если пользователь удалит сообщение бота вручную через клиент
   Discord, панель об этом не узнает. Этот модуль слушает
   messageDelete / messageDeleteBulk и сбрасывает у соответствующих
   записей lastMessageId → null и ставит messageDeleted = true.

   Работает для трёх секций: messages, announcements, delayed.
   ============================================================ */

import { readSection, writeSection } from '../storage/index.js';
import { logInfo } from './guild-logger.js';

let initializedOn = null;

/**
 * Вешает обработчики на клиент. Повторный вызов — no-op.
 * @param {import('discord.js').Client} client
 */

export function initMessageTracker(client) {
  if (initializedOn === client) return;
  initializedOn = client;

  client.on('messageDelete', handleDelete);
  client.on('messageDeleteBulk', handleBulkDelete);

  console.log('[message-tracker] ✅ отслеживание удалений включено');
}

/**
 * Одиночное удаление.
 * @param {import('discord.js').Message} message
 */
async function handleDelete(message) {
  if (!message.guild) return;
  markDeleted(message.guild.id, [message.id]);
}

/**
 * Массовое удаление (bulkDelete).
 * @param {import('discord.js').Collection<string, import('discord.js').Message>} messages
 */
async function handleBulkDelete(messages) {
  if (!messages?.size) return;
  const first = messages.first();
  if (!first?.guild) return;
  markDeleted(first.guild.id, [...messages.keys()]);
}

/**
 * Ищет записи с указанными lastMessageId и помечает их удалёнными.
 * @param {string} guildId
 * @param {string[]} messageIds
 */
function markDeleted(guildId, messageIds) {
  const set = new Set(messageIds);

  for (const section of ['messages', 'announcements', 'delayed']) {
    const data = readSection(guildId, section);
    if (!data?.items?.length) continue;

    let changed = false;

    for (const item of data.items) {
      if (item.lastMessageId && set.has(item.lastMessageId)) {
        item.lastMessageId = null;
        item.messageDeleted = true;
        item._autoDeleteAt = null;
        changed = true;

        logInfo(guildId, 'message_external_delete',
          'Сообщение удалено в Discord (внешнее)', {
            section,
            itemId: item.id
          });
      }
    }

    if (changed) {
      try { writeSection(guildId, section, data); }
      catch (e) { console.error(`[message-tracker] write error ${section}:`, e.message); }
    }
  }
}