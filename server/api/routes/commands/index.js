// server/api/routes/commands/index.js
import { Router } from 'express';
import { requireAuth } from '../../auth-middleware.js';
import { createCheckRouter } from './check.js';
import { createBuiltinRouter } from './builtin.js';
import { createCustomRouter } from './custom.js';
import { createCustomTestRouter } from './custom-test.js';

/**
 * Собирает роутер для /api/commands.
 *  - requireAuth — на уровне родителя (все подроуты защищены);
 *  - порядок: check → builtin → custom-test → custom.
 *    Специфичные пути (check, builtin/:name) — раньше общих (:id, :id/toggle).
 */
export function commandsRouter() {
  const router = Router();
  router.use(requireAuth);

  router.use(createCheckRouter());
  router.use(createBuiltinRouter());
  router.use(createCustomTestRouter());
  router.use(createCustomRouter());

  return router;
}