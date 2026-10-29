// server/api/middleware/rate-limit.js
// Простая обёртка над express-rate-limit с базовыми настройками.
import rateLimit from 'express-rate-limit';

export function createLimiter({ windowMs = 60_000, max = 60, message } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'rate_limited',
        message: message || 'Слишком много запросов, попробуйте позже',
      });
    },
  });
}

/** Лимитер для авторизации. */
export const authLimiter = createLimiter({
  windowMs: 5 * 60_000,
  max: 20,
  message: 'Слишком много попыток входа. Подождите несколько минут.',
});

/** Лимитер для добавления ботов. */
export const addBotLimiter = createLimiter({
  windowMs: 10 * 60_000,
  max: 10,
});

/** Лимитер для отправки тестовых сообщений. */
export const testMessageLimiter = createLimiter({
  windowMs: 60_000,
  max: 10,
  message: 'Слишком часто. Подождите минуту.',
});

/** Общий API-лимитер — мягкий, чтобы не мешать дашборду. */
export const generalApiLimiter = createLimiter({
  windowMs: 60_000,
  max: 300,
});