// server/api/routes/moderation.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody, validateQuery } from '../validate.js';
import {
  modActionsQuery, modActionCreateBody,
  moderationTestBody,
} from '../../validators/schemas.js';
import { modActionToDto } from '../dto/index.js';
import { configCache } from '../../core/config-cache.js';
import { mergeModerationConfig, FILTER_KEYS } from '../../../shared/moderation-config.js';
import { runModerationFilters } from '../../modules/moderation/test.js';

export function moderationRouter() {
  const router = Router();
  router.use(requireAuth);

  /* ═════════ Действия (существующие) ═════════ */

  router.get('/actions',
    validateQuery(modActionsQuery),
    requireBotAccess,
    (req, res) => {
      const { botId, guildId, kind } = req.validatedQuery;
      const rows = req.app.locals.db.getModActions(botId, guildId, kind || null);
      res.json(rows.map(modActionToDto));
    },
  );

  router.post('/actions',
    validateBody(modActionCreateBody),
    requireBotAccess,
    (req, res) => {
      const { botId, guildId, userId, kind, reason, durationMinutes } = req.body;
      const expiresAt = durationMinutes
        ? Math.floor(Date.now() / 1000) + durationMinutes * 60
        : null;
      const id = req.app.locals.db.addModAction(botId, guildId, {
        userId, kind, reason, moderatorId: req.user.id, expiresAt,
      });
      res.json({ id });
    },
  );

  router.delete('/actions/:id', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const row = req.app.locals.db.getModAction(botId, guildId, req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    req.app.locals.db.removeModAction(botId, guildId, req.params.id);
    res.json({ ok: true });
  });

  /* ═════════ Настройки модуля (новые) ═════════ */

  router.get('/config', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    const stored = req.app.locals.db.getModuleConfig(botId, guildId, 'moderation');
    res.json({
      enabled: !!stored.enabled,
      config: mergeModerationConfig(stored.config),
    });
  });

  router.put('/config', requireBotAccess, (req, res) => {
    const { botId, guildId, enabled, config } = req.body || {};
    if (!botId || !guildId) return res.status(400).json({ error: 'botId_guildId_required' });

    const normalized = mergeModerationConfig(config);
    req.app.locals.db.setModuleConfig(botId, guildId, 'moderation', normalized);
    if (typeof enabled === 'boolean') {
      req.app.locals.db.setModuleEnabled(botId, guildId, 'moderation', enabled);
    }
    configCache.invalidateModule(botId, guildId, 'moderation');
    configCache.invalidateEnabled(botId, guildId);

    try {
      req.app.locals.db.addAudit({
        userId: req.user.id, botId, guildId,
        action: 'moderation.config.update',
        meta: { enabled, filtersCount: Object.values(normalized.filters).filter(f => f.enabled).length },
        ip: req.ip,
      });
    } catch { /* ignore */ }

    res.json({ ok: true, enabled: !!enabled, config: normalized });
  });

  /* ═════════ Тест ═════════ */

  router.post('/test',
    validateBody(moderationTestBody),
    requireBotAccess,
    async (req, res) => {
      const { botId, guildId, text } = req.body;
      const stored = req.app.locals.db.getModuleConfig(botId, guildId, 'moderation');
      const cfg = mergeModerationConfig(stored.config);
      try {
        const hits = await runModerationFilters(cfg, text);
        res.json({ hits });
      } catch (err) {
        req.app.locals.logger.warn({ err }, 'moderation test failed');
        res.status(500).json({ error: 'test_failed' });
      }
    },
  );

  return router;
}