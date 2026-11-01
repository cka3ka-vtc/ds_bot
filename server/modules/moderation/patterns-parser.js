// server/modules/moderation/patterns-parser.js
// Парсер .txt-файлов в формате Filter.txt:
//   - Каждая строка — список альтернатив через запятую
//   - Элемент может быть regex-фрагментом `[хhx]+[уy]+[йяю]+`
//     (кириллица + латинские омоглифы)
//   - Или обычным словом `mat`
//   - Строки, начинающиеся с `-` или заканчивающиеся на `:` — пропускаются
//   - Отдельный блок whitelist — слова, на которые фильтр не реагирует
//
// На выходе: { patterns: string[], whitelist: string[] }
// Pattern-строки будут компилироваться на сервере через `new RegExp(p, 'iu')`.

const CYRILLIC = /[\u0400-\u04FF]/;

/**
 * Проверяет, является ли элемент регулярным выражением.
 * Регулярка содержит:
 *   - символы `[ ] + * ? | ( ) { } ^ $ . \`
 *   - И кириллицу (тогда считаем что это маска)
 */
function looksLikeRegex(token) {
  return /[[\]()+*?|{}\\.^$]/.test(token);
}

/**
 * Определяет, что это «маска» (не просто слово).
 * Маски в Filter.txt: `[хhx]+[уy]+[йяю]+`, `[бb6]+[лl]+[я9]+[дd]+`
 */
function isMask(token) {
  return looksLikeRegex(token) && CYRILLIC.test(token);
}

/**
 * Компилирует паттерн с проверкой. Возвращает строку или null.
 * Не добавляем флаги здесь — они добавляются при использовании.
 */
function compileSafe(pattern) {
  try {
    // Проверка: можно ли скомпилировать
    new RegExp(pattern, 'iu');
    return pattern;
  } catch {
    return null;
  }
}

/**
 * Разбивает строку файла на отдельные элементы по запятой
 * (только верхнеуровневые — внутри `[...]` запятая не считается).
 */
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
 * Парсит текст файла.
 * @param {string} text — содержимое .txt (UTF-8)
 * @returns {{ patterns: string[], whitelist: string[] }}
 */
export function parsePatternsFile(text) {
  const patterns = [];
  const whitelist = [];
  const seenPatterns = new Set();
  const seenWhitelist = new Set();

  if (!text) return { patterns, whitelist };

  // Разбиваем на строки, убираем \r
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let inWhitelistBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Явный комментарий
    if (line.startsWith('#')) continue;

    // Строки-директивы/метки (`- что-то`, `mаm...:`) — пропускаем
    if (line.startsWith('-')) continue;

    // Отдельный блок whitelist — маркер, если пользователь его добавил сам
    if (/^(whitelist|exceptions|исключения)[:=\s]/i.test(line)) {
      inWhitelistBlock = true;
      continue;
    }

    // Строки с `:` в конце — это служебные, скорее всего заголовки
    const trimmed = line.replace(/:+\s*$/, '').trim();

    for (const token of splitTopLevel(trimmed)) {
      if (!token) continue;

      if (isMask(token)) {
        const compiled = compileSafe(token);
        if (compiled && !seenPatterns.has(compiled)) {
          seenPatterns.add(compiled);
          patterns.push(compiled);
        }
        continue;
      }

      // Простое слово (без regex-спецсимволов) → в patterns как escaped
      if (!looksLikeRegex(token)) {
        const word = token.toLowerCase().trim();
        if (!word || word.length < 2) continue;

        if (inWhitelistBlock) {
          if (!seenWhitelist.has(word)) {
            seenWhitelist.add(word);
            whitelist.push(word);
          }
        } else {
          // Слово трактуем как паттерн по границам слова
          const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const pattern = `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`;
          const compiled = compileSafe(pattern);
          if (compiled && !seenPatterns.has(compiled)) {
            seenPatterns.add(compiled);
            patterns.push(compiled);
          }
        }
      } else {
        // Regex без кириллицы — считаем «сырым» паттерном
        const compiled = compileSafe(token);
        if (compiled && !seenPatterns.has(compiled)) {
          seenPatterns.add(compiled);
          patterns.push(compiled);
        }
      }
    }
  }

  return { patterns, whitelist };
}

/**
 * Утилита для случаев, когда в файле есть строки типа `,tebya,hebu,aibul`
 * (с ведущей запятой). Отдельно не нужна — splitTopLevel вернёт пустой
 * первый элемент, и он будет отфильтрован.
 */

export default parsePatternsFile;