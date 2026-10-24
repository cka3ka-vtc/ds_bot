import { readSection, writeSection } from '../storage/index.js';
import { logInfo } from './logger.js';

let initialized = false;

export function initMessageTracker(client) {
  if (initialized) return;
  initialized = true;
  client.on('messageDelete', handleDelete);
  client.on('messageDeleteBulk', handleBulkDelete);
  console.log('[message-tracker] initialized');
}

async function handleDelete(message) {
  if (!message.guild) return;
  markDeleted(message.guild.id, [message.id]);
}

async function handleBulkDelete(messages) {
  if (!messages?.size) return;
  const first = messages.first();
  if (!first?.guild) return;
  markDeleted(first.guild.id, [...messages.keys()]);
}

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
        changed = true;
        logInfo(guildId, 'message_external_delete', 'Сообщение удалено в Discord (внешнее)', {
          section, itemId: item.id
        });
      }
    }
    if (changed) {
      try { writeSection(guildId, section, data); }
      catch (e) { console.error(`[message-tracker] write error ${section}:`, e.message); }
    }
  }
}