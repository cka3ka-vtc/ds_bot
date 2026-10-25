/* ============================================================
   Отправка сообщений и удаление из Discord.

   POST /guilds/:id/messages/send
   POST /guilds/:id/messages/:itemId/delete-discord
   ============================================================ */

import express from 'express';
import { getClient } from '../discord/client.js';
import { readSection, writeSection } from '../storage/index.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../discord/components-builder.js';
import { logInfo, logError } from '../services/guild-logger.js';
import { notifySectionUpdate } from '../services/sse-hub.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { SendMessageSchema } from '../validation/schemas.js';

const router = express.Router();
const sendLimiter = rateLimit({ windowMs: 60_000, max: 30 });

/* ============================================================
   Отправка
   ============================================================ */

router.post('/guilds/:id/messages/send', sendLimiter, async (req, res, next) => {
  try {
    const body = SendMessageSchema.parse(req.body);
    const data = readSection(req.params.id, 'messages');
    const message = data?.items?.find(m => m.id === body.messageId);

    if (!message) {
      throw Object.assign(new Error('Сообщение не найдено'), { status: 404 });
    }

    const client = getClient();
    const guild = await client.guilds.fetch(req.params.id);
    const channel = await guild.channels.fetch(message.channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      throw Object.assign(new Error('Канал недоступен'), { status: 400 });
    }

    const perms = channel.permissionsFor(guild.members.me);
    if (!perms?.has('SendMessages')) {
      throw Object.assign(new Error('Нет права SendMessages'), { status: 403 });
    }

    let cleared = 0;
    if (body.clearChannel && perms.has('ManageMessages')) {
      cleared = await clearChannel(channel);
    }

    const components = buildComponentsFromConfig(message.config, { section: 'messages' });
    const sent = await channel.send({
      flags: FLAG_COMPONENTS_V2,
      components
    });

    message.lastSentAt = new Date().toISOString();
    message.lastMessageId = sent.id;
    message.messageDeleted = false;
    message._autoDeleteAt = null;
    writeSection(req.params.id, 'messages', data);
    notifySectionUpdate(req.params.id, 'messages');

    logInfo(req.params.id, 'message_send',
      `Сообщение «${message.name || 'Без названия'}» отправлено`,
      {
        messageId: message.id,
        channelId: channel.id,
        discordMessageId: sent.id,
        cleared
      });

    res.json({ ok: true, messageId: sent.id, cleared });
  } catch (e) {
    next(e);
  }
});

/* ============================================================
   Удаление из Discord
   ============================================================ */

router.post('/guilds/:id/messages/:itemId/delete-discord', async (req, res, next) => {
  try {
    const data = readSection(req.params.id, 'messages');
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
    writeSection(req.params.id, 'messages', data);
    notifySectionUpdate(req.params.id, 'messages');

    logInfo(req.params.id, 'discord_delete', 'Сообщение удалено в Discord', {
      itemId: item.id,
      deleted
    });

    res.json({ ok: true, deleted });
  } catch (e) {
    next(e);
  }
});

/* ============================================================
   Утилита очистки канала
   ============================================================ */

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