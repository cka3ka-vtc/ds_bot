// server/api/routes/commands.js
import { Router } from 'express';
import { EmbedBuilder } from 'discord.js';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { syncGuildCommands, sanitizeCommandName } from '../../core/commandSync.js';
import { BUILTIN_COMMANDS, isReservedCommandName } from '../../../shared/builtin-commands.js';
import { validateBody } from '../validate.js';
import {
  commandCreateBody,
  commandUpdateBody,
  commandToggleBody,
  commandTestBody,
} from '../../validators/schemas.js';
import { testMessageLimiter } from '../middleware/rate-limit.js';

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

  /* ─── Список ─── */
  router.get('/', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;

    const enabled = db.getEnabledModules(botId, guildId);
    const enabledSet = new Set(enabled);

    const builtin = BUILTIN_COMMANDS
      .filter((c) => enabledSet.has(c.moduleKey))
      .map((c) => ({
        id: 'bi_' + c.name,
        name: c.name,
        description: c.description,
        category: c.category,
        moduleKey: c.moduleKey,
        type: 'functional',
        enabled: true,
      }));

    const custom = db.getCustomCommands(botId, guildId);

    res.json({ builtin, custom });
  });

  /* ─── Проверка имени ─── */
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

  /* ─── Создание ─── */
  router.post('/', validateBody(commandCreateBody), requireBotAccess, async (req, res) => {
    const {
      botId, guildId, name,
      description, response,
      channelsMode, channels, cooldownSeconds,
      requireRoles, excludeRoles,
      ephemeral, responseMode, responseEmbedColor,
    } = req.body;

    const sanitized = sanitizeCommandName(name);
    if (!sanitized || sanitized.length < 2) {
      return res.status(400).json({ error: 'invalid_name', message: 'Имя: 2-32 символа, буквы/цифры/_-' });
    }
    if (isReservedCommandName(sanitized)) {
      return res.status(409).json({ error: 'reserved_name', message: 'Это имя зарезервировано за встроенной командой' });
    }

    const db = req.app.locals.db;
    const existing = db.getCustomCommands(botId, guildId).find((c) => c.name === sanitized);
    if (existing) {
      return res.status(409).json({ error: 'duplicate_name', message: 'Команда с таким именем уже существует' });
    }

    // Whitelist без каналов == никогда не работает. Blacklist без каналов == везде.
    // Нормализуем: whitelist с пустым списком превращаем в 'all', чтобы не было «мёртвой» команды.
    const normalizedChannelsMode =
      channelsMode === 'whitelist' && (!channels || channels.length === 0) ? 'all' : channelsMode;

    const id = db.createCustomCommand(botId, guildId, {
      name: sanitized,
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
    });
    audit(req, 'command.create', id, { name: sanitized });

    syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ id, name: sanitized });
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
      const sanitized = sanitizeCommandName(name);
      if (!sanitized || sanitized.length < 2) {
        return res.status(400).json({ error: 'invalid_name', message: 'Имя: 2-32 символа' });
      }
      if (isReservedCommandName(sanitized)) {
        return res.status(409).json({ error: 'reserved_name', message: 'Это имя зарезервировано за встроенной командой' });
      }
      const existing = db.getCustomCommands(botId, guildId)
        .find((c) => c.name === sanitized && c.id !== id);
      if (existing) {
        return res.status(409).json({ error: 'duplicate_name', message: 'Команда с таким именем уже существует' });
      }
      newName = sanitized;
    }

    // Нормализация whitelist
    if (rest.channelsMode === 'whitelist' && Array.isArray(rest.channels) && rest.channels.length === 0) {
      rest.channelsMode = 'all';
    }

    db.updateCustomCommand(botId, guildId, id, { name: newName, ...rest });
    audit(req, 'command.update', id, { name: newName });
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
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
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
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
    await syncGuildCommands(ctx(req), botId, guildId).catch(() => {});
    res.json({ ok: true });
  });

  /* ─── Тест ответа ─── */
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

      const inst = req.app.locals.botManager.get(botId);
      if (!inst?.client?.isReady()) return res.status(503).json({ error: 'bot_offline' });

      const guild = inst.client.guilds.cache.get(guildId);
      if (!guild) return res.status(400).json({ error: 'invalid_channel' });

      const channel = await inst.client.channels.fetch(channelId).catch(() => null);
      if (!channel?.isTextBased?.() || channel.guild.id !== guildId) {
        return res.status(400).json({ error: 'invalid_channel' });
      }

      try {
        if (cmd.responseMode === 'embed') {
          const embed = new EmbedBuilder()
            .setColor(cmd.responseEmbedColor || '#5865F2')
            .setDescription(cmd.response || '✅ Команда выполнена');
          await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
        } else {
          await channel.send({
            content: cmd.response || '✅ Команда выполнена',
            allowedMentions: { parse: [] },
          });
        }
        audit(req, 'command.test', cmd.id, { channelId });
        res.json({ ok: true });
      } catch (err) {
        res.status(500).json({ error: 'send_failed', details: err.message });
      }
    },
  );

  return router;
}