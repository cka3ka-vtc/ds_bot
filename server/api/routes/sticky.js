// server/api/routes/sticky.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import {
  stickyCreateBody, stickyUpdateBody, stickyToggleBody,
} from '../../validators/schemas.js';
import { stickyToDto } from '../dto/index.js';
import { mergeStickyConfig } from '../../../shared/sticky-config.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { buildAllowedMentions } from '../../core/mentions.js';
import { retryDiscord } from '../../core/retry.js';
import { audit } from '../_audit.js';
import {
  persistRoleButtonsFromConfig,
  deleteRoleButtonsForSource,
} from '../../core/role-buttons-persist.js';

function invalidateStickyCache(req, botId, guildId, channelId) {
  try {
    const mod = req.app.locals.registry?.get?.('sticky');
    mod?.invalidateChannelCache?.(botId, guildId, channelId);
  } catch {}
}

async function resolveChannel(inst, guildId, channelId) {
  const guild = inst?.client?.guilds?.cache?.get(guildId);
  if (!guild) return null;
  const channel = guild.channels.cache.get(channelId)
    || await inst.client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return null;
  return channel;
}

async function buildAndSendSticky(client, guild, channel, messageConfig) {
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
      label: 'sticky.send',
      logger: client.user ? { warn: () => {} } : null,
      context: { bot_id: client.user?.id, guild_id: guild.id },
    },
  );
}

