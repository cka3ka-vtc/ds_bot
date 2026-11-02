// server/api/routes/autodelete.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import {
  autodeleteCreateBody, autodeleteUpdateBody, autodeleteToggleBody,
} from '../../validators/schemas.js';
import { autodeleteToDto } from '../dto/index.js';
import { mergeAutodeleteRule } from '../../../shared/autodelete-config.js';

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

export function autodeleteRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const list = req.app.locals.db.listAutodeleteRules(req.bot.id, req.query.guildId);
    res.json(list.map(autodeleteToDto));
  });

  router.get('/:id', requireBotAccess, (req, res) => {
    const rule = req.app.locals.db.getAutodeleteRule(req.bot.id, req.query.guildId, req.params.id);
    if (!rule) return res.status(404).json({ error: 'not_found' });
    res.json(autodeleteToDto(rule));
  });

  router.post('/', validateBody(autodeleteCreateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, mode, delayValue, delayUnit } = req.body;
    const db = req.app.locals.db;
    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    const channel = await resolveChannel(inst, guildId, channelId);
    if (!channel) return res.status(400).json({ error: 'invalid_channel' });

    const me = channel.guild.members.me;
    if (!channel.permissionsFor(me)?.has('ManageMessages')) {
      return res.status(400).json({ error: 'no_manage_messages_permission' });
    }

    if (db.countEnabledAutodeleteForChannel(botId, guildId, channelId) > 0) {
      return res.status(409).json({ error: 'channel_already_has_rule' });
    }

    const normalized = mergeAutodeleteRule({ mode, delayValue, delayUnit });
    const id = db.createAutodeleteRule(botId, guildId, {
      name, channelId,
      mode: normalized.mode,
      delayValue: normalized.mode === 'after' ? normalized.delayValue : null,
      delayUnit: normalized.mode === 'after' ? normalized.delayUnit : null,
      enabled: true,
    });

    audit(req, 'autodelete.create', id, { name, channelId, mode: normalized.mode });
    res.json({ id });
  });

  router.put('/:id', validateBody(autodeleteUpdateBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, name, channelId, mode, delayValue, delayUnit } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getAutodeleteRule(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    const inst = req.app.locals.botManager.get(botId);
    if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

    if (channelId !== undefined && channelId !== prev.channelId) {
      const newChannel = await resolveChannel(inst, guildId, channelId);
      if (!newChannel) return res.status(400).json({ error: 'invalid_channel' });
      if (prev.enabled
        && db.countEnabledAutodeleteForChannel(botId, guildId, channelId, id) > 0) {
        return res.status(409).json({ error: 'channel_already_has_rule' });
      }
    }

    const normalized = mergeAutodeleteRule({
      mode: mode ?? prev.mode,
      delayValue: delayValue ?? prev.delayValue,
      delayUnit: delayUnit ?? prev.delayUnit,
    });

    db.updateAutodeleteRule(botId, guildId, id, {
      name,
      channelId,
      mode: normalized.mode,
      delayValue: normalized.mode === 'after' ? normalized.delayValue : null,
      delayUnit: normalized.mode === 'after' ? normalized.delayUnit : null,
    });

    // Очищаем pending в старом канале — при новой логике они уже неактуальны
    try {
      db.clearAutodeletePendingForChannel(botId, guildId, prev.channelId);
      if (channelId !== undefined && channelId !== prev.channelId) {
        db.clearAutodeletePendingForChannel(botId, guildId, channelId);
      }
    } catch {}

    audit(req, 'autodelete.update', id, { name, channelId, mode: normalized.mode });
    res.json({ ok: true });
  });

  router.post('/:id/toggle', validateBody(autodeleteToggleBody), requireBotAccess, (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getAutodeleteRule(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    if (enabled && db.countEnabledAutodeleteForChannel(botId, guildId, prev.channelId, id) > 0) {
      return res.status(409).json({ error: 'channel_already_has_rule' });
    }

    db.updateAutodeleteRule(botId, guildId, id, { enabled });
    if (!enabled) {
      try { db.clearAutodeletePendingForChannel(botId, guildId, prev.channelId); } catch {}
    }

    audit(req, 'autodelete.toggle', id, { enabled });
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const prev = db.getAutodeleteRule(botId, guildId, req.params.id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    // Копия создаётся выключенной — иначе UNIQUE constraint на канал.
    const id = db.createAutodeleteRule(botId, guildId, {
      name: `${prev.name} (копия)`,
      channelId: prev.channelId,
      mode: prev.mode,
      delayValue: prev.delayValue,
      delayUnit: prev.delayUnit,
      enabled: false,
    });
    audit(req, 'autodelete.duplicate', id, { source: prev.id });
    res.json({ id });
  });

  router.delete('/:id', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const id = req.params.id;

    const prev = db.getAutodeleteRule(botId, guildId, id);
    if (!prev) return res.status(404).json({ error: 'not_found' });

    try { db.clearAutodeletePendingForChannel(botId, guildId, prev.channelId); } catch {}
    db.deleteAutodeleteRule(botId, guildId, id);

    audit(req, 'autodelete.delete', id, { name: prev.name });
    res.json({ ok: true });
  });

  return router;
}