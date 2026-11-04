// server/api/routes/commands/custom-test.js
import { EmbedBuilder } from 'discord.js';
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateBody } from '../../validate.js';
import { commandTestBody } from '../../../validators/schemas.js';
import { testMessageLimiter } from '../../middleware/rate-limit.js';
import { getNonBotMemberCount } from '../../../core/guildCounts.js';
import { audit } from './_shared.js';
import { resolveTestChannel, resolveTestUser } from '../_test-common.js';
import { sendMessageConfig } from '../../../core/message-sender.js';

export function createCustomTestRouter() {
  const router = Router();

  router.post(
    '/:id/test',
    testMessageLimiter,
    validateBody(commandTestBody),
    requireBotAccess,
    async (req, res) => {
      const { botId, guildId, channelId } = req.body;
      const db = req.app.locals.db;

      const cmd = db.getCustomCommand(botId, guildId, req.params.id);
      if (!cmd) return res.status(404).json({ error: 'not_found' });

      let guild, channel;
      try {
        ({ guild, channel } = await resolveTestChannel(
          req.app.locals.botManager.get(botId),
          guildId,
          channelId,
        ));
      } catch (err) {
        return res.status(err.code === 'bot_offline' ? 503 : 400).json({ error: err.code });
      }

      const user = req.user;
      const { displayName, avatarUrl } = await resolveTestUser(guild, user);
      const count = await getNonBotMemberCount(guild).catch(() => 0);
      const now = Math.floor(Date.now() / 1000);

      const tokens = {
        user: `<@${user.id}>`, mention: `<@${user.id}>`,
        username: user.username, displayName, avatarUrl,
        guild: guild.name, count,
        guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
        section: 'cmd',
        command: cmd.name,
        channel: `<#${channelId}>`,
        channelName: channel.name || '',
        memberCount: guild.memberCount || 0,
        timestamp: `<t:${now}:R>`,
        date: `<t:${now}:D>`,
        time: `<t:${now}:t>`,
        dateFull: `<t:${now}:F>`,
      };

      try {
        const cfgObj = cmd.messageConfig || {};
        const hasBlocks = cfgObj && typeof cfgObj === 'object' &&
          (cfgObj.title || cfgObj.subtitle || (Array.isArray(cfgObj.blocks) && cfgObj.blocks.length));

        if (hasBlocks) {
          const msg = await sendMessageConfig(channel, cfgObj, tokens, {
            ping: false,
            label: 'command.test',
            logger: req.app.locals.logger,
            context: { bot_id: botId, guild_id: guildId, command_id: cmd.id },
          });
          if (msg) {
            audit(req, 'command.test', cmd.id, { channelId, mode: cfgObj.displayMode || 'context' });
            return res.json({ ok: true, messageId: msg.id });
          }
        }

        if (cmd.responseMode === 'embed') {
          const embed = new EmbedBuilder()
            .setColor(cmd.responseEmbedColor || '#5865F2')
            .setDescription(cmd.response || '⚙ Команда выполняется');
          const msg = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
          audit(req, 'command.test', cmd.id, { channelId, mode: 'legacy-embed' });
          return res.json({ ok: true, messageId: msg.id });
        }

        const msg = await channel.send({
          content: cmd.response || '⚙ Команда выполняется',
          allowedMentions: { parse: [] },
        });
        audit(req, 'command.test', cmd.id, { channelId, mode: 'legacy-text' });
        return res.json({ ok: true, messageId: msg.id });
      } catch (err) {
        res.status(500).json({ error: 'send_failed', details: err.message });
      }
    },
  );

  return router;
}