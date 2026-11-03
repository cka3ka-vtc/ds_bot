// server/modules/moderation/test.js
//
// Прогон текста через stateless-фильтры. Stateful (spam/duplicates) требуют
// истории сообщений, raid — работает на guildMemberAdd, а не на тексте.
// Возвращает { hits, skipped }, где skipped — какие фильтры пропущены.

import { FILTER_KEYS } from '../../../shared/moderation-config.js';
import { checkFilter } from './filters.js';

const STATEFUL_FILTERS = new Set(['spam', 'duplicates', 'raid']);

export async function runModerationFilters(cfg, text) {
  const hits = [];
  const skipped = [];

  for (const key of FILTER_KEYS) {
    const fc = cfg.filters[key];
    if (!fc?.enabled) continue;

    if (STATEFUL_FILTERS.has(key)) {
      skipped.push(key);
      continue;
    }

    const hit = await checkFilter(key, fc, { content: text, message: null });
    if (hit) {
      hits.push({
        filter: key,
        reason: hit.reason,
        matched: hit.matched || null,
      });
    }
  }

  return { hits, skipped };
}