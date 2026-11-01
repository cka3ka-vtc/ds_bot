// public/assets/js/views/module-settings/message-editor/toolbar.js
import { escapeHtml } from '../../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { positionPopup } from '../pickers.js';
import { TIME_FORMAT_CODES } from './helpers.js';

/**
 * Тулбар: форматирование markdown + вставка времени и токенов.
 *   - [data-format] кнопки — обёртка выделения (bold/italic/...);
 *   - time menu — выбор <t:now:code>;
 *   - tokens menu — вставка {token}.
 */
export function mountToolbarMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

    _toolbarHTML() {
      const T = UI.msgEditor.toolbar;
      return `
        <div class="editor-toolbar">
          <button type="button" data-format="bold" title="${T.bold}"><b>B</b></button>
          <button type="button" data-format="italic" title="${T.italic}"><i>I</i></button>
          <button type="button" data-format="underline" title="${T.underline}"><u>U</u></button>
          <button type="button" data-format="strike" title="${T.strike}"><s>S</s></button>
          <button type="button" data-format="quote" title="${T.quote}">❝</button>
          <button type="button" data-format="code" title="${T.code}">&lt;/&gt;</button>
          <button type="button" data-format="spoiler" title="${T.spoiler}">▮</button>
          <div class="toolbar-sep"></div>
          <button type="button" data-format="time" class="time-btn" title="${T.insertTime}">${T.time} ▾</button>
          <div class="toolbar-sep"></div>
          <button type="button" data-tokens-btn class="tokens-btn" title="${T.insertVariable}">${T.variables} ▾</button>
        </div>
      `;
    },

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
        const text = selected || 'цитата';
        const quoted = text.split('\n').map((l) => '> ' + l).join('\n');
        target.value = value.substring(0, start) + quoted + value.substring(end);
        target.selectionStart = start;
        target.selectionEnd = start + quoted.length;
      } else if (wrap) {
        const insert = selected || format;
        target.value = value.substring(0, start) + wrap + insert + wrap + value.substring(end);
        target.selectionStart = start + wrap.length;
        target.selectionEnd = start + wrap.length + insert.length;
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

      const dd = document.createElement('div');
      dd.className = 'tokens-dropdown';
      dd.innerHTML = this._ctx.categories.map((cat) => `
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