// server/api/routes/members/index.js
import { Router } from 'express';
import { requireAuth } from '../../auth-middleware.js';
import { createListRouter } from './list.js';
import { createDetailRouter } from './detail.js';
import { createUpdateRouter } from './update.js';

export function membersRouter() {
  const router = Router();
  router.use(requireAuth);

  router.use(createListRouter());
  router.use(createDetailRouter());
  router.use(createUpdateRouter());

  return router;
}