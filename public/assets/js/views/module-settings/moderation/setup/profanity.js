// public/assets/js/views/module-settings/moderation/setup/profanity.js
// Словарная панель фильтра мата.
// Всегда regex-режим. Источники:
//   - Маски (regexRules): импорт/встроенный/экспорт
//   - Свои слова мата (customWords)
//   - Свои исключения (customExceptions)

import { UI } from '/shared/ui-strings.js';

const S = UI.moderationSettings;

export async function setupProfanity(ctx, card, fc) {
  const container = card.querySelector('[data-prof-params]');
  if (!container) return;

  let parsePatternsFile = null;
  let BUILTIN_PATTERNS_RAW = '';

  try {
    const [parserMod, builtinMod] = await Promise.all([
      import('/shared/patterns-parser.js'),
      import('/shared/builtin-profanity.js'),
    ]);
    parsePatternsFile = parserMod.parsePatternsFile || parserMod.default;
    BUILTIN_PATTERNS_RAW = builtinMod.BUILTIN_PATTERNS_RAW || '';
  } catch (err) {
    console.error('[profanity] import failed', err);
    container.innerHTML = `
      <div class="moderation-note moderation-note--warn">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <strong>Не удалось загрузить словари</strong>
          <span>Проверьте, что <code>/shared/patterns-parser.js</code> и
          <code>/shared/builtin-profanity.js</code> доступны по HTTP.</span>
        </div>
      </div>`;
    return;
  }

  if (typeof parsePatternsFile !== 'function') {
    container.innerHTML = `
      <div class="moderation-note moderation-note--warn">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <strong>Некорректный patterns-parser.js</strong>
          <span>Файл должен экспортировать <code>parsePatternsFile(text)</code>.</span>
        </div>
      </div>`;
    return;
  }

  const p = fc.params || {};
  container.innerHTML = panelHTML(p);

  /* ── Импорт .txt ── */
  container.querySelector('[data-regex-import]')?.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,text/plain';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const rules = parsePatternsFile(text);

        if (!rules.length) {
          ctx.toast('Файл пустой или в неверном формате', 'warn');
          return;
        }

        const byPattern = new Map();
        for (const r of (p.regexRules || [])) byPattern.set(r.pattern, r);
        for (const r of rules) byPattern.set(r.pattern, r);

        p.regexRules = Array.from(byPattern.values());

        container.innerHTML = panelHTML(p);
        setupProfanity(ctx, card, fc);
        ctx.toast(`Загружено: ${rules.length} правил`, 'success');
      } catch (err) {
        ctx.toast('Ошибка чтения файла: ' + err.message, 'error');
      }
    });
    fileInput.click();
  });

  /* ── Встроенный словарь ── */
  container.querySelector('[data-regex-builtin]')?.addEventListener('click', () => {
    const builtinRules = parsePatternsFile(BUILTIN_PATTERNS_RAW);
    if (!builtinRules.length) {
      ctx.toast('Встроенный словарь пуст', 'warn');
      return;
    }

    const byPattern = new Map();
    for (const r of (p.regexRules || [])) byPattern.set(r.pattern, r);
    for (const r of builtinRules) {
      if (!byPattern.has(r.pattern)) {
        byPattern.set(r.pattern, { pattern: r.pattern, whitelist: r.whitelist });
      }
    }

    p.regexRules = Array.from(byPattern.values());

    container.innerHTML = panelHTML(p);
    setupProfanity(ctx, card, fc);
    ctx.toast(`Встроенный словарь: +${builtinRules.length} правил`, 'success');
  });

  /* ── Очистить маски ── */
  container.querySelector('[data-regex-clear]')?.addEventListener('click', () => {
    if (!confirm('Очистить все маски и их whitelists?')) return;
    p.regexRules = [];
    container.innerHTML = panelHTML(p);
    setupProfanity(ctx, card, fc);
    ctx.toast('Маски очищены', 'info');
  });

  /* ── Экспорт масок ── */
  container.querySelector('[data-regex-export]')?.addEventListener('click', () => {
    const lines = [
      '# Проф-маски (формат Filter.txt)',
      '# Каждая строка: TRIGGER_REGEX:WL1,WL2,...',
      '',
    ];
    for (const r of (p.regexRules || [])) {
      const wl = (r.whitelist || []).join(',');
      lines.push(`${r.pattern}:${wl}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'profanity-masks.txt';
    a.click();
    URL.revokeObjectURL(a.href);
    ctx.toast('Файл масок скачан', 'success');
  });

  /* ── Свои слова мата ── */
  container.querySelector('[data-custom-words]')?.addEventListener('input', (e) => {
    p.customWords = e.target.value
      .split(/[,\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  });

  /* ── Свои исключения ── */
  container.querySelector('[data-custom-exceptions]')?.addEventListener('input', (e) => {
    p.customExceptions = e.target.value
      .split(/[,\n]+/)
      .map((w) => w.trim())
      .filter(Boolean);
  });
}

/* ═════════════════════════════════════════════════════════════
   HTML
   ═════════════════════════════════════════════════════════════ */

function panelHTML(p) {
  const rulesCount = (p.regexRules || []).length;
  const wlInRules = (p.regexRules || []).reduce((sum, r) => sum + ((r.whitelist || []).length), 0);
  const customWords = (p.customWords || []).join(', ');
  const customExceptions = (p.customExceptions || []).join(', ');

  return `
    <div class="prof-panel">

      <!-- ═══════════ Маски ═══════════ -->
      <div class="dict-panel">
        <div class="dict-head">
          <div class="dict-head-left">
            <i class="fa-solid fa-regex"></i>
            <strong>Маски</strong>
            <span>· паттерны из Filter.txt</span>
          </div>
          <div class="dict-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-regex-import>
              <i class="fa-solid fa-file-import"></i> Импорт .txt
            </button>
            <button type="button" class="btn btn-ghost btn-sm" data-regex-builtin>
              <i class="fa-solid fa-book"></i> Встроенный
            </button>
            <button type="button" class="btn btn-ghost btn-sm" data-regex-export>
              <i class="fa-solid fa-file-export"></i> Экспорт
            </button>
            <button type="button" class="btn btn-ghost btn-sm" data-regex-clear>
              <i class="fa-solid fa-trash"></i> Очистить
            </button>
          </div>
        </div>
        <div class="dict-stats">
          <span>
            <i class="fa-solid fa-layer-group" style="color:var(--purple);"></i>
            Правил: <b>${rulesCount}</b>
          </span>
          <span>
            <i class="fa-solid fa-shield-halved" style="color:var(--green);"></i>
            Исключений в масках: <b>${wlInRules}</b>
          </span>
          <span class="hint">
            ${rulesCount === 0
              ? 'Импортируйте Filter.txt или нажмите «Встроенный»'
              : 'Формат: TRIGGER_REGEX:WHITELIST1,WHITELIST2,...'}
          </span>
        </div>
      </div>

      <!-- ═══════════ Свои слова мата ═══════════ -->
      <div class="dict-panel">
        <div class="dict-head">
          <div class="dict-head-left">
            <i class="fa-solid fa-plus-circle" style="color:var(--red);"></i>
            <strong>Свои слова мата</strong>
            <span>· дополняют триггеры</span>
          </div>
        </div>
        <div class="dict-body">
          <div class="dict-field">
            <label>Слова через запятую или с новой строки</label>
            <textarea class="input" data-custom-words
                      placeholder="слово1, слово2, ..." rows="3">${esc(customWords)}</textarea>
            <span class="hint">
              Каждое слово компилируется в <code>\\bслово\\b</code> (case-insensitive).
              Если строка похожа на регулярку (содержит <code>[]()|</code>), она используется как есть.
            </span>
          </div>
        </div>
      </div>

      <!-- ═══════════ Свои исключения ═══════════ -->
      <div class="dict-panel">
        <div class="dict-head">
          <div class="dict-head-left">
            <i class="fa-solid fa-shield-halved" style="color:var(--green);"></i>
            <strong>Свои исключения</strong>
            <span>· глобальный whitelist</span>
          </div>
        </div>
        <div class="dict-body">
          <div class="dict-field">
            <label>Слова через запятую или с новой строки</label>
            <textarea class="input" data-custom-exceptions
                      placeholder="слово1, слово2, ..." rows="3">${esc(customExceptions)}</textarea>
            <span class="hint">
              Если whitelist-слово <b>перекрывает</b> найденный мат — срабатывание отменяется.
              Например, <code>психуй</code> перекрывает матч <code>хуй</code> и не считается матом.
            </span>
          </div>
        </div>
      </div>

    </div>`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}