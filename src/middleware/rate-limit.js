/* ============================================================
   In-memory rate limiter (sliding window).

   Без внешних зависимостей. Для одиночного инстанса бота
   этого достаточно. Если проект вырастет до нескольких инстансов,
   заменить на Redis.
   ============================================================ */

/**
 * Создаёт middleware для ограничения частоты запросов.
 *
 * @param {object} opts
 * @param {number} [opts.windowMs=60000] - окно в миллисекундах
 * @param {number} [opts.max=30]          - максимум запросов в окне
 * @param {Function} [opts.keyFn]         - ключ (по умолчанию req.ip)
 * @param {string} [opts.message]         - текст ошибки при превышении
 * @returns {Function} Express middleware
 */
export function rateLimit({
  windowMs = 60_000,
  max = 30,
  keyFn = (req) => req.ip,
  message = 'Слишком много запросов'
} = {}) {
  const store = new Map(); // key -> { count, resetAt }

  /* Периодическая чистка устаревших записей.
     unref() — чтобы таймер не держал процесс, если всё закрывается. */
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message, retryAfter });
    }

    entry.count++;
    next();
  };
}