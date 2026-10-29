// server/api/middleware/origin-check.js
// Защита state-changing запросов от CSRF.
// Разрешаем:
//   - запросы без Origin/Referer (навигация браузера, curl);
//   - запросы с Origin совпадающим с host (или того же хоста без порта);
//   - запросы с trusted хостами из env.

import { config } from '../../config.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function hostOf(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return null;
  }
}

function sameHost(a, b) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function originCheck() {
  return (req, res, next) => {
    if (!MUTATING_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    const referer = req.get('referer');
    const reqHost = req.get('host');

    const candidates = [origin, referer].filter(Boolean).map(hostOf);

    // Нет заголовков — это либо серверный вызов, либо same-site навигация.
    // SameSite=Lax cookie защищает нас в этом случае.
    if (!candidates.length) return next();

    const allowed = candidates.some((h) => sameHost(h, reqHost));

    if (!allowed) {
      req.app?.locals?.logger?.warn(
        { origin, referer, reqHost, ip: req.ip, url: req.originalUrl },
        'origin check failed',
      );
      return res.status(403).json({ error: 'csrf_origin_mismatch' });
    }
    next();
  };
}