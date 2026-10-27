import { Router } from 'express';
import { requireAuth } from '../auth-middleware.js';
import { validateBody } from '../validate.js';
import { addBotBody } from '../../validators/schemas.js';
import { botToDto } from '../dto/index.js';

export function botsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const rows = req.app.locals.db.getBotsForUser(req.user.id);
    res.json(rows.map(botToDto));
  });

  router.post('/', validateBody(addBotBody), async (req, res, next) => {
    try {
      const bot = await req.app.locals.botManager.addUserBot({
        token: req.body.token, ownerId: req.user.id,
      });
      res.json(bot);
    } catch (err) {
      req.app.locals.logger.error({ err }, 'add bot failed');
      res.status(400).json({ error: 'invalid_token', details: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await req.app.locals.botManager.removeUserBot(req.params.id, req.user.id);
      res.json({ ok: true });
    } catch (err) {
      const map = {
        bot_not_found: [404, 'bot_not_found'],
        cannot_remove_main: [400, 'cannot_remove_main'],
        forbidden: [403, 'forbidden'],
      };
      const [status, code] = map[err.message] || [500, 'unknown'];
      res.status(status).json({ error: code });
    }
  });

  return router;
}