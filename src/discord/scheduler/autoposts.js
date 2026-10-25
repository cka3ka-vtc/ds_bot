/* ============================================================
   Обработка объявлений по расписанию.

   Для каждой гильдии:
   1. Удаляет протухшие автоудаления
   2. Проверяет nextRunAt и отправляет готовые объявления
   3. Обновляет nextRunAt после отправки
   ============================================================ */

import { readSection, writeSection } from '../../storage/index.js';
import { logInfo, logError } from '../../services/guild-logger.js';
import { notifySectionUpdate } from '../../services/sse-hub.js';
import { isModuleEnabled } from '../../services/discord-cache.js';
import { sendAutopost, computeNextRun } from '../../services/announcements.js';

/**
 * Обрабатывает объявления одной гильдии.
 * @param {import('discord.js').Guild} guild
 */
export async function processAutoposts(guild) {
  if (!isModuleEnabled(guild.id, 'announcements')) return;

  const data = readSection(guild.id, 'announcements');
  if (!data?.items?.length) return;

  const now = Date.now();
  let changed = false;

  /* ---------- 1. Автоудаление ---------- */
  for (const ann of data.items) {
    if (ann._autoDeleteAt && ann._autoDeleteAt <= now && ann.lastMessageId) {
      try {
        const channel = await guild.channels.fetch(ann.channelId).catch(() => null);
        if (channel) {
          const msg = await channel.messages.fetch(ann.lastMessageId).catch(() => null);
          if (msg) await msg.delete().catch(() => {});
        }

        logInfo(guild.id, 'autopost_autodelete',
          `Автоудаление «${ann.name || 'Без названия'}»`,
          { announcementId: ann.id });
      } catch (e) {
        logError(guild.id, 'autopost_autodelete', e.message,
          { announcementId: ann.id }, e.stack);
      }

      ann._autoDeleteAt = null;
      ann.lastMessageId = null;
      changed = true;
    }
  }

  /* ---------- 2. Отправка готовых ---------- */
  for (const ann of data.items) {
    if (!ann.enabled || !ann.nextRunAt || ann.nextRunAt > now) continue;

    try {
      await sendAutopost(guild, ann);
      ann.nextRunAt = computeNextRun(ann, Date.now());
      changed = true;

      logInfo(guild.id, 'autopost_send',
        `Объявление «${ann.name || 'Без названия'}» отправлено`,
        { announcementId: ann.id, channelId: ann.channelId });
    } catch (e) {
      logError(guild.id, 'autopost_send', e.message,
        { announcementId: ann.id, name: ann.name }, e.stack);

      /* Сдвигаем на 5 минут — дадим время разобраться */
      ann.nextRunAt = Date.now() + 5 * 60_000;
      changed = true;
    }
  }

  if (changed) {
    writeSection(guild.id, 'announcements', data);
    notifySectionUpdate(guild.id, 'announcements');
  }
}