async function deleteStickyMessage(client, channelId, messageId) {
  if (!messageId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return;
  const msg = await channel.messages.fetch(messageId).catch(() => null);
  if (msg) await msg.delete().catch(() => {});
}

export function stickyRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const list = req.app.locals.db.listSticky(req.bot.id, req.query.guildId);
    res.json(list.map(stickyToDto));
  });

  router.get('/:id', requireBotAccess, (req, res) => {
    const rule = req.app.locals.db.getSticky(req.bot.id, req.query.guildId, req.params.id);
    if (!rule) return res.status(404).json({ error: 'not_found' });
    res.json(stickyToDto(rule));
  });

  router.post('/', validateBody(stickyCreateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, messageConfig } = req.body;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const channel = await resolveChannel(inst, guildId, channelId);
    if (!channel) return res.status(400).json({ error: 'invalid_channel' });

    const me = channel.guild.members.me;
    if (!channel.permissionsFor(me)?.has('SendMessages')) {
      return res.status(400).json({ error: 'no_send_permission' });
    }

    if (db.countEnabledStickyForChannel(botId, guildId, channelId) > 0) {
      return res.status(409).json({ error: 'channel_already_has_sticky' });
    }

    const normalized = mergeStickyConfig(messageConfig);
    const id = db.createSticky(botId, guildId, {
      name, channelId,
      messageConfig: normalized,
      enabled: true,
    });

    // 🆕 сохраняем role-buttons из сообщения
    try {
      persistRoleButtonsFromConfig(db, botId, guildId, `sticky.${id}`, normalized);
    } catch (err) {
      req.app.locals.logger.warn({ err, id }, 'sticky: persist role-buttons failed');
    }

    let messageId = null;
    try {
      const sent = await buildAndSendSticky(inst.client, channel.guild, channel, normalized);
      if (sent?.id) {
        messageId = sent.id;
        db.setStickyLastMessage(botId, guildId, id, sent.id);
      }
    } catch (err) {
      req.app.locals.logger.warn({ err, id }, 'sticky: initial send failed');
    }

    invalidateStickyCache(req, botId, guildId, channelId);

    audit(req, 'sticky.create', id, { name, channelId, messageId });
    res.json({ id, lastMessageId: messageId });
  });

  router.put('/:id', validateBody(stickyUpdateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, messageConfig } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getSticky(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    let newChannel = null;
    if (channelId !== undefined && channelId !== prev.channelId) {
      newChannel = await resolveChannel(inst, guildId, channelId);
      if (!newChannel) return res.status(400).json({ error: 'invalid_channel' });
      if (prev.enabled
        && db.countEnabledStickyForChannel(botId, guildId, channelId, id) > 0) {
        return res.status(409).json({ error: 'channel_already_has_sticky' });
      }
    }

    const nextMessageConfig = messageConfig !== undefined
      ? mergeStickyConfig(messageConfig)
      : prev.messageConfig;

    db.updateSticky(botId, guildId, id, {
      name, channelId, messageConfig: nextMessageConfig,
    });

    // 🆕 сохраняем role-buttons
    try {
      persistRoleButtonsFromConfig(db, botId, guildId, `sticky.${id}`, nextMessageConfig);
    } catch (err) {
      req.app.locals.logger.warn({ err, id }, 'sticky: persist role-buttons failed');
    }

    try {
      const targetChannelId = channelId ?? prev.channelId;
      await deleteStickyMessage(inst.client, prev.channelId, prev.lastMessageId);

      if (prev.enabled) {
        const targetChannel = newChannel || await resolveChannel(inst, guildId, targetChannelId);
        if (targetChannel) {
          const sent = await buildAndSendSticky(
            inst.client, targetChannel.guild, targetChannel, nextMessageConfig,
          );
          if (sent?.id) {
            db.setStickyLastMessage(botId, guildId, id, sent.id);
          } else {
            db.setStickyLastMessage(botId, guildId, id, null);
          }
        }
      }
    } catch (err) {
      req.app.locals.logger.warn({ err, id }, 'sticky: resend after update failed');
    }

    invalidateStickyCache(req, botId, guildId, prev.channelId);
    if (channelId && channelId !== prev.channelId) {
      invalidateStickyCache(req, botId, guildId, channelId);
    }

    audit(req, 'sticky.update', id, { name, channelId });
    res.json({ ok: true });
  });

  router.post('/:id/toggle', validateBody(stickyToggleBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getSticky(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    if (enabled) {
      if (db.countEnabledStickyForChannel(botId, guildId, prev.channelId, id) > 0) {
        return res.status(409).json({ error: 'channel_already_has_sticky' });
      }
      db.updateSticky(botId, guildId, id, { enabled: true });

      try {
        const channel = await resolveChannel(inst, guildId, prev.channelId);
        if (channel) {
          const sent = await buildAndSendSticky(
            inst.client, channel.guild, channel, prev.messageConfig,
          );
          if (sent?.id) db.setStickyLastMessage(botId, guildId, id, sent.id);
        }
      } catch (err) {
        req.app.locals.logger.warn({ err, id }, 'sticky: enable send failed');
      }
    } else {
      db.updateSticky(botId, guildId, id, { enabled: false });
      try {
        await deleteStickyMessage(inst.client, prev.channelId, prev.lastMessageId);
        db.setStickyLastMessage(botId, guildId, id, null);
      } catch (err) {
        req.app.locals.logger.warn({ err, id }, 'sticky: disable delete failed');
      }
    }

    invalidateStickyCache(req, botId, guildId, prev.channelId);
    audit(req, 'sticky.toggle', id, { enabled });
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getSticky(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const id = db.createSticky(botId, guildId, {
      name: `${prev.name} (копия)`,
      channelId: prev.channelId,
      messageConfig: prev.messageConfig,
      enabled: false,
    });

    try {
      persistRoleButtonsFromConfig(db, botId, guildId, `sticky.${id}`, prev.messageConfig);
    } catch {}

    invalidateStickyCache(req, botId, guildId, prev.channelId);
    audit(req, 'sticky.duplicate', id, { source: prev.id });
    res.json({ id });
  });

  router.delete('/:id', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getSticky(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const inst = req.app.locals.botManager.get(botId);
    if (inst?.client?.isReady?.()) {
      try {
        await deleteStickyMessage(inst.client, prev.channelId, prev.lastMessageId);
      } catch (err) {
        req.app.locals.logger.warn({ err, id }, 'sticky: delete message failed');
      }
    }

    try { deleteRoleButtonsForSource(db, botId, guildId, `sticky.${id}`); } catch {}
    db.deleteSticky(botId, guildId, id);
    invalidateStickyCache(req, botId, guildId, prev.channelId);

    audit(req, 'sticky.delete', id, { name: prev.name });
    res.json({ ok: true });
  });

  return router;
}