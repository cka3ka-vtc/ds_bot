// server/api/routes/modules/birthdays-test.js
import { Router } from 'express';
import { validateBody } from '../../validate.js';
import { birthdaysTestBody } from '../../../validators/schemas.js';
import { getNonBotMemberCount } from '../../../core/guildCounts.js';
import { testMessageLimiter } from '../../middleware/rate-limit.js';
import { audit } from './_shared.js';
import {
  resolveTestChannel,
  resolveTestUser,
  trySendV2,
  sendAsEmbed,
} from '../_test-common.js';

/**
 * POST /api/modules/birthdays/test
 *
 * Тест сообщений модуля «Дни рождения»:
 *   - which = 'announce' — V2 (как реальное поздравление в announce-канал);
 *   - which = 'cmdSet' / 'cmdToggle' / 'cmdList' — embed (как реальные команды).
 */
export function createBirthdaysTestRouter() {
  const router = Router();

  router.post('/test', testMessageLimiter, validateBody(birthdaysTestBody), async (req, res) => {
    const { botId, guildId, which, messageConfig } = req.body;

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const stored = db.getModuleConfig(botId, guildId, 'birthdays');
    const channelId = req.body.channelId || stored?.config?.announceChannelId;
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
      birthday: '15.06',
      birthdayFull: '15.06.1995',
      age: '30',
      birthdaysCount: '42',
      state: 'включены',
      topUsers:
        `**1.** <@${req.user.id}> — **15.06.1995** (сегодня · 30 лет)\n` +
        `**2.** <@${req.user.id}> — **22.06** (через 7 дн.)\n` +
        `**3.** <@${req.user.id}> — **01.07.2001** (через 16 дн. · 24 лет)`,
      section: 'birthdays',
    };

    try {
      const msg = which === 'announce'
        ? await trySendV2(channel, messageConfig, tokens)
        : await sendAsEmbed(channel, messageConfig, tokens);

      if (!msg) return res.status(400).json({ error: 'empty_message' });

      audit(req, 'module.birthdays.test', { which, channelId });
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'birthdays: test send failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}