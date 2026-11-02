// server/api/routes/commands/check.js
import { Router } from 'express';
import { requireBotAccess } from '../../auth-middleware.js';
import { validateCommandName } from './_shared.js';

export function createCheckRouter() {
  const router = Router();

  router.get('/check', requireBotAccess, (req, res) => {
    const { botId, guildId, name, excludeId } = req.query;

    const result = validateCommandName(
      req.app.locals.db,
      botId,
      guildId,
      name,
      { excludeId, minLength: 1, includeMessage: false },
    );

    if (!result.ok) {
      return res.json({ valid: false, error: result.error });
    }
    res.json({ valid: true, sanitized: result.sanitized });
  });

  return router;
}