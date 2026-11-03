// server/api/routes/modules/index.js
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireBotAccess } from '../../auth-middleware.js';
import { createCrudRouter } from './crud.js';
import { createGreetingsTestRouter } from './greetings-test.js';
import { createBirthdaysTestRouter } from './birthdays-test.js';
import { createLevelsDebugRouter } from './levels-debug.js';
import { createLevelsTestRouter } from './levels-test.js';
import { createLevelsLeaderboardRouter } from './levels-leaderboard.js';

export function modulesRouter() {
  const router = Router();
  router.use(requireAuth);
  router.use(requireBotAccess);

  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('shared/modules.manifest.json'), 'utf8'),
  );

  // CRUD: GET /, POST /:key/toggle, GET/PUT /:key/config
  router.use(createCrudRouter(manifest));

  // Тесты отправки (testMessageLimiter)
  router.use('/greetings', createGreetingsTestRouter());
  router.use('/birthdays', createBirthdaysTestRouter());

  // Levels: debug + test + leaderboard/inactivity
  router.use('/levels', createLevelsDebugRouter());
  router.use('/levels', createLevelsTestRouter());
  router.use('/levels', createLevelsLeaderboardRouter());

  return router;
}