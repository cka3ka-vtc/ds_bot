/* ============================================================
   Отправка правил в канал Discord.

   POST /guilds/:id/rules/send
   body = { clearChannel?: boolean }

   Опционально очищает канал перед отправкой (bulkDelete).
   ============================================================ */

import express from 'express';
import { getClient } from '../discord/client.js';
import { readSection, writeSection } from '../storage/index.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../discord/components-builder.js';
import { logInfo } from '../services/guild-logger.js';
import { notifySectionUpdate } from '../services/sse-hub.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { SendBodySchema } from '../validation/schemas.js';

const router = express.Router();
const sendLimiter = rateLimit({ windowMs: 60_000, max: 30 });

router.post('/guilds/:id/rules/send', sendLimiter, async (req, res, next) => {
  try {
    const body = SendBodySchema.parse(req.body);
    const rules = readSection(req.params.id, 'rules');

    if (!rules?.channelId) {
      throw Object.assign(new Error('Канал не выбран'), { status: 400 });
    }

    const client = getClient();
    const guild = await client.guilds.fetch(req.params.id);
    const channel = await guild.channels.fetch(rules.channelId).catch(() => null);

    if (!channel?.isTextBased()) {
      throw Object.assign(new Error('Канал недоступен'), { status: 400 });
    }

    const perms = channel.permissionsFor(guild.members.me);
    if (!perms?.has('SendMessages')) {
      throw Object.assign(new Error('Нет права SendMessages'), { status: 403 });
    }

    /* Опциональная очистка канала */
    let cleared = 0;
    if (body.clearChannel && perms.has('ManageMessages')) {
      cleared = await clearChannel(channel);
    }

    const components = buildComponentsFromConfig(rules, { section: 'rules' });
    const sent = await channel.send({
      flags: FLAG_COMPONENTS_V2,
      components
    });

    rules.lastSentAt = new Date().toISOString();
    rules.lastMessageId = sent.id;
    writeSection(req.params.id, 'rules', rules);
    notifySectionUpdate(req.params.id, 'rules');

    logInfo(req.params.id, 'rules_send', 'Правила отправлены', {
      channelId: channel.id,
      messageId: sent.id,
      cleared
    });

    res.json({ ok: true, messageId: sent.id, cleared });
  } catch (e) {
    next(e);
  }
});

/**
 * Полная очистка канала (bulkDelete пачками по 100).
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<number>} количество удалённых
 */
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