// server/core/ttl-cache.js
// Простой LRU+TTL-кэш для module-level кэшей.
// Eviction:
//   - по ttl — лениво, при get() или явном cleanup();
//   - по maxSize — при set(), вытесняется старейший ключ (LRU-ish).

export class TtlCache {
  constructor({ ttl, maxSize = 10_000 } = {}) {
    this.ttl = ttl;
    this.maxSize = maxSize;
    this._map = new Map();
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return undefined;
    if (this.ttl != null && Date.now() - entry.ts > this.ttl) {
      this._map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    if (this._map.size >= this.maxSize && !this._map.has(key)) {
      const firstKey = this._map.keys().next().value;
      if (firstKey !== undefined) this._map.delete(firstKey);
    }
    this._map.set(key, { value, ts: Date.now() });
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  delete(key) {
    this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  cleanup() {
    if (this.ttl == null) return;
    const now = Date.now();
    for (const [k, v] of this._map) {
      if (now - v.ts > this.ttl) this._map.delete(k);
    }
  }
}