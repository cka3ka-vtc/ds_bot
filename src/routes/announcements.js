/* ============================================================
   Отправка объявлений и удаление из Discord.

   POST /guilds/:id/announcements/send
   POST /guilds/:id/announcements/:itemId/delete-discord
   ============================================================ */

import express from 'express';
import { getClient } from '../discord/client.js';
import { readSection, writeSection } from '../storage/index.js';
import { sendAutopost, computeNextRun } from '../services/announcements.js';
import { logInfo, logError } from '../services/guild-logger.js';
import { notifySectionUpdate } from '../services/sse-hub.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { SendAnnouncementSchema } from '../validation/schemas.js';

const router = express.Router();
const sendLimiter = rateLimit({ windowMs: 60_000, max: 30 });

/* ============================================================
   Отправка
   ============================================================ */

router.post('/guilds/:id/announcements/send', sendLimiter, async (req, res, next) => {
  try {
    const body = SendAnnouncementSchema.parse(req.body);
    const data = readSection(req.params.id, 'announcements');
    const ann = data?.items?.find(a => a.id === body.announcementId);

    if (!ann) {
      throw Object.assign(new Error('Объявление не найдено'), { status: 404 });
    }

    const client = getClient();
    const guild = await client.guilds.fetch(req.params.id);

    /* Опциональная очистка */
    if (body.clearChannel) {
      const ch = await guild.channels.fetch(ann.channelId).catch(() => null);
      const perms = ch?.permissionsFor(guild.members.me);
      if (ch && perms?.has('ManageMessages')) {
        await clearChannel(ch);
      }
    }

    const result = await sendAutopost(guild, ann);

    /* После ручной отправки пересчитываем nextRunAt */
    ann.nextRunAt = ann.enabled ? computeNextRun(ann, Date.now()) : null;

    writeSection(req.params.id, 'announcements', data);
    notifySectionUpdate(req.params.id, 'announcements');

    logInfo(req.params.id, 'announcement_send',
      `Объявление «${ann.name || 'Без названия'}» отправлено`,
      {
        announcementId: ann.id,
        channelId: ann.channelId,
        discordMessageId: result.messageId
      });

    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
});

/* ============================================================
   Удаление из Discord
   ============================================================ */

router.post('/guilds/:id/announcements/:itemId/delete-discord', async (req, res, next) => {
  try {
    const data = readSection(req.params.id, 'announcements');
    const item = data?.items?.find(i => i.id === req.params.itemId);

    if (!item) {
      throw Object.assign(new Error('Элемент не найден'), { status: 404 });
    }
    if (!item.lastMessageId) {
      throw Object.assign(new Error('Сообщение не отправлено в Discord'), { status: 400 });
    }

    const client = getClient();
    const guild = await client.guilds.fetch(req.params.id);
    const channel = await guild.channels.fetch(item.channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      throw Object.assign(new Error('Канал недоступен'), { status: 400 });
    }

    let deleted = false;
    const msg = await channel.messages.fetch(item.lastMessageId).catch(() => null);

    if (msg) {
      try { await msg.delete(); deleted = true; }
      catch (e) {
        logError(req.params.id, 'delete_discord_message', e.message,
          { itemId: item.id }, e.stack);
      }
    }

    item.lastMessageId = null;
    item.messageDeleted = true;
    item._autoDeleteAt = null;
    writeSection(req.params.id, 'announcements', data);
    notifySectionUpdate(req.params.id, 'announcements');

    logInfo(req.params.id, 'discord_delete',
      'Объявление удалено в Discord',
      { itemId: item.id, deleted });

    res.json({ ok: true, deleted });
  } catch (e) {
    next(e);
  }
});

async function clearChannel(channel) {
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const msgs = await channel.messages.fetch({ limit: 100 });
    if (!msgs.size) break;

    if (msgs.size === 1) {
      try { await msgs.first().delete(); total++; } catch {}
    } else {
      try { total += (await channel.bulkDelete(msgs, true)).size; } catch {}
    }

    if (msgs.size < 100) break;
  }
  return total;
}

export default router;