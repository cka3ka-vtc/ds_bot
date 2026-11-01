// server/modules/moderation/test.js
// Прогон текста через все включённые фильтры — без побочных эффектов.
// Используется эндпоинтом POST /api/moderation/test.

import { FILTER_KEYS } from '../../../shared/moderation-config.js';
import { checkFilter } from './filters.js';

export async function runModerationFilters(cfg, text) {
  const hits = [];
  for (const key of FILTER_KEYS) {
    const fc = cfg.filters[key];
    if (!fc?.enabled) continue;
    const hit = await checkFilter(key, fc, { content: text, message: null });
    if (hit) {
      hits.push({
        filter: key,
        reason: hit.reason,
        matched: hit.matched || null,
      });
    }
  }
  return hits;
}