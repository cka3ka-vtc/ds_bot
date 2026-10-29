// server/api/routes/modules.js
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import { moduleToggleBody, moduleConfigBody, greetingsTestBody } from '../../validators/schemas.js';
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from '../../core/componentsBuilder.js';
import { getNonBotMemberCount } from '../../core/guildCounts.js';
import { configCache } from '../../core/config-cache.js';
import { syncGuildCommands } from '../../core/commandSync.js';
import { BUILTIN_COMMANDS } from '../../../shared/builtin-commands.js';
import { testMessageLimiter } from '../middleware/rate-limit.js';

function audit(req, action, meta) {
  req.app.locals.db.addAudit({
    userId: req.user.id,
    botId: req.body?.botId || req.query.botId,
    guildId: req.body?.guildId || req.query.guildId,
    action, meta,
    ip: req.ip,
  });
}

function channelBelongs(guild, channelId) {
  if (!guild || !channelId) return false;
  return !!guild.channels.cache.get(channelId);
}

export function modulesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireBotAccess);

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('shared/modules.manifest.json'), 'utf8'),
  );

  /* ─── GET /api/modules — список модулей с состоянием ─── */
  router.get('/', (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;

    // Инициализируем записи «включено = 0» для всех модулей, если их ещё нет
    const created = db.ensureModuleDefaults(botId, guildId, manifest.modules);
    if (created > 0) {
      logger.info(
        { botId, guildId, created },
        'modules: initialized defaults (all disabled) for guild',
      );
    }

    const states = db.getModuleStates(botId, guildId);
    const stateMap = Object.fromEntries(states.map((s) => [s.module_key, !!s.enabled]));

    res.json(manifest.modules.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      icon: m.icon,
      color: m.color,
      category: m.category,
      version: m.version,
      enabled: stateMap[m.key] === true, // ← строго из БД, без defaultEnabled
      configSchema: m.configSchema,
    })));
  });

  /* ─── POST /api/modules/:key/toggle — включить/выключить ─── */
  router.post('/:key/toggle', validateBody(moduleToggleBody), async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const { key } = req.params;

    const mod = manifest.modules.find((m) => m.key === key);
    if (!mod) return res.status(404).json({ error: 'unknown_module' });

    req.app.locals.db.setModuleEnabled(botId, guildId, key, !!enabled);
    configCache.invalidateGuild(botId, guildId);
    audit(req, 'module.toggle', { key, enabled: !!enabled });

    req.app.locals.logger.info({ botId, guildId, key, enabled: !!enabled }, 'module toggled');

    // Если у модуля есть builtin-команды, сразу синхронизируем их с Discord
    const hasBuiltins = BUILTIN_COMMANDS.some((c) => c.moduleKey === key);
    if (hasBuiltins) {
      syncGuildCommands({
        db: req.app.locals.db,
        botManager: req.app.locals.botManager,
        logger: req.app.locals.logger,
      }, botId, guildId).catch((err) => {
        req.app.locals.logger.warn({ err, botId, guildId, key }, 'post-toggle command sync failed');
      });
    }

    res.json({ ok: true });
  });

  /* ─── GET /api/modules/:key/config ─── */
  router.get('/:key/config', (req, res) => {
    const { botId, guildId } = req.query;
    const { key } = req.params;
    res.json(req.app.locals.db.getModuleConfig(botId, guildId, key));
  });

  /* ─── PUT /api/modules/:key/config ─── */
  router.put('/:key/config', validateBody(moduleConfigBody), (req, res) => {
    const { botId, guildId, config } = req.body;
    const { key } = req.params;

    // Проверяем, что все channelId из конфига принадлежат этой гильдии
    const inst = req.app.locals.botManager.get(botId);
    if (inst?.client?.isReady?.()) {
      const guild = inst.client.guilds.cache.get(guildId);
      if (guild) {
        const channelIds = [];
        if (config?.channelId) channelIds.push(config.channelId);
        if (config?.announceChannelId) channelIds.push(config.announceChannelId);
        if (Array.isArray(config?.excludedChannels)) channelIds.push(...config.excludedChannels);
        for (const chId of channelIds) {
          if (!channelBelongs(guild, chId)) {
            return res.status(400).json({
              error: 'invalid_channel',
              message: `Канал ${chId} не принадлежит этому серверу`,
            });
          }
        }
      }
    }

    req.app.locals.db.setModuleConfig(botId, guildId, key, config || {});
    configCache.invalidateModule(botId, guildId, key);
    audit(req, 'module.config.update', { key });
    res.json({ ok: true });
  });

  /* ─── Тест сообщения «Приветствия» ─── */
  router.post('/greetings/test', testMessageLimiter, validateBody(greetingsTestBody), async (req, res) => {
    const { botId, guildId, which, messageConfig } = req.body;

    const db = req.app.locals.db;
    const botManager = req.app.locals.botManager;

    const stored = db.getModuleConfig(botId, guildId, 'greetings');
    const channelId = req.body.channelId || stored?.config?.channelId;
    if (!channelId) return res.status(400).json({ error: 'no_channel' });

    const inst = botManager.get(botId);
    if (!inst?.client?.isReady?.()) {
      return res.status(503).json({ error: 'bot_offline' });
    }

    const guild = inst.client.guilds.cache.get(guildId);
    if (!guild) return res.status(400).json({ error: 'invalid_channel' });

    const channel = await inst.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.() || channel.guild.id !== guildId) {
      return res.status(400).json({ error: 'invalid_channel' });
    }

    const user = req.user;
    let displayName = user.username;
    let avatarUrl = '';
    try {
      const member = await guild.members.fetch(user.id);
      displayName = member.displayName || user.username;
      avatarUrl = member.user.displayAvatarURL?.({ size: 128 }) || '';
    } catch {
      if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
      }
    }

    const nonBotCount = await getNonBotMemberCount(guild);

    const tokens = {
      user: `<@${user.id}>`,
      mention: `<@${user.id}>`,
      username: user.username,
      displayName,
      avatarUrl,
      guild: guild.name,
      count: nonBotCount,
      guildIconUrl: guild.iconURL?.({ size: 128 }) || '',
      section: 'greetings',
    };

    let components;
    try {
      components = buildComponentsFromConfig(messageConfig, tokens);
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId }, 'greetings: test build failed');
      return res.status(500).json({ error: 'build_failed' });
    }
    if (!components?.length) return res.status(400).json({ error: 'empty_message' });

    try {
      const msg = await channel.send({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: { parse: [] },
      });
      audit(req, 'module.greetings.test', { which, channelId });
      req.app.locals.logger.info(
        { botId, guildId, channelId, which, userId: user.id, messageId: msg.id },
        'greetings: test message sent',
      );
      return res.json({ ok: true, messageId: msg.id });
    } catch (err) {
      req.app.locals.logger.warn({ err, botId, guildId, which }, 'greetings: test send failed');
      return res.status(500).json({ error: 'send_failed', details: err.message });
    }
  });

  return router;
}