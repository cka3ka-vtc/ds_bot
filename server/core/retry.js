// server/core/retry.js

/**
 * Retry для вызовов Discord API с экспоненциальной задержкой.
 *
 * Что retry-ится:
 *   - HTTP 429 (rate limit) — задержка из retry_after (если есть) или backoff
 *   - HTTP 5xx (500, 502, 503, 504) — backoff
 *   - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED, EAI_AGAIN, ...)
 *
 * Что НЕ retry-ится (throw сразу):
 *   - HTTP 4xx (кроме 429): 400, 401, 403, 404, 405, 422 — ошибка в запросе
 *   - Discord code 10062 (Unknown interaction), 40060 (already acknowledged) —
 *     interaction больше не валиден, retry бессмыслен
 *   - Любая не-network ошибка (TypeError, ReferenceError и т.п.)
 *
 * При 429 Discord возвращает retry_after (в секундах) в response body.
 * discord.js пробрасывает его как err.retryAfter (секунды) или err.rawError.retry_after.
 */

const NETWORK_CODES = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
  'EAI_AGAIN', 'EPIPE', 'ENETUNREACH', 'EHOSTUNREACH',
  'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT',
]);

const FATAL_DISCORD_CODES = new Set([10062, 40060]);

function isNetworkError(err) {
  if (!err) return false;
  if (NETWORK_CODES.has(err.code)) return true;
  // undici (fetch в Node 18+) кидает TypeError с cause.code
  if (err.name === 'TypeError' && err.cause && NETWORK_CODES.has(err.cause.code)) return true;
  return false;
}

function isRateLimitError(err) {
  return err?.status === 429
    || err?.code === 429
    || /rate ?limit/i.test(err?.message || '');
}

function isRetryableServerError(err) {
  const status = err?.status;
  return status === 500 || status === 502 || status === 503 || status === 504;
}

export function isRetryable(err) {
  if (!err) return false;
  if (FATAL_DISCORD_CODES.has(err.code)) return false;

  if (isRateLimitError(err)) return true;
  if (isRetryableServerError(err)) return true;
  if (isNetworkError(err)) return true;

  // 4xx (кроме 429) — окончательная ошибка, retry не поможет
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) return false;

  return false;
}

function getRetryAfterMs(err) {
  // Discord 429: retry_after в секундах (может быть float).
  // discord.js кладёт в err.retryAfter (секунды) и в err.rawError.retry_after.
  const sec = err?.retryAfter ?? err?.rawError?.retry_after;
  if (typeof sec === 'number' && sec > 0) return Math.ceil(sec * 1000);
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {Function} fn — async () => { ... }
 * @param {object} [opts]
 * @param {number}   [opts.maxAttempts=3]
 * @param {number}   [opts.baseDelayMs=500]
 * @param {number}   [opts.maxDelayMs=15000]
 * @param {string}   [opts.label] — для логов: 'channel.send' / 'client.login' / ...
 * @param {object}   [opts.logger] — pino logger
 * @param {object}   [opts.context] — { bot_id, guild_id, user_id, ... } для логов
 * @returns {Promise<any>} — результат fn
 */
export async function retryDiscord(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 15_000,
    label = 'discord-api',
    logger = null,
    context = {},
  } = opts;

  let attempt = 0;
  let lastErr = null;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      attempt++;

      const retryable = isRetryable(err);
      const rateLimited = isRateLimitError(err);
      const retryAfterMs = getRetryAfterMs(err);

      if (!retryable || attempt >= maxAttempts) {
        if (logger && (retryable || rateLimited)) {
          logger.warn({
            err,
            event: 'discord_retry_giveup',
            label,
            attempt,
            max_attempts: maxAttempts,
            retryable,
            rate_limited: rateLimited,
            err_status: err?.status || null,
            err_code: err?.code || null,
            ...context,
          }, 'discord retry: giving up');
        }
        throw err;
      }

      let delayMs;
      if (retryAfterMs != null) {
        // 429 — Discord явно говорит, сколько ждать. Уважаем, но не больше maxDelayMs.
        delayMs = Math.min(retryAfterMs, maxDelayMs);
      } else {
        // Exponential backoff с jitter: base * 2^(attempt-1) × [0.5; 1]
        const exp = baseDelayMs * Math.pow(2, attempt - 1);
        const jitter = exp * (0.5 + Math.random() * 0.5);
        delayMs = Math.min(Math.round(jitter), maxDelayMs);
      }

      if (logger) {
        logger.info({
          event: 'discord_retry',
          label,
          attempt,
          max_attempts: maxAttempts,
          delay_ms: delayMs,
          rate_limited: rateLimited,
          err_status: err?.status || null,
          err_code: err?.code || null,
          ...context,
        }, 'discord retry: retrying');
      }

      await sleep(delayMs);
    }
  }

  throw lastErr;
}

export { isRateLimitError };