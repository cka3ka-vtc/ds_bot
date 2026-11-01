// server/api/routes/modules/greetings-test.js
import { Router } from 'express';
import { validateBody } from '../../validate.js';
import { greetingsTestBody } from '../../../validators/schemas.js';
import { getNonBotMemberCount } from '../../../core/guildCounts.js';
import { testMessageLimiter } from '../../middleware/rate-limit.js';
import { audit } from './_shared.js';
import {
  resolveTestChannel,
  resolveTestUser,
  trySendV2,
} from '../_test-common.js';

/**
 * POST /api/modules/greetings/test
 *
 * Отправляет тестовое сообщение в канал модуля. Использует V2 — как
 * настоящая отправка приветствия через channel.send, поэтому ведёт себя
 * идентично продакшен-потоку.
 */
export function createGreetingsTestRouter() {
  const router = Router();

  router.post('/test', testMessageLimiter, validateBody(greetingsTestBody), async (req, res) => {
    const { botId, guildId, which, messageConfig } = req.body;

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const stored = db.getModuleConfig(botId, guildId, 'greetings');
    const channelId = req.body.channelId || stored?.config?.channelId;
    if (!channelId) return res.status(400).json({ error: 'no_channel' });

    let guild, channel;
    try {
      ({ guild, channel } = await resolveTestChannel(
        botManager.get(botId),
        guildId,
        channelId,
      ));
    } catch (err) {
      return res.status(err.code === 'bot_offline' ? 503 : 400).json({ error: err.code });
    }

    const { displayName, avatarUrl } = await resolveTestUser(guild, req.user);
    const nonBotCount = await getNonBotMemberCount(guild).catch(() => 0);

    const tokens = {
      user: `<@${req.user.id}>`,
      mention: `<@${req.user.id}>`,
      username: req.user.username,
      displayName,
      avatarUrl,
      guild: guild.name,
      count: nonBotCount,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      section: 'greetings',
    };

    try {
      const msg = await trySendV2(channel, messageConfig, tokens);
      if (!msg) return res.status(400).json({ error: 'empty_message' });

      audit(req, 'module.greetings.test', { which, channelId });
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'greetings: test send failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}