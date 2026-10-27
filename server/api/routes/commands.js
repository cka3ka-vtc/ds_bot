// server/api/routes/commands.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { syncGuildCommands, sanitizeCommandName } from '../../core/commandSync.js';

/** Встроенные команды, которые предоставляют модули */
const BUILTIN_COMMANDS = [
  { name: 'rank',   description: 'Уровень и прогресс',  category: 'Утилиты',    moduleKey: 'levels' },
  { name: 'daily',  description: 'Ежедневная награда',  category: 'Утилиты',    moduleKey: 'levels' },
  { name: 'ticket', description: 'Создать тикет',        category: 'Утилиты',    moduleKey: 'tickets' },
  { name: 'ban',    description: 'Забанить участника',   category: 'Модерация',  moduleKey: 'moderation' },
  { name: 'mute',   description: 'Замьютить участника',  category: 'Модерация',  moduleKey: 'moderation' },
];

function ctx(req) {
  return {
    db: req.app.locals.db,
    botManager: req.app.locals.botManager,
    logger: req.app.locals.logger,
  };
}

export function commandsRouter() {
  const router = Router();
  router.use(requireAuth);

  /** GET /api/commands — список */
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

  /** GET /api/commands/check — проверка уникальности имени */
  router.get('/check', requireBotAccess, (req, res) => {
    const { botId, guildId, name, excludeId } = req.query;
    const sanitized = sanitizeCommandName(name);
    if (!sanitized) return res.json({ valid: false, error: 'invalid_name' });

    const existing = req.app.locals.db
      .getCustomCommands(botId, guildId)
      .find((c) => c.name === sanitized && c.id !== excludeId);

    if (existing) {
      return res.json({ valid: false, error: 'duplicate_name' });
    }
    res.json({ valid: true, sanitized });
  });

  /** POST /api/commands — создать */
  router.post('/', requireBotAccess, (req, res) => {
    const { botId, guildId, name, description, response } = req.body;
    const sanitized = sanitizeCommandName(name);
    if (!sanitized || sanitized.length < 2) {
      return res.status(400).json({ error: 'invalid_name', message: 'Имя: 2-32 символа, буквы/цифры/_-' });
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

    syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ id, name: sanitized });
  });

  /** PUT /api/commands/:id — обновить (включая переименование) */
  router.put('/:id', requireBotAccess, async (req, res) => {
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
      const existing = req.app.locals.db
        .getCustomCommands(botId, guildId)
        .find((c) => c.name === sanitized && c.id !== id);
      if (existing) {
        return res.status(409).json({ error: 'duplicate_name', message: 'Команда с таким именем уже существует' });
      }
      newName = sanitized;
    }

    req.app.locals.db.updateCustomCommand(id, {
      name: newName, description, response, enabled,
    });

    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true, name: newName });
  });

  /** DELETE /api/commands/:id */
  router.delete('/:id', requireBotAccess, async (req, res) => {
    const { botId, guildId } = req.query;
    const cmd = req.app.locals.db.getCustomCommand(req.params.id);
    if (!cmd || cmd.bot_id !== botId || cmd.guild_id !== guildId) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.app.locals.db.deleteCustomCommand(req.params.id);
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true });
  });

  /** POST /api/commands/:id/toggle */
  router.post('/:id/toggle', requireBotAccess, async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const cmd = req.app.locals.db.getCustomCommand(req.params.id);
    if (!cmd || cmd.bot_id !== botId || cmd.guild_id !== guildId) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.app.locals.db.updateCustomCommand(req.params.id, { enabled: !!enabled });
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true });
  });

  return router;
}