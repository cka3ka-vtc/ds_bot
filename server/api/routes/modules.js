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

  /* ─── GET /api/modules ─── */
  router.get('/', (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;

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
      enabled: stateMap[m.key] === true,
      configSchema: m.configSchema,
    })));
  });

  /* ─── POST /api/modules/:key/toggle ─── */
  router.post('/:key/toggle', validateBody(moduleToggleBody), async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const { key } = req.params;

    const mod = manifest.modules.find((m) => m.key === key);
    if (!mod) return res.status(404).json({ error: 'unknown_module' });

    req.app.locals.db.setModuleEnabled(botId, guildId, key, !!enabled);
    configCache.invalidateGuild(botId, guildId);
    audit(req, 'module.toggle', { key, enabled: !!enabled });

    req.app.locals.logger.info({ botId, guildId, key, enabled: !!enabled }, 'module toggled');

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

  /* ─── POST /api/modules/greetings/test ─── */
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

  /* ═══════════════════════════════════════════════════════════
     GET /api/modules/levels/debug

     Диагностика: что сервер видит про модуль «Уровни» для пары
     (botId, guildId). Помогает, если /daily говорит «отключён»,
     хотя в UI включён.

     Возвращает:
     - модуль: enabled + config-keys (без самих сообщений — они большие)
     - путь к БД (для ручной проверки)
     - список ботов, которые знают про эту гильдию
     - список встроенных команд, которые сейчас зарегистрированы
       для этого бота в Discord (реальный ответ API)
     ═══════════════════════════════════════════════════════════ */
  router.get('/levels/debug', async (req, res) => {
    try {
      const { botId, guildId } = req.query;
      const db = req.app.locals.db;
      const botManager = req.app.locals.botManager;

      // Состояние модуля в БД
      const cfg = db.getModuleConfig(botId, guildId, 'levels');

      // Путь к файлу БД (для ручной проверки через sqlite3)
      const dbPath = `data/guilds/${guildId}/${botId}.sqlite`;

      // Все боты, запущенные в botManager и знающие эту гильдию
      const botsKnowingGuild = [];
      for (const inst of botManager.all()) {
        if (!inst?.client?.isReady()) {
          botsKnowingGuild.push({
            botId: inst.id, ready: false, inGuild: null, applicationId: null,
          });
          continue;
        }
        const hasGuild = !!inst.client.guilds.cache.get(guildId);
        botsKnowingGuild.push({
          botId: inst.id,
          tag: inst.client.user?.tag || null,
          ready: true,
          inGuild: hasGuild,
          applicationId: inst.client.application?.id || null,
        });
      }

      // Что Discord реально знает про команды этого бота в этой гильдии
      let registeredCommands = null;
      let registeredCommandsError = null;
      const inst = botManager.get(botId);
      if (inst?.client?.isReady()) {
        const guild = inst.client.guilds.cache.get(guildId);
        if (guild) {
          try {
            const cmds = await guild.commands.fetch();
            registeredCommands = [...cmds.values()].map((c) => c.name);
          } catch (err) {
            registeredCommandsError = err.message;
          }
        } else {
          registeredCommandsError = 'guild_not_in_cache';
        }
      } else {
        registeredCommandsError = 'bot_not_ready';
      }

      // Все модули: enabled или нет
      const states = db.getModuleStates(botId, guildId);
      const modules = states.map((s) => ({
        key: s.module_key,
        enabled: !!s.enabled,
      }));

      // Сводка
      const diagnosis = [];
      if (!cfg.enabled) {
        diagnosis.push('⚠ В БД модуль levels ВЫКЛЮЧЕН для этой пары (botId, guildId).');
        diagnosis.push('  Если в UI он включён — попробуйте переключить и сохранить ещё раз.');
        diagnosis.push('  Или проверьте, не выбрана ли в UI другая гильдия/бот.');
      } else {
        diagnosis.push('✅ В БД модуль levels ВКЛЮЧЁН для этой пары (botId, guildId).');
      }

      if (Array.isArray(registeredCommands)) {
        const hasDaily = registeredCommands.includes('daily');
        const hasRank = registeredCommands.includes('rank');
        const hasLb = registeredCommands.includes('leaderboard');
        if (hasDaily && hasRank && hasLb) {
          diagnosis.push('✅ В Discord зарегистрированы /daily, /rank, /leaderboard для этого бота.');
        } else {
          diagnosis.push(`⚠ В Discord зарегистрировано: ${registeredCommands.join(', ') || '—'}`);
          diagnosis.push('  Если /daily отсутствует — выполните toggle модуля (выкл/вкл) или перезапустите бота.');
        }
      }

      if (botsKnowingGuild.length > 1) {
        diagnosis.push(`⚠ В боте ${botsKnowingGuild.length} инстансов. Если /daily зарегистрирован у нескольких — Discord может вызвать не того.`);
        diagnosis.push('  Проверьте, для какого бота в UI включён модуль, и какой бот на самом деле отвечает.');
      }

      res.json({
        botId,
        guildId,
        dbPath,
        levelConfig: {
          enabled: cfg.enabled,
          configKeys: Object.keys(cfg.config || {}),
          // НЕ возвращаем полные сообщения — они могут быть большими.
          // Но показываем, какие табы заполнены (hasMessageContent):
          filledTabs: ['levelUp', 'rank', 'leaderboard', 'daily'].filter(
            (k) => cfg.config?.messages?.[k] && Object.keys(cfg.config.messages[k]).length,
          ),
        },
        modules,
        bots: botsKnowingGuild,
        registeredCommands,
        registeredCommandsError,
        diagnosis,
      });
    } catch (err) {
      req.app.locals.logger.error({ err }, 'levels/debug failed');
      res.status(500).json({ error: 'internal_error', message: err.message });
    }
  });

  return router;
}