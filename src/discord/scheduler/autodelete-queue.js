/* ============================================================
   Обработчик очереди автоудаления.

   Читает очередь из autodelete.js, проверяет, какие сообщения
   пора удалять, и удаляет их с батчингом:
   - если в канале накопилось >1 готовых сообщений и это не
     канал команд, пытается использовать bulkDelete
   - иначе удаляет по одному

   Legacy-команды не трогает — их удалит redirect.
   ============================================================ */

import { logInfo, logError } from '../../services/guild-logger.js';
import { isModuleEnabled } from '../../services/discord-cache.js';
import {
  getQueue,
  setQueue,
  getCommandChannelsFor,
  isLegacyCommandContent
} from '../autodelete.js';

/**
 * Обрабатывает очередь всех гильдий.
 * @param {import('discord.js').Client} client
 */
export async function processAutodeleteQueue(client) {
  for (const guild of client.guilds.cache.values()) {
    if (!isModuleEnabled(guild.id, 'autodelete')) continue;

    const queue = getQueue(guild.id);
    if (!queue?.length) continue;

    const now = Date.now();
    const commandChannels = getCommandChannelsFor(guild.id);

    /* Разделяем на «готовые» и «ждут» */
    const due = [];
    const remaining = [];
    for (const item of queue) {
      if (item.deleteAt > now) remaining.push(item);
      else due.push(item);
    }

    if (!due.length) {
      setQueue(guild.id, remaining);
      continue;
    }

    /* Группируем по каналу */
    const byChannel = new Map();
    for (const item of due) {
      if (!byChannel.has(item.channelId)) byChannel.set(item.channelId, []);
      byChannel.get(item.channelId).push(item);
    }

    let changed = false;

    for (const [channelId, items] of byChannel) {
      try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel) continue;

        /* Проверяем, какие сообщения реально можно удалить */
        const toDelete = [];
        for (const item of items) {
          const msg = await channel.messages.fetch(item.messageId).catch(() => null);
          if (!msg) continue;
          if (msg.author.id === client.user?.id) continue;              // не наши
          if (isLegacyCommandContent(msg.content)) continue;            // legacy
          toDelete.push(item);
        }

        if (!toDelete.length) continue;

        /* BULK: >1 сообщений, не канал команд, все <14 дней */
        const canBulk = !commandChannels.has(channelId)
          && toDelete.length > 1
          && toDelete.every(i => now - i.deleteAt < 14 * 24 * 3600 * 1000);

        if (canBulk) {
          try {
            const ids = toDelete.map(i => i.messageId);
            const fetched = await channel.messages.fetch({ limit: 100, cache: false }).catch(() => null);
            const validIds = ids.filter(id => fetched?.has(id));

            if (validIds.length > 1) {
              await channel.bulkDelete(validIds, true);
              logInfo(guild.id, 'autodelete_delayed_bulk',
                `Удалено ${validIds.length} сообщений bulkDelete`,
                { channelId });
              changed = true;
              continue;
            }
          } catch {
            /* Fallback на поштучное */
          }
        }

        /* Индивидуальное удаление */
        for (const item of toDelete) {
          try {
            const msg = await channel.messages.fetch(item.messageId).catch(() => null);
            if (msg) await msg.delete();
            changed = true;
          } catch (e) {
            logError(guild.id, 'autodelete_delayed', e.message,
              { messageId: item.messageId }, e.stack);
          }
        }
      } catch (e) {
        logError(guild.id, 'autodelete_batch', e.message, { channelId }, e.stack);
      }
    }

    if (changed || remaining.length !== queue.length) {
      setQueue(guild.id, remaining);
    }
  }
}