/* ============================================================
   Обработка отложенных сообщений.

   Для каждой гильдии:
   1. Удаляет протухшие автоудаления
   2. Отправляет сообщения, у которых publishAt <= now и ещё не отправлены
   ============================================================ */

import { readSection, writeSection } from '../../storage/index.js';
import { logInfo, logError } from '../../services/guild-logger.js';
import { notifySectionUpdate } from '../../services/sse-hub.js';
import { isModuleEnabled } from '../../services/discord-cache.js';
import { sendDelayed } from '../../services/delayed.js';

/**
 * Обрабатывает отложенные одной гильдии.
 * @param {import('discord.js').Guild} guild
 */
export async function processDelayed(guild) {
  if (!isModuleEnabled(guild.id, 'announcements')) return;

  const data = readSection(guild.id, 'delayed');
  if (!data?.items?.length) return;

  const now = Date.now();
  let changed = false;

  /* ---------- 1. Автоудаление ---------- */
  for (const item of data.items) {
    if (item._autoDeleteAt && item._autoDeleteAt <= now && item.lastMessageId) {
      try {
        const channel = await guild.channels.fetch(item.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(item.lastMessageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }

        logInfo(guild.id, 'delayed_autodelete',
          `Автоудаление «${item.name || 'Без названия'}»`,
          { itemId: item.id });
      } catch (e) {
        logError(guild.id, 'delayed_autodelete', e.message,
          { itemId: item.id }, e.stack);
      }

      item._autoDeleteAt = null;
      item.lastMessageId = null;
      changed = true;
    }
  }

  /* ---------- 2. Отправка готовых ---------- */
  for (const item of data.items) {
    if (!item.publishAt || item.lastSentAt) continue;
    if (new Date(item.publishAt).getTime() > now) continue;

    try {
      await sendDelayed(guild, item);
      changed = true;

      logInfo(guild.id, 'delayed_send',
        `Отложка «${item.name || 'Без названия'}» отправлена`,
        { itemId: item.id, channelId: item.channelId });
    } catch (e) {
      logError(guild.id, 'delayed_send', e.message,
        { itemId: item.id, name: item.name }, e.stack);

      /* Помечаем как failed и фиксируем отправку — повторять
         автоматически не будем, чтобы не спамить */
      item.lastSentAt = new Date().toISOString();
      item._failed = true;
      changed = true;
    }
  }

  if (changed) {
    writeSection(guild.id, 'delayed', data);
    notifySectionUpdate(guild.id, 'delayed');
  }
}