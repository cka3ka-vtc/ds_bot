// server/api/routes/modules/crud.js
import { Router } from 'express';
import { validateBody } from '../../validate.js';
import { moduleToggleBody, moduleConfigBody } from '../../../validators/schemas.js';
import { configCache } from '../../../core/config-cache.js';
import { scheduleGuildCommandsSync } from '../../../core/commandSync.js';
import { BUILTIN_COMMANDS } from '../../../../shared/builtin-commands.js';
import { persistMessagesRoleButtons } from '../../../core/role-buttons-persist.js';
import { audit, channelBelongs } from './_shared.js';

async function clearModerationRegexCache() {
  try {
    const mod = await import('../../../modules/moderation/filters.js');
    mod?.clearCompiledCache?.();
  } catch {}
}

export function createCrudRouter(manifest) {
  const router = Router();

  router.get('/', (req, res) => {
    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const logger = req.app.locals.logger;

    const created = db.ensureModuleDefaults(botId, guildId, manifest.modules);
    if (created > 0) {
      logger.info({ botId, guildId, created }, 'modules: initialized defaults');
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

  router.post('/:key/toggle', validateBody(moduleToggleBody), async (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const { key } = req.params;

    const mod = manifest.modules.find((m) => m.key === key);
    if (!mod) return res.status(404).json({ error: 'unknown_module' });

    req.app.locals.db.setModuleEnabled(botId, guildId, key, !!enabled);

    configCache.invalidateEnabled(botId, guildId);
    configCache.invalidateModule(botId, guildId, key);

    if (key === 'moderation') {
      await clearModerationRegexCache();
    }

    audit(req, 'module.toggle', { key, enabled: !!enabled });

    const hasBuiltins = BUILTIN_COMMANDS.some((c) => c.moduleKey === key);
    if (hasBuiltins) {
      scheduleGuildCommandsSync(
        { db: req.app.locals.db, botManager: req.app.locals.botManager, logger: req.app.locals.logger },
        botId, guildId,
      );
    }

    res.json({ ok: true });
  });

  router.get('/:key/config', (req, res) => {
    const { botId, guildId } = req.query;
    const { key } = req.params;
    res.json(req.app.locals.db.getModuleConfig(botId, guildId, key));
  });

  router.put('/:key/config', validateBody(moduleConfigBody), async (req, res) => {
    const { botId, guildId, config } = req.body;
    const { key } = req.params;

    const db = req.app.locals.db;
    const logger = req.app.locals.logger;

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

    db.setModuleConfig(botId, guildId, key, config || {});
    configCache.invalidateModule(botId, guildId, key);

    // 🆕 сохраняем role-buttons из сообщений модуля
    if (key === 'greetings' || key === 'levels' || key === 'birthdays') {
      try {
        persistMessagesRoleButtons(db, botId, guildId, key, config?.messages);
      } catch (err) {
        logger.warn({ err, botId, guildId, key }, 'crud: persist role-buttons failed');
      }
    }

    if (key === 'moderation') {
      await clearModerationRegexCache();
    }

    audit(req, 'module.config.update', { key });

    if (key === 'levels' && config && typeof config === 'object') {
      const dailyEnabled = config.dailyEnabled !== false;
      try {
        const cur = db.getBuiltinSettings(botId, guildId, 'daily');
        if (!cur || cur.enabled !== dailyEnabled) {
          db.upsertBuiltinSettings(botId, guildId, 'daily', {
            enabled: dailyEnabled,
            description: cur?.description || '',
            cooldownSeconds: cur?.cooldownSeconds || 0,
            channelsMode: cur?.channelsMode || 'all',
            channels: cur?.channels || [],
            requireRoles: cur?.requireRoles || [],
            excludeRoles: cur?.excludeRoles || [],
            ephemeral: cur?.ephemeral !== false,
          });

          configCache.invalidateModule(botId, guildId, 'daily');

          scheduleGuildCommandsSync(
            { db, botManager: req.app.locals.botManager, logger },
            botId, guildId,
          );
          logger.info({ botId, guildId, dailyEnabled }, 'levels: daily command synced with dailyEnabled');
        }
      } catch (err) {
        logger.warn({ err, botId, guildId }, 'daily sync from levels.config failed');
      }
    }

    res.json({ ok: true });
  });

  return router;
}