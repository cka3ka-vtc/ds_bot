/* ============================================================
   Управление ботами.

   Эндпоинты:
     GET  /bots             — список ботов + статистика
     GET  /bots/stats       — только статистика активного
     POST /bots/active      — переключить активного бота
     POST /bots/status      — сменить activity
     POST /bots/validate    — проверить токен
     POST /bots/:id         — добавить/обновить бота
     DELETE /bots/:id       — удалить бота

   ПОРЯДОК ВАЖЕН: /bots/active, /bots/status, /bots/validate
   должны быть объявлены ДО /bots/:id — иначе Express
   распарсит их как id='active'/'status'/'validate'.
   ============================================================ */

import express from 'express';
import { z } from 'zod';
import { rateLimit } from '../middleware/rate-limit.js';
import { ActivitySchema, BotUpsertSchema } from '../validation/schemas.js';

const router = express.Router();

/* Переключение — не чаще 5 раз в минуту */
const swapLimiter = rateLimit({ windowMs: 60_000, max: 5 });

/* ============================================================
   Список ботов + статистика
   ============================================================ */

router.get('/bots', (req, res) => {
  const { botManager } = req.app.locals;
  if (!botManager) return res.status(503).json({ error: 'Bot manager not ready' });

  res.json({
    bots: botManager.listBots(),
    stats: botManager.getStats()
  });
});

router.get('/bots/stats', (req, res) => {
  const { botManager } = req.app.locals;
  if (!botManager) return res.status(503).json({ error: 'Bot manager not ready' });

  res.json(botManager.getStats());
});

/* ============================================================
   Переключение активного бота
   ============================================================ */

router.post('/bots/active', swapLimiter, async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    const { botManager, registerCommands } = req.app.locals;
    if (!botManager) throw new Error('Bot manager not ready');

    const result = await botManager.switchTo(id);

    /* После переключения нужно перерегистрировать команды
       для нового клиента — иначе они не появятся в Discord */
    if (registerCommands && botManager.client) {
      await registerCommands(botManager.client, botManager.client.token).catch(() => {});
    }

    res.json({ ok: true, ...result });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

/* ============================================================
   Смена activity (статуса) активного бота
   ============================================================ */

router.post('/bots/status', async (req, res, next) => {
  try {
    const activity = ActivitySchema.parse(req.body);
    const { botManager } = req.app.locals;
    if (!botManager) throw new Error('Bot manager not ready');

    await botManager.setActiveActivity(activity);
    res.json({ ok: true, activity });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

/* ============================================================
   Валидация токена без изменения состояния
   ============================================================ */

router.post('/bots/validate', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
    const { botManager } = req.app.locals;
    const result = await botManager.validateToken(token);
    res.json(result);
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

/* ============================================================
   Добавление / обновление бота
   ============================================================ */

router.post('/bots/:id', async (req, res, next) => {
  try {
    const { botManager } = req.app.locals;
    if (!botManager) throw new Error('Bot manager not ready');

    const body = BotUpsertSchema.parse(req.body);
    const saved = await botManager.upsertBot({ id: req.params.id, ...body });

    res.json({ ok: true, ...saved });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

/* ============================================================
   Удаление бота
   ============================================================ */

router.delete('/bots/:id', async (req, res, next) => {
  try {
    const { botManager } = req.app.locals;
    if (!botManager) throw new Error('Bot manager not ready');

    await botManager.removeBot(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    e.status = 400;
    next(e);
  }
});

export default router;