// server/api/routes/modules/index.js
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireBotAccess } from '../../auth-middleware.js';
import { createCrudRouter } from './crud.js';
import { createGreetingsTestRouter } from './greetings-test.js';
import { createBirthdaysTestRouter } from './birthdays-test.js';
import { createLevelsDebugRouter } from './levels-debug.js';

/**
 * Собирает роутер для /api/modules.
 *  - requireAuth, requireBotAccess — на уровне родителя (все подроуты защищены);
 *  - manifest читается один раз при старте и передаётся в crud;
 *  - порядок монтирования сохранён как в исходном монолите.
 */
export function modulesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireBotAccess);

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('shared/modules.manifest.json'), 'utf8'),
  );

  // CRUD: GET /, POST /:key/toggle, GET/PUT /:key/config
  router.use(createCrudRouter(manifest));

  // Тесты сообщений (сохраняют общий testMessageLimiter)
  router.use('/greetings', createGreetingsTestRouter());
  router.use('/birthdays', createBirthdaysTestRouter());

  // Диагностика модуля «Уровни»
  router.use('/levels', createLevelsDebugRouter());

  return router;
}