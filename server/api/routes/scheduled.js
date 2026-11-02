// server/api/routes/scheduled.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import {
  scheduledCreateBody, scheduledUpdateBody, scheduledToggleBody,
} from '../../validators/schemas.js';
import { scheduledToDto } from '../dto/index.js';
import { mergeScheduledMessageConfig } from '../../../shared/scheduled-config.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { buildAllowedMentions } from '../../core/mentions.js';
import { retryDiscord } from '../../core/retry.js';

function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

async function resolveChannel(inst, guildId, channelId) {
  const guild = inst?.client?.guilds?.cache?.get(guildId);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId)
    || await inst.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

async function sendScheduledMessage(inst, guild, channel, messageConfig) {
  const tokens = {
    guild: guild.name,
    guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
    count: guild.memberCount || 0,
  };
  const components = buildComponentsFromConfig(messageConfig, tokens);
  if (!components?.length) return null;

  return retryDiscord(
    () => channel.send({
      flags: FLAG_COMPONENTS_V2,
      components,
      allowedMentions: buildAllowedMentions(components, { ping: false }),
    }),
    {
      maxAttempts: 3,
      baseDelayMs: 800,
      maxDelayMs: 8000,
      label: 'scheduled.send',
      logger: null,
      context: { bot_id: inst.client.user?.id, guild_id: guild.id },
    },
  );
}

export function scheduledRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const list = req.app.locals.db.listScheduled(req.bot.id, req.query.guildId);
    res.json(list.map(scheduledToDto));
  });

  router.get('/:id', requireBotAccess, (req, res) => {
    const item = req.app.locals.db.getScheduled(req.bot.id, req.query.guildId, req.params.id);
    if (!item) return res.status(404).json({ error: 'not_found' });
    res.json(scheduledToDto(item));
  });

  router.post('/', validateBody(scheduledCreateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, scheduledAt, messageConfig } = req.body;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    if (scheduledAt <= Math.floor(Date.now() / 1000) + 30) {
      return res.status(400).json({ error: 'scheduled_in_past' });
    }

    const channel = await resolveChannel(inst, guildId, channelId);
    if (!channel) return res.status(400).json({ error: 'invalid_channel' });

    const me = channel.guild.members.me;
    if (!channel.permissionsFor(me)?.has('SendMessages')) {
      return res.status(400).json({ error: 'no_send_permission' });
    }

    const normalized = mergeScheduledMessageConfig(messageConfig);
    const id = db.createScheduled(botId, guildId, {
      name, channelId, scheduledAt,
      messageConfig: normalized,
      enabled: true,
    });

    audit(req, 'scheduled.create', id, { name, channelId, scheduledAt });
    res.json({ id });
  });

  router.put('/:id', validateBody(scheduledUpdateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, scheduledAt, messageConfig } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getScheduled(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    if (scheduledAt !== undefined && scheduledAt <= Math.floor(Date.now() / 1000) + 30) {
      return res.status(400).json({ error: 'scheduled_in_past' });
    }

    if (channelId !== undefined && channelId !== prev.channelId) {
      const inst = req.app.locals.botManager.get(botId);
      if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });
      const newChannel = await resolveChannel(inst, guildId, channelId);
      if (!newChannel) return res.status(400).json({ error: 'invalid_channel' });
    }

    const nextCfg = messageConfig !== undefined
      ? mergeScheduledMessageConfig(messageConfig)
      : undefined;

    db.updateScheduled(botId, guildId, id, {
      name, channelId, scheduledAt,
      messageConfig: nextCfg,
    });

    audit(req, 'scheduled.update', id, { name, channelId, scheduledAt });
    res.json({ ok: true });
  });

  router.post('/:id/toggle', validateBody(scheduledToggleBody), requireBotAccess, (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;
    const prev = db.getScheduled(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    db.setScheduledEnabled(botId, guildId, id, enabled);
    audit(req, 'scheduled.toggle', id, { enabled });
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getScheduled(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const id = db.createScheduled(botId, guildId, {
      name: `${prev.name} (копия)`,
      channelId: prev.channelId,
      scheduledAt: Math.max(
        prev.scheduledAt,
        Math.floor(Date.now() / 1000) + 3600,
      ),
      messageConfig: prev.messageConfig,
      enabled: false,
    });
    audit(req, 'scheduled.duplicate', id, { source: prev.id });
    res.json({ id });
  });

  router.post('/:id/send-now', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getScheduled(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const channel = await resolveChannel(inst, guildId, prev.channelId);
    if (!channel) return res.status(400).json({ error: 'invalid_channel' });

    try {
      const sent = await sendScheduledMessage(inst, channel.guild, channel, prev.messageConfig);
      if (!sent) return res.status(400).json({ error: 'empty_message' });

      db.markScheduledSent(botId, guildId, id, Math.floor(Date.now() / 1000));
      audit(req, 'scheduled.send_now', id, { messageId: sent.id });
      res.json({ ok: true, messageId: sent.id });
    } catch (err) {
      db.markScheduledError(botId, guildId, id, err.message);
      req.app.locals.logger.warn({ err, id }, 'scheduled: manual send failed');
      res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  router.delete('/:id', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getScheduled(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    db.deleteScheduled(botId, guildId, req.params.id);
    audit(req, 'scheduled.delete', req.params.id, { name: prev.name });
    res.json({ ok: true });
  });

  return router;
}