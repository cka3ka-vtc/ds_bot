// shared/patterns-parser.js
// Парсер формата Filter.txt:
//   TRIGGER_REGEX:WHITELIST1,WHITELIST2,...
//   TRIGGER_REGEX:               (без whitelist)
//   TRIGGER_REGEX                 (без разделителя — вся строка триггер)
// Строки с # и - игнорируются.
// На выходе: [{ pattern: string, whitelist: string[] }, ...]

const CYRILLIC = /[\u0400-\u04FF]/;

function looksLikeRegex(token) {
  return /[[\]()+*?|{}\\.^$]/.test(token);
}

function compileSafe(pattern) {
  try {
    new RegExp(pattern, 'iu');
    return pattern;
  } catch {
    return null;
  }
}

function splitTopLevel(line) {
  const out = [];
  let depth = 0;
  let current = '';
  let escaped = false;

  for (const ch of line) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

/**
 * @param {string} text — содержимое .txt
 * @returns {Array<{ pattern: string, whitelist: string[] }>}
 */
export function parsePatternsFile(text) {
  const rules = [];
  if (!text) return rules;

  const lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const seen = new Set();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('-')) continue;

    // Разделяем по первому `:` на TRIGGER и WHITELIST
    let triggerPart = line;
    let whitelistPart = '';
    const colonIdx = line.indexOf(':');
    if (colonIdx >= 0) {
      triggerPart = line.slice(0, colonIdx).trim();
      whitelistPart = line.slice(colonIdx + 1).trim();
    }

    if (!triggerPart) continue;

    const trigger = compileSafe(triggerPart);
    if (!trigger) continue;

    if (seen.has(trigger)) continue;
    seen.add(trigger);

    // Разбираем whitelist
    const whitelist = [];
    if (whitelistPart) {
      for (const token of splitTopLevel(whitelistPart)) {
        const w = token.trim();
        if (!w) continue;

        if (looksLikeRegex(w) && CYRILLIC.test(w)) {
          // Regex-паттерн
          const compiled = compileSafe(w);
          if (compiled) whitelist.push(compiled);
        } else {
          // Простое слово → превращаем в regex по границам слова
          const word = w.toLowerCase().trim();
          if (!word || word.length < 2) continue;
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
          const compiled = compileSafe(pattern);
          if (compiled) whitelist.push(compiled);
        }
      }
    }

    rules.push({ pattern: trigger, whitelist });
  }

  return rules;
}

/**
 * Утилита: если пользователь вручную вписал «слова через запятую» —
 * превращаем в rules с триггером `\bслово\b`.
 */
export function wordsToRules(text) {
  const rules = [];
  if (!text) return rules;
  const words = String(text).split(/[\n,]+/).map((w) => w.trim().toLowerCase()).filter(Boolean);
  for (const w of words) {
    if (w.length < 2) continue;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
    const compiled = compileSafe(pattern);
    if (compiled) rules.push({ pattern: compiled, whitelist: [] });
  }
  return rules;
}

export default parsePatternsFile;