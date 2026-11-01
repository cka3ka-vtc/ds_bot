// server/api/routes/commands/custom.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateBody } from '../../validate.js';
import {
  commandCreateBody,
  commandUpdateBody,
  commandToggleBody,
} from '../../../validators/schemas.js';
import {
  sanitizeCommandName,
  scheduleGuildCommandsSync,
} from '../../../core/commandSync.js';
import { BUILTIN_DEFAULTS } from '../../../core/builtin-command.js';
import { BUILTIN_COMMANDS } from '../../../../shared/builtin-commands.js';
import { ctx, audit, validateCommandName } from './_shared.js';

export function createCustomRouter() {
  const router = Router();

  /* ─── Список (builtin + custom) ─── */
  router.get('/', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;

    const enabled = db.getEnabledModules(botId, guildId);
    const enabledSet = new Set(enabled);

    const builtinSettings = db.getAllBuiltinSettings(botId, guildId);

    const builtinList = BUILTIN_COMMANDS
      .filter((c) => enabledSet.has(c.moduleKey))
      .map((c) => {
        const s = { ...BUILTIN_DEFAULTS, ...(builtinSettings[c.name] || {}) };
        return {
          id: 'bi_' + c.name,
          name: c.name,
          description: s.description || c.description,
          defaultDescription: c.description,
          category: c.category,
          moduleKey: c.moduleKey,
          icon: c.icon,
          color: c.color,
          type: 'builtin',
          enabled: s.enabled !== false,
          cooldownSeconds: s.cooldownSeconds | 0,
          channelsMode: s.channelsMode,
          channels: s.channels,
          requireRoles: s.requireRoles,
          excludeRoles: s.excludeRoles,
          ephemeral: s.ephemeral !== false,
        };
      });

    const custom = db.getCustomCommands(botId, guildId);

    res.json({ builtin: builtinList, custom });
  });

  /* ─── Создание ─── */
  router.post('/', validateBody(commandCreateBody), requireBotAccess, async (req, res) => {
    const {
      botId, guildId, name,
      description, response,
      channelsMode, channels, cooldownSeconds,
      requireRoles, excludeRoles,
      ephemeral, responseMode, responseEmbedColor, messageConfig,
    } = req.body;

    const db = req.app.locals.db;

    const check = validateCommandName(db, botId, guildId, name, {
      minLength: 2,
      includeMessage: true,
    });
    if (!check.ok) {
      const status = check.error === 'invalid_name' ? 400 : 409;
      return res.status(status).json({ error: check.error, message: check.message });
    }

    const normalizedChannelsMode =
      channelsMode === 'whitelist' && (!channels || channels.length === 0) ? 'all' : channelsMode;

    const id = db.createCustomCommand(botId, guildId, {
      name: check.sanitized,
      description,
      response,
      type: 'custom',
      enabled: 1,
      channelsMode: normalizedChannelsMode,
      channels: channels || [],
      cooldownSeconds: cooldownSeconds || 0,
      requireRoles: requireRoles || [],
      excludeRoles: excludeRoles || [],
      ephemeral: !!ephemeral,
      responseMode: responseMode || 'text',
      responseEmbedColor: responseEmbedColor || '#5865F2',
      messageConfig: messageConfig || {},
    });
    audit(req, 'command.create', id, { name: check.sanitized });

    scheduleGuildCommandsSync(ctx(req), botId, guildId);
    res.json({ id, name: check.sanitized });
  });

  /* ─── Обновление ─── */
  router.put('/:id', validateBody(commandUpdateBody), requireBotAccess, async (req, res) => {
    const { id } = req.params;
    const { botId, guildId, name, ...rest } = req.body;
    const db = req.app.locals.db;

    const cmd = db.getCustomCommand(botId, guildId, id);
    if (!cmd) return res.status(404).json({ error: 'not_found' });

    let newName = cmd.name;
    if (name !== undefined && name !== cmd.name) {
      const check = validateCommandName(db, botId, guildId, name, {
        excludeId: id,
        minLength: 2,
        includeMessage: true,
      });
      if (!check.ok) {
        const status = check.error === 'invalid_name' ? 400 : 409;
        return res.status(status).json({ error: check.error, message: check.message });
      }
      newName = check.sanitized;
    }

    if (rest.channelsMode === 'whitelist' && Array.isArray(rest.channels) && rest.channels.length === 0) {
      rest.channelsMode = 'all';
    }

    db.updateCustomCommand(botId, guildId, id, { name: newName, ...rest });
    audit(req, 'command.update', id, { name: newName });
    scheduleGuildCommandsSync(ctx(req), botId, guildId);
    res.json({ ok: true, name: newName });
  });

  /* ─── Удаление ─── */
  router.delete('/:id', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const cmd = db.getCustomCommand(botId, guildId, req.params.id);
    if (!cmd) return res.status(404).json({ error: 'not_found' });

    db.deleteCustomCommand(botId, guildId, req.params.id);
    audit(req, 'command.delete', req.params.id, { name: cmd.name });
    scheduleGuildCommandsSync(ctx(req), botId, guildId);
    res.json({ ok: true });
  });

  /* ─── Toggle ─── */
  router.post('/:id/toggle', validateBody(commandToggleBody), requireBotAccess, async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const db = req.app.locals.db;
    const cmd = db.getCustomCommand(botId, guildId, req.params.id);
    if (!cmd) return res.status(404).json({ error: 'not_found' });

    db.updateCustomCommand(botId, guildId, req.params.id, { enabled: !!enabled });
    audit(req, 'command.toggle', req.params.id, { enabled: !!enabled });
    scheduleGuildCommandsSync(ctx(req), botId, guildId);
    res.json({ ok: true });
  });

  return router;
}