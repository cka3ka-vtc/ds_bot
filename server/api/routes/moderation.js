import { Router } from 'express';
import { requireAuth, requireBotAccess } from '../auth-middleware.js';

export function moderationRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/actions', requireBotAccess, (req, res) => {
    const { botId, guildId, kind } = req.query;
    res.json(req.app.locals.db.getModActions(botId, guildId, kind || null));
  });

  router.post('/actions', requireBotAccess, (req, res) => {
    const { botId, guildId, userId, kind, reason, durationMinutes } = req.body;
    if (!userId || !kind) return res.status(400).json({ error: 'userId_and_kind_required' });
    const expiresAt = durationMinutes ? Math.floor(Date.now() / 1000) + durationMinutes * 60 : null;
    const id = req.app.locals.db.addModAction({
      botId, guildId, userId, kind, reason,
      moderatorId: req.user.id, expiresAt,
    });
    res.json({ id });
  });

  router.delete('/actions/:id', requireBotAccess, (req, res) => {
    req.app.locals.db.removeModAction(req.params.id);
    res.json({ ok: true });
  });

  return router;
}