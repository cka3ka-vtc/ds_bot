// server/api/routes/auth/index.js
import { Router } from 'express';
import { createUserOAuthRouter } from './user.js';
import { createBotInviteRouter } from './bot.js';
import { createSessionRouter } from './me.js';

/**
 * Собирает роутер для /auth.
 *  - Порядок: user-OAuth (/discord, /discord/callback) →
 *    bot-invite (/discord/bot-invite, /discord/bot-callback) → session (/me, /logout).
 *  - Express матчит по полному пути, порядок между /discord/callback и
 *    /discord/bot-callback не важен (это разные пути, не префикс), но
 *    сгруппировано по домену для читаемости.
 *  - authLimiter навешан внутри user.js и bot.js на каждый OAuth-route.
 *    /me и /logout — без лимитера (иначе F5 выкидывает пользователя).
 */
export function authRouter() {
  const router = Router();

  router.use(createUserOAuthRouter());
  router.use(createBotInviteRouter());
  router.use(createSessionRouter());

  return router;
}