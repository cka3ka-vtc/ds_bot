import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';
import { validateBody, validateQuery } from '../validate.js';
import { modActionsQuery, modActionCreateBody } from '../../validators/schemas.js';
import { modActionToDto } from '../dto/index.js';

export function moderationRouter() {
  const router = Router();
  router.use(requireAuth);

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
      const id = req.app.locals.db.addModAction({
        botId, guildId, userId, kind, reason,
        moderatorId: req.user.id, expiresAt,
      });
      res.json({ id });
    },
  );

  router.delete('/actions/:id', requireBotAccess, (req, res) => {
    // Защита: нельзя удалить чужую запись
    const row = req.app.locals.db.getModAction(req.params.id);
    if (!row || row.bot_id !== req.bot.id || row.guild_id !== req.guild.id) {
      return res.status(404).json({ error: 'not_found' });
    }
    req.app.locals.db.removeModAction(req.params.id);
    res.json({ ok: true });
  });

  return router;
}