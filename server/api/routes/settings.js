// server/api/routes/settings.js
import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function settingsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', requireBotAccess, (req, res) => {
    const { botId, guildId } = req.query;
    res.json(req.app.locals.db.getGuildSettings(botId, guildId));
  });

  router.put('/', requireBotAccess, (req, res) => {
    const { botId, guildId, language, welcomeChannel, logChannel, excludedRoles } = req.body;
    req.app.locals.db.setGuildSettings(botId, guildId, {
      language, welcomeChannel, logChannel, excludedRoles,
    });
    res.json({ ok: true });
  });

  return router;
}