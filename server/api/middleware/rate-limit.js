// server/api/middleware/rate-limit.js
// Обёртка над express-rate-limit:
//  - createLimiter поддерживает кастомный keyGenerator;
//  - структурированный warn при 429 для будущих alerts;
//  - два уровня: IP (DoS) и user_id (справедливость).

import rateLimit from 'express-rate-limit';

/**
 * @param {object} [opts]
 * @param {number}   [opts.windowMs=60000]
 * @param {number}   [opts.max=60]
 * @param {string}   [opts.message]
 * @param {string}   [opts.name='general'] — имя лимитера (для логов/метрик):
 *   'general_ip' | 'general_user' | 'auth' | 'add_bot' | 'test_message'
 * @param {(req) => string} [opts.keyGenerator] — по умолчанию express-rate-limit
 *   берёт req.ip. Для user-based передаём кастомный.
 */
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
    // Кастомный keyGenerator сам отвечает за ключ — express-rate-limit'у
    // не нужно валидировать req.ip. Отключаем ту проверку, чтобы не было
    // ложного warning'а.
    validate: keyGenerator ? { ip: false } : undefined,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req, res) => {
      // Структурированный warn при 429 — для будущих alerts
      // («аномально много 429 от одного IP/user → возможен брутфорс/OAuth-flood»).
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

/** IP-лимитер для OAuth (защита от брутфорса state). */
export const authLimiter = createLimiter({
  windowMs: 5 * 60_000,
  max: 20,
  name: 'auth',
  message: 'Слишком много попыток входа. Подождите несколько минут.',
});

/** IP-лимитер для добавления ботов (защита от спама новыми инстансами). */
export const addBotLimiter = createLimiter({
  windowMs: 10 * 60_000,
  max: 10,
  name: 'add_bot',
});

/** IP-лимитер для тестовых сообщений (тяжёлые REST-вызовы Discord). */
export const testMessageLimiter = createLimiter({
  windowMs: 60_000,
  max: 10,
  name: 'test_message',
  message: 'Слишком часто. Подождите минуту.',
});

/**
 * IP-лимитер «грубой» защиты от DoS.
 * Применяется до auth (req.user ещё нет).
 * Лимит высокий — мы не хотим ущемлять корректных пользователей за NAT.
 */
export const generalApiLimiter = createLimiter({
  windowMs: 60_000,
  max: 1000,
  name: 'general_ip',
});

/**
 * User-based лимитер. Применяется ПОСЛЕ requireAuth (req.user.id доступен).
 * Для неавторизованных (редкие публичные /api/* эндпоинты) — fallback на IP.
 *
 * Зачем: 2-3 админа в одном офисе за одним NAT делят IP, но не user_id.
 * Справедливый лимит на пользователя → 300 req/min per user.
 */
export const userApiLimiter = createLimiter({
  windowMs: 60_000,
  max: 300,
  name: 'general_user',
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`),
});