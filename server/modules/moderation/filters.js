// server/modules/moderation/filters.js
//
// Stateless-фильтры контента. Stateful (spam, duplicates) обрабатываются в
// index.js — им нужна история сообщений/сессий.
//
// URL извлекаются из текста перед анализом (stripUrls) — чтобы капсло-детекторы
// не срабатывали на домены/пути.

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function stripUrls(text) {
  return String(text || '').replace(URL_REGEX, ' ');
}

export async function checkFilter(key, fc, { content, message }) {
  const p = fc.params || {};
  switch (key) {
    // stateful (spam, duplicates) — в index.js
    case 'profanity':  return checkProfanity(p, stripUrls(content));
    case 'caps':       return checkCaps(p, stripUrls(content));
    case 'links':      return checkLinks(p, content);
    case 'invites':    return checkInvites(p, content);
    case 'mentions':   return checkMentions(p, message);
    case 'zalgo':      return checkZalgo(p, stripUrls(content));
    case 'emoji':      return checkEmoji(p, stripUrls(content));
    default:           return null;
  }
}

/* ─── Profanity ─── */

const HAS_REGEX_CHARS = /[[\]()+*?|{}\\.^$]/;
const HAS_CYRILLIC = /[\u0400-\u04FF]/;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordToPattern(word) {
  const w = String(word || '').trim();
  if (!w) return null;
  if (HAS_REGEX_CHARS.test(w) && HAS_CYRILLIC.test(w)) {
    try { new RegExp(w, 'iu'); return w; } catch { return null; }
  }
  const escaped = escapeRegex(w);
  return `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
}

// КРИТИЧЕСКИЙ ФИКС: LRU-Map вместо single-slot.
// Раньше _cache жил в одном объекте-синглтоне — при переключении между
// гильдиями с разными правилами кэш постоянно вытеснялся, и на КАЖДОЕ сообщение
// шла ре-компиляция до 1000 регулярок. Теперь кэш на 64 набора + LRU-touch.
const COMPILED_CACHE_MAX = 64;
const compiledCache = new Map();

function getCompiledState(p) {
  const cacheKey = JSON.stringify({
    r: p.regexRules || [],
    w: p.customWords || [],
    e: p.customExceptions || [],
  });

  const cached = compiledCache.get(cacheKey);
  if (cached) {
    // LRU-touch
    compiledCache.delete(cacheKey);
    compiledCache.set(cacheKey, cached);
    return cached;
  }

  const rules = [];
  for (const rule of (p.regexRules || [])) {
    if (!rule?.pattern) continue;
    let trigger;
    try { trigger = new RegExp(rule.pattern, 'iu'); } catch { continue; }

    const whitelist = [];
    for (const w of (rule.whitelist || [])) {
      const raw = String(w || '').trim();
      if (!raw) continue;
      try { whitelist.push(new RegExp(raw, 'iu')); } catch {}
    }
    rules.push({ trigger, whitelist });
    if (rules.length >= 1000) break;
  }

  for (const word of (p.customWords || [])) {
    const pat = wordToPattern(word);
    if (!pat) continue;
    try {
      rules.push({ trigger: new RegExp(pat, 'iu'), whitelist: [] });
    } catch {}
    if (rules.length >= 1000) break;
  }

  const globalWhitelist = [];
  for (const word of (p.customExceptions || [])) {
    const pat = wordToPattern(word);
    if (!pat) continue;
    try { globalWhitelist.push(new RegExp(pat, 'iu')); } catch {}
  }

  const value = { rules, globalWhitelist };

  if (compiledCache.size >= COMPILED_CACHE_MAX) {
    const firstKey = compiledCache.keys().next().value;
    if (firstKey !== undefined) compiledCache.delete(firstKey);
  }
  compiledCache.set(cacheKey, value);
  return value;
}

/**
 * Сброс кэша скомпилированных регулярок.
 * Вызывается из PUT /api/moderation/config и PUT /api/modules/moderation/config.
 */
export function clearCompiledCache() {
  compiledCache.clear();
}

function matchOverlaps(triggerMatch, text, whitelistRegexes) {
  if (!whitelistRegexes.length) return false;
  const ts = triggerMatch.index;
  const te = ts + triggerMatch[0].length;

  for (const wl of whitelistRegexes) {
    const flags = wl.flags.includes('g') ? wl.flags : wl.flags + 'g';
    const globalWl = new RegExp(wl.source, flags);
    for (const wm of text.matchAll(globalWl)) {
      const ws = wm.index;
      const we = ws + wm[0].length;
      if (ws <= ts && we >= te) return true;
    }
  }
  return false;
}

function checkProfanity(p, content) {
  const text = String(content || '');
  if (!text) return null;

  const { rules, globalWhitelist } = getCompiledState(p);
  if (!rules.length) return null;

  for (const rule of rules) {
    const flags = rule.trigger.flags.includes('g')
      ? rule.trigger.flags
      : rule.trigger.flags + 'g';
    const globalTrigger = new RegExp(rule.trigger.source, flags);

    for (const m of text.matchAll(globalTrigger)) {
      if (matchOverlaps(m, text, rule.whitelist)) continue;
      if (matchOverlaps(m, text, globalWhitelist)) continue;

      return {
        reason: 'мат',
        matched: m[0].slice(0, 40),
        details: `найдено «${m[0].slice(0, 40)}»`,
        filter: 'profanity',
      };
    }
  }
  return null;
}

/* ─── Caps ─── */

function checkCaps(p, content) {
  const letters = String(content || '').replace(/[^\p{L}]/gu, '');
  if (letters.length < p.minLen) return null;
  const upper = (letters.match(/\p{Lu}/gu) || []).length;
  const ratio = Math.round((upper / letters.length) * 100);
  if (ratio < p.percent) return null;
  return { reason: 'капс', details: `${ratio}% заглавных`, filter: 'caps' };
}

/* ─── Links / invites ─── */

function checkLinks(p, content) {
  const urls = String(content || '').match(/https?:\/\/[^\s<>"']+/gi);
  if (!urls?.length) return null;
  const allowed = String(p.allowedDomains || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  for (const url of urls) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (allowed.some((d) => host === d || host.endsWith('.' + d))) continue;
      return { reason: 'ссылка', matched: host, details: `домен: ${host}`, filter: 'links' };
    } catch {}
  }
  return null;
}

function checkInvites(p, content) {
  const m = String(content || '').match(/discord(?:\.gg|\.com\/invite)\/([a-zA-Z0-9-]+)/);
  if (!m) return null;
  const allowed = String(p.allowedGuilds || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && allowed.includes(m[1])) return null;
  return { reason: 'инвайт', matched: m[1], details: `код: ${m[1]}`, filter: 'invites' };
}

/* ─── Mentions ─── */

function checkMentions(p, message) {
  if (!message) return null;
  if (p.blockEveryone && (message.mentions.everyone || message.content.includes('@here'))) {
    return { reason: 'упоминания', details: 'массовое упоминание', filter: 'mentions' };
  }
  if (message.mentions.users.size >= p.maxMentions) {
    return { reason: 'упоминания', details: `упомянуто ${message.mentions.users.size}`, filter: 'mentions' };
  }
  return null;
}

/* ─── Zalgo / emoji ─── */

function checkZalgo(p, content) {
  const s = String(content || '');
  if (s.length < p.minLen) return null;
  const marks = (s.normalize('NFD').match(/[\u0300-\u036F]/g) || []).length;
  if (marks <= p.maxMarks * p.minLen) return null;
  return { reason: 'залго', details: `${marks} наложений`, filter: 'zalgo' };
}

function checkEmoji(p, content) {
  const s = String(content || '');
  const custom = (s.match(/<a?:\w+:\d+>/g) || []).length;
  const unicode = (s.match(/\p{Extended_Pictographic}/gu) || []).length;
  const total = p.includeCustom ? custom + unicode : unicode;
  if (total <= p.maxEmoji) return null;
  return { reason: 'эмодзи', details: `${total} эмодзи`, filter: 'emoji' };
}