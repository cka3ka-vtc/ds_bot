import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function modulesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireBotAccess);

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('shared/modules.manifest.json'), 'utf8'),
  );

  /** Список модулей с состоянием включённости */
  router.get('/', (req, res) => {
    const { botId, guildId } = req.query;
    const states = req.app.locals.db.getModuleStates(botId, guildId);
    const stateMap = Object.fromEntries(states.map(s => [s.module_key, !!s.enabled]));

    res.json(manifest.modules.map(m => ({
      key: m.key,
      name: m.name,
      description: m.description,
      icon: m.icon,
      color: m.color,
      category: m.category,
      version: m.version,
      enabled: stateMap[m.key] ?? m.defaultEnabled ?? false,
      configSchema: m.configSchema,
    })));
  });

  /** Вкл/выкл */
  router.post('/:key/toggle', (req, res) => {
    const { botId, guildId, enabled } = req.body;
    const { key } = req.params;
    if (!manifest.modules.find(m => m.key === key)) {
      return res.status(404).json({ error: 'unknown_module' });
    }
    req.app.locals.db.setModuleEnabled(botId, guildId, key, !!enabled);
    req.app.locals.logger.info({ botId, guildId, key, enabled }, 'module toggled');
    res.json({ ok: true });
  });

  /** Конфиг */
  router.get('/:key/config', (req, res) => {
    const { botId, guildId } = req.query;
    const { key } = req.params;
    res.json(req.app.locals.db.getModuleConfig(botId, guildId, key));
  });

  router.put('/:key/config', (req, res) => {
    const { botId, guildId, config } = req.body;
    const { key } = req.params;
    req.app.locals.db.setModuleConfig(botId, guildId, key, config || {});
    res.json({ ok: true });
  });

  return router;
}