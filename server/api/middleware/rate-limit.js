// server/api/middleware/rate-limit.js
//
// Обёртка над express-rate-limit:
//   - createLimiter — фабрика с кастомным keyGenerator;
//   - тревожные warn-события при 429 (для алертов);
//   - два уровня: IP (DoS) и user_id (справедливость).

import rateLimit from 'express-rate-limit';

export function createLimiter({
  windowMs = 60_000,
  max = 60,
  message,
  name = 'general',
  keyGenerator = null,
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: keyGenerator ? { ip: false } : undefined,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => {
      req.app?.locals?.logger?.warn?.({
        event: 'rate_limited',
        limit_type: name,
        route: req.route?.path ? `${req.method} ${req.route.path}` : `${req.method} ${req.path}`,
        user_id: req.user?.id || null,
        bot_id: req.query?.botId || req.body?.botId || null,
        guild_id: req.query?.guildId || req.body?.guildId || null,
        ip: req.ip || null,
      }, 'rate limit exceeded');

      res.status(429).json({
        error: 'rate_limited',
        message: message || 'Слишком много запросов, попробуйте позже',
      });
    },
  });
}

/** IP-лимитер для OAuth (защита от перебора state). */
export const authLimiter = createLimiter({
  windowMs: 5 * 60_000,
  max: 20,
  name: 'auth',
  message: 'Слишком много попыток входа. Подождите несколько минут.',
});

/**
 * User-based (fallback IP) лимитер для добавления ботов.
 * ФИКС: применять ПОСЛЕ requireAuth, чтобы req.user.id был доступен.
 * Раньше стоял на app.use('/api/bots', addBotLimiter) — до auth-middleware.
 */
export const addBotLimiter = createLimiter({
  windowMs: 10 * 60_000,
  max: 10,
  name: 'add_bot',
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
});

/** IP-лимитер для тестовых сообщений (защита REST-вызовов Discord). */
export const testMessageLimiter = createLimiter({
  windowMs: 60_000,
  max: 10,
  name: 'test_message',
  message: 'Слишком часто. Подождите минуту.',
});

/** IP-лимитер «грубой» защиты от DoS. */
export const generalApiLimiter = createLimiter({
  windowMs: 60_000,
  max: 1000,
  name: 'general_ip',
});

/**
 * User-based лимитер. Требует requireAuth (req.user.id доступен).
 * Fallback на IP для публичных маршрутов.
 */
export const userApiLimiter = createLimiter({
  windowMs: 60_000,
  max: 300,
  name: 'general_user',
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
});