// public/assets/js/views/module-settings/message-editor/toolbar.js
import { escapeHtml } from '../../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { positionPopup } from '../pickers.js';
import { TIME_FORMAT_CODES } from './helpers.js';
import { isTokenAllowed } from '../message-editor-tokens.js';

/**
 * Тулбар markdown-форматирования.
 *
 * Все кнопки активны во всех контекстах (title / rich / footer) и во всех
 * режимах отображения (Обычный / Блок / Цветной):
 *   - Discord парсит markdown (**bold**, *italic*, __underline__, ~~strike~~,
 *     `code`, ||spoiler||, > цитата) и в embed title, и в embed description,
 *     и в embed footer, и в обычном content;
 *   - Timestamp <t:...> и переменные {user}, {guild} и т.д. также работают
 *     везде — их подставляет либо сам Discord (timestamp), либо builder
 *     (переменные) на сервере при отправке.
 *
 * Поэтому никаких disabled-состояний для кнопок нет.
 */
export function mountToolbarMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

    _toolbarHTML(context = 'rich') {
      const T = UI.msgEditor.toolbar;
      return `
        <div class="editor-toolbar" data-toolbar-context="${context}">
          <button type="button" data-format="bold" title="${T.bold}"><b>B</b></button>
          <button type="button" data-format="italic" title="${T.italic}"><i>I</i></button>
          <button type="button" data-format="underline" title="${T.underline}"><u>U</u></button>
          <button type="button" data-format="strike" title="${T.strike}"><s>S</s></button>
          <button type="button" data-format="quote" title="${T.quote}">❞</button>
          <button type="button" data-format="code" title="${T.code}">&lt;/&gt;</button>
          <button type="button" data-format="spoiler" title="${T.spoiler}">▮</button>
          <div class="toolbar-sep"></div>
          <button type="button" data-format="time" class="time-btn" title="${T.insertTime}">${T.time} ▾</button>
          <div class="toolbar-sep"></div>
          <button type="button" data-tokens-btn class="tokens-btn" title="${T.insertVariable}">${T.variables} ▾</button>
        </div>
      `;
    },

    /**
     * Toggle-логика: если текст уже обёрнут — снимаем wrap, а не дублируем.
     *
     *   **bold**  + клик Bold         →  bold
     *   |bold|    + клик Bold         →  **bold**
     *   **|bold|** (курсор снаружи)   + клик Bold → bold
     *   |bold| (обёрнуто, выделено)   + клик Bold → bold
     */
    _handleFormat(btn, target) {
      if (!target) return;
      const format = btn.dataset.format;
      if (format === 'time') return this._showTimeMenu(btn, target);

      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const value = target.value;
      const selected = value.substring(start, end);
      const wrap = {
        bold: '**', italic: '*', underline: '__', strike: '~~', code: '`', spoiler: '||',
      }[format];

      if (format === 'quote') {
        const beforeStart = value.substring(0, start);
        const afterEnd = value.substring(end);
        const lines = (selected || 'цитата').split('\n');
        const allQuoted = lines.length > 0 && lines.every((l) => l.startsWith('> '));

        if (selected && allQuoted) {
          const unquoted = lines.map((l) => l.replace(/^> /, '')).join('\n');
          target.value = beforeStart + unquoted + afterEnd;
          target.selectionStart = start;
          target.selectionEnd = start + unquoted.length;
        } else {
          const text = selected || 'цитата';
          const quoted = text.split('\n').map((l) => '> ' + l).join('\n');
          target.value = beforeStart + quoted + afterEnd;
          target.selectionStart = start;
          target.selectionEnd = start + quoted.length;
        }
      } else if (wrap) {
        const wrapLen = wrap.length;
        const beforeStart = value.substring(0, start);
        const afterEnd = value.substring(end);

        const alreadyWrappedOutside =
          beforeStart.endsWith(wrap) && afterEnd.startsWith(wrap);

        const alreadyWrappedInside =
          selected.length > wrapLen * 2
          && selected.startsWith(wrap)
          && selected.endsWith(wrap);

        if (alreadyWrappedInside) {
          const inner = selected.substring(wrapLen, selected.length - wrapLen);
          target.value = beforeStart + inner + afterEnd;
          target.selectionStart = start;
          target.selectionEnd = start + inner.length;
        } else if (alreadyWrappedOutside) {
          const newStart = start - wrapLen;
          const newEnd = end + wrapLen;
          target.value = value.substring(0, newStart) + selected + value.substring(newEnd);
          target.selectionStart = newStart;
          target.selectionEnd = newStart + selected.length;
        } else {
          const insert = selected || format;
          target.value = beforeStart + wrap + insert + wrap + afterEnd;
          target.selectionStart = start + wrapLen;
          target.selectionEnd = start + wrapLen + insert.length;
        }
      }

      target.focus();
      target.dispatchEvent(new Event('input', { bubbles: true }));
    },

    _showTimeMenu(anchor, target) {
      document.querySelectorAll('.time-dropdown, .tokens-dropdown, .picker-popup').forEach((d) => d.remove());

      const dd = document.createElement('div');
      dd.className = 'time-dropdown';
      dd.innerHTML = TIME_FORMAT_CODES
        .map(([code, label]) => `<button type="button" data-code="${code}">${label}</button>`)
        .join('');
      document.body.appendChild(dd);
      positionPopup(dd, anchor, 240);

      const close = (ev) => {
        if (!dd.contains(ev.target) && !anchor.contains(ev.target)) {
          dd.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', close), 0);

      dd.addEventListener('click', (e) => {
        const b = e.target.closest('[data-code]');
        if (!b) return;
        e.preventDefault();
        this._insertToken(target, `{time:${b.dataset.code}}`);
        dd.remove();
        document.removeEventListener('mousedown', close);
      });
    },

    _showTokensMenu(anchor, target) {
      document.querySelectorAll('.time-dropdown, .tokens-dropdown, .picker-popup').forEach((d) => d.remove());

      const fieldContext = target?.dataset?.tokenContext || 'rich';
      const isV2 = this.config.displayMode === 'flat';
      const H = UI.msgEditor.tokensMenu;

      const categories = this._ctx.categories
        .map((cat) => ({
          label: cat.label,
          items: cat.items.filter(([id, desc, kind]) =>
            isTokenAllowed(kind || 'text', fieldContext, isV2),
          ),
        }))
        .filter((cat) => cat.items.length > 0);

      const dd = document.createElement('div');
      dd.className = 'tokens-dropdown';

      if (!categories.length) {
        dd.innerHTML = `<div class="tokens-empty">
          <i class="fa-solid fa-circle-info"></i>
          <div>
            <strong>${escapeHtml(H.empty)}</strong>
            <span>${escapeHtml(H.emptyHint)}</span>
          </div>
        </div>`;
      } else {
        dd.innerHTML = categories.map((cat) => `
          <div class="tokens-category">
            <div class="tokens-category-label">${escapeHtml(cat.label)}</div>
            ${cat.items.map(([id, desc]) => `
              <button type="button" class="tokens-item" data-token-id="${escapeHtml(id)}">
                <code class="tokens-item-code">{${escapeHtml(id)}}</code>
                <span class="tokens-item-desc">${escapeHtml(desc || '')}</span>
              </button>
            `).join('')}
          </div>
        `).join('');

        const hint = fieldContext === 'title' ? H.titleOnlyHint
          : fieldContext === 'url' ? H.urlOnlyHint
          : fieldContext === 'label' ? H.labelHint
          : fieldContext === 'footer' ? H.footerHint
          : (isV2 && (fieldContext === 'rich')) ? H.v2Hint
          : '';
        if (hint) {
          dd.insertAdjacentHTML('afterbegin',
            `<div class="tokens-hint"><i class="fa-solid fa-info-circle"></i> ${escapeHtml(hint)}</div>`);
        }
      }

      document.body.appendChild(dd);
      positionPopup(dd, anchor, 280);

      const close = (ev) => {
        if (!dd.contains(ev.target) && !anchor.contains(ev.target)) {
          dd.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      setTimeout(() => document.addEventListener('mousedown', close), 0);

      dd.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-token-id]');
        if (!btn) return;
        e.preventDefault();
        this._insertToken(target, `{${btn.dataset.tokenId}}`);
        dd.remove();
        document.removeEventListener('mousedown', close);
      });
    },

    _insertToken(target, token) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const value = target.value;
      target.value = value.substring(0, start) + token + value.substring(end);
      target.selectionStart = target.selectionEnd = start + token.length;
      target.focus();
      target.dispatchEvent(new Event('input', { bubbles: true }));
    },

  });
}