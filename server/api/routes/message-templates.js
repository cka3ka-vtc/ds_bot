// server/api/routes/message-templates.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import {
  templateCreateBody, templateUpdateBody, templateSendBody,
} from '../../validators/schemas.js';
import { messageTemplateToDto } from '../dto/index.js';
import { mergeTemplateMessageConfig } from '../../../shared/message-templates-config.js';
import { sendMessageConfig } from '../../core/message-sender.js';
import { audit } from '../_audit.js';
import {
  persistRoleButtonsFromConfig,
  deleteRoleButtonsForSource,
} from '../../core/role-buttons-persist.js';

async function resolveChannel(inst, guildId, channelId) {
  if (!channelId) return null;
  const guild = inst?.client?.guilds?.cache?.get(guildId);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId)
    || await inst.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

export function messageTemplatesRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const list = req.app.locals.db.listMessageTemplates(req.bot.id, req.query.guildId);
    res.json(list.map(messageTemplateToDto));
  });

  router.get('/:id', requireBotAccess, (req, res) => {
    const item = req.app.locals.db.getMessageTemplate(req.bot.id, req.query.guildId, req.params.id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    res.json(messageTemplateToDto(item));
  });

  router.post('/', validateBody(templateCreateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, defaultChannelId, messageConfig } = req.body;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    if (defaultChannelId) {
      const ch = await resolveChannel(inst, guildId, defaultChannelId);
      if (!ch) return res.status(400).json({ error: 'invalid_channel' });
    }

    const normalized = mergeTemplateMessageConfig(messageConfig);
    const id = req.app.locals.db.createMessageTemplate(botId, guildId, {
      name,
      messageConfig: normalized,
      defaultChannelId: defaultChannelId || null,
    });

    try {
      persistRoleButtonsFromConfig(req.app.locals.db, botId, guildId, `message-templates.${id}`, normalized);
    } catch (err) {
      req.app.locals.logger.warn({ err, id }, 'template: persist role-buttons failed');
    }

    audit(req, 'template.create', id, { name });
    res.json({ id });
  });

  router.put('/:id', validateBody(templateUpdateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, defaultChannelId, messageConfig } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getMessageTemplate(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    if (defaultChannelId !== undefined && defaultChannelId) {
      const inst = req.app.locals.botManager.get(botId);
      if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });
      const ch = await resolveChannel(inst, guildId, defaultChannelId);
      if (!ch) return res.status(400).json({ error: 'invalid_channel' });
    }

    const nextCfg = messageConfig !== undefined
      ? mergeTemplateMessageConfig(messageConfig)
      : undefined;

    db.updateMessageTemplate(botId, guildId, id, {
      name, messageConfig: nextCfg, defaultChannelId,
    });

    if (nextCfg) {
      try {
        persistRoleButtonsFromConfig(db, botId, guildId, `message-templates.${id}`, nextCfg);
      } catch (err) {
        req.app.locals.logger.warn({ err, id }, 'template: persist role-buttons failed');
      }
    }

    audit(req, 'template.update', id, { name });
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getMessageTemplate(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const id = db.createMessageTemplate(botId, guildId, {
      name: `${prev.name} (копия)`,
      messageConfig: prev.messageConfig,
      defaultChannelId: prev.defaultChannelId,
    });

    try {
      persistRoleButtonsFromConfig(db, botId, guildId, `message-templates.${id}`, prev.messageConfig);
    } catch {}

    audit(req, 'template.duplicate', id, { source: prev.id });
    res.json({ id });
  });

  router.post('/:id/send', validateBody(templateSendBody), requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getMessageTemplate(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const targetChannelId = req.body.channelId || prev.defaultChannelId;
    if (!targetChannelId) return res.status(400).json({ error: 'no_channel' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const channel = await resolveChannel(inst, guildId, targetChannelId);
    if (!channel) return res.status(400).json({ error: 'invalid_channel' });

    const guild = channel.guild;
    const tokens = {
      guild: guild.name,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      count: guild.memberCount || 0,
    };

    try {
      const msg = await sendMessageConfig(channel, prev.messageConfig, tokens, {
        ping: false,
        label: 'template.send',
        logger: req.app.locals.logger,
        context: { bot_id: botId, guild_id: guildId, template_id: id },
      });
      if (!msg) return res.status(400).json({ error: 'empty_message' });

      try { db.touchMessageTemplateLastSent(botId, guildId, id); } catch {}
      audit(req, 'template.send', id, { channelId: targetChannelId, messageId: msg.id });
      res.json({ ok: true, messageId: msg.id, sentAt: Math.floor(Date.now() / 1000) });
    } catch (err) {
      req.app.locals.logger.warn({ err, id, channelId: targetChannelId }, 'template: send failed');
      res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  router.delete('/:id', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getMessageTemplate(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    try { deleteRoleButtonsForSource(db, botId, guildId, `message-templates.${req.params.id}`); } catch {}
    db.deleteMessageTemplate(botId, guildId, req.params.id);

    audit(req, 'template.delete', req.params.id, { name: prev.name });
    res.json({ ok: true });
  });

  return router;
}