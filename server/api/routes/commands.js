// server/api/routes/commands.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { syncGuildCommands, sanitizeCommandName } from '../../core/commandSync.js';
import { BUILTIN_COMMANDS, isReservedCommandName } from '../../../shared/builtin-commands.js';
import { validateBody } from '../validate.js';
import { commandCreateBody, commandUpdateBody, commandToggleBody } from '../../validators/schemas.js';

function ctx(req) {
  return {
    db: req.app.locals.db,
    botManager: req.app.locals.botManager,
    logger: req.app.locals.logger,
  };
}

function audit(req, action, target, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.query.botId || req.body?.botId,
    guildId: req.query.guildId || req.body?.guildId,
    action, target, meta,
    ip: req.ip,
  });
}

export function commandsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;

    const enabled = db.getEnabledModules(botId, guildId);
    const builtin = BUILTIN_COMMANDS
      .filter((c) => enabled.includes(c.moduleKey))
      .map((c) => ({
        id: 'bi_' + c.name,
        name: c.name,
        description: c.description,
        category: c.category,
        type: 'functional',
        enabled: true,
      }));

    const custom = db.getCustomCommands(botId, guildId).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      type: c.type,
      response: c.response,
      enabled: !!c.enabled,
    }));

    res.json({ builtin, custom });
  });

  router.get('/check', requireBotAccess, (req, res) => {
    const { botId, guildId, name, excludeId } = req.query;
    const sanitized = sanitizeCommandName(name);
    if (!sanitized) return res.json({ valid: false, error: 'invalid_name' });
    if (isReservedCommandName(sanitized)) {
      return res.json({ valid: false, error: 'reserved_name' });
    }

    const existing = req.app.locals.db
      .getCustomCommands(botId, guildId)
      .find((c) => c.name === sanitized && c.id !== excludeId);

    if (existing) return res.json({ valid: false, error: 'duplicate_name' });
    res.json({ valid: true, sanitized });
  });

  router.post('/', validateBody(commandCreateBody), requireBotAccess, (req, res) => {
    const { botId, guildId, name, description, response } = req.body;
    const sanitized = sanitizeCommandName(name);
    if (!sanitized || sanitized.length < 2) {
      return res.status(400).json({ error: 'invalid_name', message: 'Имя: 2-32 символа, буквы/цифры/_-' });
    }
    if (isReservedCommandName(sanitized)) {
      return res.status(409).json({ error: 'reserved_name', message: 'Это имя зарезервировано за встроенной командой' });
    }

    const existing = req.app.locals.db
      .getCustomCommands(botId, guildId)
      .find((c) => c.name === sanitized);
    if (existing) {
      return res.status(409).json({ error: 'duplicate_name', message: 'Команда с таким именем уже существует' });
    }

    const id = req.app.locals.db.createCustomCommand({
      botId, guildId, name: sanitized, description, response,
      type: 'custom', enabled: 1,
    });
    audit(req, 'command.create', id, { name: sanitized });

    syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ id, name: sanitized });
  });

  router.put('/:id', validateBody(commandUpdateBody), requireBotAccess, async (req, res) => {
    const { id } = req.params;
    const { botId, guildId, name, description, response, enabled } = req.body;

    const cmd = req.app.locals.db.getCustomCommand(id);
    if (!cmd || cmd.bot_id !== botId || cmd.guild_id !== guildId) {
      return res.status(404).json({ error: 'not_found' });
    }

    let newName = cmd.name;
    if (name !== undefined && name !== cmd.name) {
      const sanitized = sanitizeCommandName(name);
      if (!sanitized || sanitized.length < 2) {
        return res.status(400).json({ error: 'invalid_name', message: 'Имя: 2-32 символа' });
      }
      if (isReservedCommandName(sanitized)) {
        return res.status(409).json({ error: 'reserved_name', message: 'Это имя зарезервировано за встроенной командой' });
      }
      const existing = req.app.locals.db
        .getCustomCommands(botId, guildId)
        .find((c) => c.name === sanitized && c.id !== id);
      if (existing) {
        return res.status(409).json({ error: 'duplicate_name', message: 'Команда с таким именем уже существует' });
      }
      newName = sanitized;
    }

    req.app.locals.db.updateCustomCommand(id, { name: newName, description, response, enabled });
    audit(req, 'command.update', id, { name: newName });
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true, name: newName });
  });

  router.delete('/:id', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const cmd = req.app.locals.db.getCustomCommand(req.params.id);
    if (!cmd || cmd.bot_id !== botId || cmd.guild_id !== guildId) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.app.locals.db.deleteCustomCommand(req.params.id);
    audit(req, 'command.delete', req.params.id, { name: cmd.name });
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true });
  });

  router.post('/:id/toggle', validateBody(commandToggleBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const cmd = req.app.locals.db.getCustomCommand(req.params.id);
    if (!cmd || cmd.bot_id !== botId || cmd.guild_id !== guildId) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.app.locals.db.updateCustomCommand(req.params.id, { enabled: !!enabled });
    audit(req, 'command.toggle', req.params.id, { enabled: !!enabled });
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true });
  });

  return router;
}