// server/core/concurrency.js
// Утилита для параллельных промисов с ограничением concurrency.
// Используется в местах, где Promise.all по массиву может спалить rate-limit
// внешнего API (Discord REST).

/**
 * Запускает fn над каждым элементом items, не более limit параллельно.
 * Возвращает массив результатов в порядке items (индексы сохраняются).
 *
 * @param {Array<T>} items
 * @param {number} limit   — максимум одновременных запусков (>= 1)
 * @param {(item: T, idx: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function runWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        try {
          results[idx] = await fn(items[idx], idx);
        } catch (err) {
          results[idx] = { __error: err };
        }
      }
    },
  );

  await Promise.all(workers);
  return results;
}