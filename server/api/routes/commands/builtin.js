// server/api/routes/commands/builtin.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateBody } from '../../validate.js';
import { builtinCommandUpdateBody } from '../../../validators/schemas.js';
import { scheduleGuildCommandsSync } from '../../../core/commandSync.js';
import { BUILTIN_DEFAULTS } from '../../../core/builtin-command.js';
import { getBuiltinCommand } from '../../../../shared/builtin-commands.js';
import { configCache } from '../../../core/config-cache.js';
import { ctx, audit } from './_shared.js';

export function createBuiltinRouter() {
  const router = Router();

  router.get('/builtin/:name', requireBotAccess, (req, res) => {
    const name = req.params.name;
    const meta = getBuiltinCommand(name);
    if (!meta) return res.status(404).json({ error: 'not_found' });

    const { botId, guildId } = req.query;
    const db = req.app.locals.db;
    const settings = db.getBuiltinSettings(botId, guildId, name);

    res.json({
      id: 'bi_' + name,
      name,
      description: settings.description || meta.description,
      defaultDescription: meta.description,
      category: meta.category,
      moduleKey: meta.moduleKey,
      icon: meta.icon,
      color: meta.color,
      type: 'builtin',
      enabled: settings.enabled !== false,
      cooldownSeconds: settings.cooldownSeconds | 0,
      channelsMode: settings.channelsMode,
      channels: settings.channels,
      requireRoles: settings.requireRoles,
      excludeRoles: settings.excludeRoles,
      ephemeral: settings.ephemeral !== false,
    });
  });

  router.put('/builtin/:name', validateBody(builtinCommandUpdateBody), requireBotAccess, async (req, res) => {
    const name = req.params.name;
    if (!getBuiltinCommand(name)) return res.status(404).json({ error: 'not_found' });

    const { botId, guildId, ...rest } = req.body;
    const db = req.app.locals.db;

    const cur = db.getBuiltinSettings(botId, guildId, name);
    const merged = { ...BUILTIN_DEFAULTS, ...cur, ...rest };
    db.upsertBuiltinSettings(botId, guildId, name, merged);

    // Конфиг builtin-команды изменился, но enabled-кэш модулей — нет.
    // Инвалидируем только сам builtin (в кэше хранится через getAllBuiltinSettings
    // напрямую из БД, поэтому здесь инвалидация не нужна — но если в будущем
    // закэшируем getAllBuiltinSettings, точка расширения уже готова).

    /* Синхронизация daily ↔ levels.config.dailyEnabled.
       Меняем levels.config (поле dailyEnabled) — значит инвалидируем
       конфиг 'levels'. Enabled-кэш тоже не помешает сбросить (levels
       может быть выключен/включён в зависимости от daily). */
    if (name === 'daily' && rest.enabled !== undefined) {
      try {
        const levelsCfg = db.getModuleConfig(botId, guildId, 'levels');
        const nextCfg = {
          ...(levelsCfg?.config || {}),
          dailyEnabled: !!rest.enabled,
        };
        db.setModuleConfig(botId, guildId, 'levels', nextCfg);

        // Точечно: конфиг levels изменился → invalidateModule('levels').
        // enabled-кэш (список включённых модулей) не менялся — levels
        // остаётся enabled/disabled как был, меняется только конфиг.
        configCache.invalidateModule(botId, guildId, 'levels');
      } catch (err) {
        req.app.locals.logger.warn({ err, botId, guildId }, 'daily sync to levels.config failed');
      }
    }

    audit(req, 'command.builtin.update', name, rest);

    scheduleGuildCommandsSync(ctx(req), botId, guildId);

    res.json({ ok: true });
  });

  return router;
}