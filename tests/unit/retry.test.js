// tests/unit/retry.test.js
//
// Проверяем критические свойства retryDiscord:
//   - 429/5xx/network — retry
//   - 4xx / dead interactions — не retry
//   - retry_after от Discord НЕ обрезается до maxDelayMs

import { describe, it, expect, vi } from 'vitest';
import { retryDiscord, isRetryable } from '../../server/core/retry.js';

describe('isRetryable', () => {
  it('429 → true', () => {
    expect(isRetryable({ status: 429 })).toBe(true);
  });

  it('500 / 502 / 503 / 504 → true', () => {
    for (const s of [500, 502, 503, 504]) {
      expect(isRetryable({ status: s })).toBe(true);
    }
  });

  it('400 / 401 / 403 / 404 → false', () => {
    for (const s of [400, 401, 403, 404]) {
      expect(isRetryable({ status: s })).toBe(false);
    }
  });

  it('dead interaction code 10062 → false', () => {
    expect(isRetryable({ code: 10062 })).toBe(false);
  });

  it('dead interaction code 40060 → false', () => {
    expect(isRetryable({ code: 40060 })).toBe(false);
  });

  it('network error ECONNRESET → true', () => {
    expect(isRetryable({ code: 'ECONNRESET' })).toBe(true);
  });

  it('plain TypeError без cause → false', () => {
    expect(isRetryable(new TypeError('boom'))).toBe(false);
  });
});

describe('retryDiscord', () => {
  it('успех с первого раза', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await retryDiscord(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('успех со второго раза после 5xx', async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      n++;
      if (n === 1) {
        const e = new Error('server');
        e.status = 500;
        throw e;
      }
      return 'ok';
    });
    const result = await retryDiscord(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      maxDelayMs: 50,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('сдаётся после maxAttempts', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('server');
      e.status = 500;
      throw e;
    });
    await expect(
      retryDiscord(fn, { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 20 }),
    ).rejects.toThrow('server');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('НЕ retry-ит 400', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('bad');
      e.status = 400;
      throw e;
    });
    await expect(
      retryDiscord(fn, { maxAttempts: 3, baseDelayMs: 5, maxDelayMs: 20 }),
    ).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  // КРИТИЧЕСКИЙ ТЕСТ: retry_after НЕ обрезается до maxDelayMs
  it('не клампит retry_after до maxDelayMs', async () => {
    let attempts = 0;
    const fn = vi.fn(async () => {
      attempts++;
      if (attempts === 1) {
        const e = new Error('rate');
        e.status = 429;
        e.retryAfter = 1; // 1000ms
        throw e;
      }
      return 'ok';
    });

    const start = Date.now();
    const result = await retryDiscord(fn, {
      maxAttempts: 3,
      baseDelayMs: 5,
      maxDelayMs: 100, // 100ms — но retry_after должен победить
    });
    const elapsed = Date.now() - start;

    expect(result).toBe('ok');
    // Реально ждём ~1000ms (не 100ms)
    expect(elapsed).toBeGreaterThanOrEqual(950);
  }, 5000);
});