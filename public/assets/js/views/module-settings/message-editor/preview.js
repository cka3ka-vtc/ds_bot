// public/assets/js/views/module-settings/message-editor/preview.js
import { escapeHtml } from '../../../core/utils.js';
import { UI } from '/shared/ui-strings.js';
import { formatDateByCode } from './helpers.js';

export function mountPreviewMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

    _renderPreview() {
      if (!this._previewEl) return;
      const mode = this.config.displayMode || 'context';
      if (mode === 'context') {
        this._renderPreviewContent();
      } else {
        this._renderPreviewV2();
      }
    },

    /* ============ Content (markdown, отрендеренный как сообщение) ============ */

    _renderPreviewContent() {
      const markdown = this._buildMarkdownForPreview(this.config);
      const emptyText = `<div class="dp-empty">${UI.msgEditor.preview.empty}</div>`;

      if (!markdown.trim()) {
        this._previewEl.innerHTML = emptyText;
        return;
      }
      this._previewEl.innerHTML = `<div class="dp-content">${this._md(markdown, { blockMode: true })}</div>`;
    },

    _buildMarkdownForPreview(config) {
      if (!config || typeof config !== 'object') return '';
      const parts = [];

      if (config.title) {
        const t = String(config.title).trim();
        if (t) parts.push(`## ${t}`);
      }
      if (config.subtitle) {
        const s = String(config.subtitle).trim();
        if (s) parts.push(s);
      }

      for (const block of config.blocks || []) {
        switch (block.type) {
          case 'text':
          case 'section':
            if (block.content) {
              const t = String(block.content).trim();
              if (t) parts.push(t);
            }
            break;

          case 'sections': {
            const lines = [];
            if (block.title) {
              const t = String(block.title).trim();
              if (t) lines.push(`**${t}**`);
            }
            if (Array.isArray(block.items)) {
              block.items.forEach((item, i) => {
                const resolved = String(item || '').trim();
                if (!resolved) return;
                const prefix = block.listStyle === 'dot' ? '•' : `${i + 1}.`;
                lines.push(`${prefix} ${resolved}`);
              });
            }
            if (lines.length) parts.push(lines.join('\n'));
            break;
          }

          case 'separator':
            if (block.spacing === 2) {
              parts.push('');
              parts.push('━━━━━━━━━━━━━');
              parts.push('');
            } else {
              parts.push('━━━━━━━━━━━━━');
            }
            break;

          case 'footer':
            if (block.content) {
              const t = String(block.content).trim();
              if (t) parts.push(`-# ${t}`);
            }
            break;

          case 'buttons': {
            if (Array.isArray(block.buttons)) {
              const links = block.buttons
                .filter((b) => b.url && /^https?:\/\//i.test(b.url))
                .map((b) => {
                  const label = String(b.label || 'Ссылка').trim();
                  return `[${label}](${b.url})`;
                });
              if (links.length) parts.push(links.join(' · '));
            }
            break;
          }
        }
      }

      return parts.join('\n\n').trim();
    },

    /* ============ V2 / embed ============ */

    _renderPreviewV2() {
      const inner = this._buildPreviewInner(this.config);
      const emptyText = `<div class="dp-empty">${UI.msgEditor.preview.empty}</div>`;

      if (this.config.displayMode === 'flat') {
        this._previewEl.innerHTML =
          `<div style="display:flex;flex-direction:column;gap:12px;">${inner || emptyText}</div>`;
      } else {
        const color = this.config.displayMode === 'embed-color' && this.config.accentColor
          ? `border-left:4px solid ${this.config.accentColor};`
          : 'border-left:1px solid rgba(255,255,255,.08);';
        this._previewEl.innerHTML = `<div class="dp-container" style="${color}">${inner || emptyText}</div>`;
      }
    },

    _buildPreviewInner(r) {
      let html = '';

      if (r.title || r.subtitle) {
        const header = `
          <div class="dp-header-text">
            ${r.title ? `<div class="dp-title">${this._md(r.title)}</div>` : ''}
            ${r.subtitle ? `<div class="dp-subtitle">${this._md(r.subtitle)}</div>` : ''}
          </div>
        `;
        const thumbSrc = this._resolveUrl(r.thumbnail);
        html += thumbSrc
          ? `<div class="dp-header">${header}<img class="dp-thumbnail" src="${escapeHtml(thumbSrc)}" alt=""></div>`
          : `<div class="dp-header">${header}</div>`;
      }

      for (const block of r.blocks || []) {
        switch (block.type) {
          case 'text':
            if (block.content) html += `<div class="dp-text">${this._md(block.content)}</div>`;
            break;

          case 'sections': {
            let s = '';
            if (block.title) s += `<div class="dp-heading">${this._md(block.title)}</div>`;
            if (block.items?.length) {
              const itemsHtml = block.items.map((item, i) => {
                const prefix = block.listStyle === 'dot' ? '•' : (i + 1) + '.';
                return `<span style="display:inline-block;min-width:10px;color:#949ba4;">${prefix}</span>${this._md(item)}`;
              }).join('<br>');
              s += `<div class="dp-text" style="margin-top:4px;">${itemsHtml}</div>`;
            }
            if (s) html += s;
            break;
          }

          case 'separator':
            html += `<div class="dp-separator ${block.spacing == 2 ? 'large' : ''}"></div>`;
            break;

          case 'image':
          case 'file': {
            const src = this._resolveUrl(block.url);
            if (src) html += `<img class="dp-image" src="${escapeHtml(src)}" alt="">`;
            break;
          }

          case 'images': {
            const urls = (block.urls || []).map((u) => this._resolveUrl(u)).filter(Boolean);
            if (urls.length) {
              html += `<div class="dp-images-grid ${urls.length === 1 ? 'single' : ''}">${
                urls.map((u) => `<img src="${escapeHtml(u)}" alt="">`).join('')
              }</div>`;
            }
            break;
          }

          case 'buttons':
            if (block.buttons?.length) {
              html += `<div class="dp-buttons">${
                block.buttons.map((b) =>
                  `<button type="button" class="dp-btn link">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Кнопка')}</button>`,
                ).join('')
              }</div>`;
            }
            break;

          case 'role-buttons':
            if (block.buttons?.length) {
              html += `<div class="dp-buttons">${
                block.buttons.map((b) =>
                  `<button type="button" class="dp-btn ${b.style || 'primary'}">${b.emoji ? escapeHtml(b.emoji) + ' ' : ''}${escapeHtml(b.label || 'Роль')}</button>`,
                ).join('')
              }</div>`;
            }
            break;

          case 'footer':
            if (block.content) html += `<div class="dp-footer">${this._md(block.content)}</div>`;
            break;
        }
      }

      return html;
    },

    _resolveUrl(url) {
      if (!url) return '';
      const t = String(url).trim();
      if (t === '{avatarUrl}') return this._previewTokens?.avatarUrl || '';
      if (t === '{guildIconUrl}') return this._previewTokens?.guildIconUrl || '';
      if (!/^https?:\/\//i.test(t)) return '';
      return t;
    },

    /* ============ Markdown → HTML ============ */

    _md(text, { blockMode = false } = {}) {
      if (!text) return '';
      let html = escapeHtml(text);

      html = html.replace(/&lt;t:(\d+):([RrFfDdTt])&gt;/g, (_, u, c) =>
        `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(parseInt(u, 10) * 1000), c))}</span>`
      );

      html = html.replace(/\{time(?::([RrFfDdTt]))?\}/g, (_, c) =>
        `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(), c || 'f'))}</span>`
      );

      const t = this._previewTokens || {};
      const wrapMention = (v) => `<span class="dp-mention">${escapeHtml(v)}</span>`;
      const wrapBold = (v) => `<b>${escapeHtml(v)}</b>`;
      const wrapAccent = (v) => `<span style="color:#c9cdfb;">${escapeHtml(v)}</span>`;
      const esc = (v) => escapeHtml(String(v));

      html = html.replace(/\{user\}/g, wrapMention(t.user || ''));
      html = html.replace(/\{mention\}/g, wrapMention(t.mention || t.user || ''));
      html = html.replace(/\{username\}/g, wrapAccent(t.username || ''));
      html = html.replace(/\{displayName\}/g, wrapBold(t.displayName || ''));
      html = html.replace(/\{guild\}/g, wrapBold(t.guild || ''));
      html = html.replace(/\{count\}/g, t.count != null ? String(t.count) : '');

      html = html.replace(/\{level\}/g, wrapBold(t.level || ''));
      html = html.replace(/\{oldLevel\}/g, t.oldLevel != null ? String(t.oldLevel) : '');
      html = html.replace(/\{title\}/g, `<span class="dp-mention role">${escapeHtml(t.title || '')}</span>`);
      html = html.replace(/\{xp\}/g, wrapBold(t.xp || ''));
      html = html.replace(/\{nextLevelXp\}/g, t.nextLevelXp != null ? String(t.nextLevelXp) : '');
      html = html.replace(/\{xpToNext\}/g, wrapBold(t.xpToNext || ''));
      html = html.replace(/\{progress\}/g, t.progress || '');
      html = html.replace(/\{progressPercent\}/g, (t.progressPercent != null ? String(t.progressPercent) : '') + '%');
      html = html.replace(/\{position\}/g, t.position ? wrapBold('#' + t.position) : '');
      html = html.replace(/\{rank\}/g, t.rank ? wrapBold('#' + t.rank) : '');
      html = html.replace(/\{rewardRole\}/g, t.rewardRole ? wrapMention(t.rewardRole) : '');

      html = html.replace(/\{topUsers\}/g, () => {
        if (!t.topUsers) return '';
        return escapeHtml(String(t.topUsers))
          .replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="dp-mention role">@$1</span>')
          .replace(/&lt;@(\d+)&gt;/g, '<span class="dp-mention">@$1</span>')
          .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
          .replace(/\n/g, '<br>');
      });
      html = html.replace(/\{topCount\}/g, t.topCount != null ? String(t.topCount) : '');
      html = html.replace(/\{xpGained\}/g, t.xpGained != null ? wrapBold(String(t.xpGained)) : '');
      html = html.replace(/\{newXp\}/g, t.newXp != null ? wrapBold(String(t.newXp)) : '');
      html = html.replace(/\{newLevel\}/g, t.newLevel != null ? wrapBold(String(t.newLevel)) : '');

      html = html.replace(/\{nextDailyAt\}/g, () => {
        const val = t.nextDailyAt;
        if (!val || val === '__preview_tomorrow__') {
          return `<span class="dp-time-tag">через 24 часа</span>`;
        }
        const m = String(val).match(/^<t:(\d+):([RrFfDdTt])>$/);
        if (m) {
          try {
            const ts = parseInt(m[1], 10);
            if (ts * 1000 < Date.now()) {
              return `<span class="dp-time-tag">через 24 часа</span>`;
            }
            return `<span class="dp-time-tag">${escapeHtml(formatDateByCode(new Date(ts * 1000), m[2]))}</span>`;
          } catch {}
        }
        return escapeHtml(String(val));
      });

      html = html.replace(/\{streakDays\}/g, t.streakDays != null ? String(t.streakDays) : '');

      html = html.replace(/\{birthdayFull\}/g, t.birthdayFull != null ? escapeHtml(String(t.birthdayFull)) : '');
      html = html.replace(/\{birthday\}/g, t.birthday != null ? escapeHtml(String(t.birthday)) : '');
      html = html.replace(/\{birthdaysCount\}/g, t.birthdaysCount != null ? escapeHtml(String(t.birthdaysCount)) : '');
      html = html.replace(/\{age\}/g, () => {
        const age = t.age;
        if (age == null || age === '') return '';
        return escapeHtml(String(age));
      });

      html = html.replace(/\{reason\}/g,    () => (t.reason    != null ? esc(t.reason)    : ''));
      html = html.replace(/\{message\}/g,   () => (t.message   != null ? esc(t.message)   : ''));
      html = html.replace(/\{filter\}/g,    () => (t.filter    != null ? esc(t.filter)    : ''));
      html = html.replace(/\{action\}/g,    () => (t.action    != null ? esc(t.action)    : ''));
      html = html.replace(/\{violation\}/g, () => (t.violation != null ? esc(t.violation) : ''));
      html = html.replace(/\{matched\}/g,   () => (t.matched   != null ? esc(t.matched)   : ''));
      html = html.replace(/\{userId\}/g,    () => (t.userId    != null ? esc(t.userId)    : ''));
      html = html.replace(/\{channel\}/g,   () => (t.channel   != null ? wrapMention(String(t.channel)) : ''));
      html = html.replace(/\{channelText\}/g, () => (t.channelText != null ? esc(t.channelText) : ''));
      html = html.replace(/\{channelName\}/g, () => (t.channelName != null ? esc(t.channelName) : ''));

      html = html.replace(/\{avatarUrl\}/g, '<span class="dp-mention">[avatar]</span>');
      html = html.replace(/\{guildIconUrl\}/g, '<span class="dp-mention">[icon]</span>');

      // Inline markdown
      html = html.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="dp-link">$1</a>');
      html = html.replace(/\|\|(.+?)\|\|/g, '<span class="dp-spoiler">$1</span>');
      html = html.replace(/```([\s\S]+?)```/g, '<pre class="dp-code">$1</pre>');
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      html = html.replace(/__(.+?)__/g, '<u>$1</u>');
      html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
      html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');

      if (blockMode) {
        html = this._applyBlockMarkdown(html);
      } else {
        html = html.replace(/^&gt; (.+)$/gm, '<div class="dp-quote">$1</div>');
        html = html.replace(/\n/g, '<br>');
      }

      return html;
    },

    _applyBlockMarkdown(html) {
      const lines = html.split('\n');
      const out = [];
      let list = null;
      let inlineBuffer = [];

      const flushList = () => {
        if (list) {
          const cls = list.type === 'ol' ? 'dp-list dp-ol' : 'dp-list dp-ul';
          out.push(`<${list.type} class="${cls}">${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.type}>`);
          list = null;
        }
      };

      const flushInline = () => {
        let trailingBlankLines = 0;
        for (let i = inlineBuffer.length - 1; i >= 0; i--) {
          if (inlineBuffer[i].trim()) break;
          trailingBlankLines++;
        }
        while (inlineBuffer.length && !inlineBuffer[0].trim()) inlineBuffer.shift();
        while (inlineBuffer.length && !inlineBuffer[inlineBuffer.length - 1].trim()) inlineBuffer.pop();
        if (inlineBuffer.length) {
          out.push(inlineBuffer.join('<br>'));
        }
        inlineBuffer = [];
        return { trailingBlankLines };
      };

      for (const rawLine of lines) {
        let m;

        if ((m = rawLine.match(/^### (.+)$/))) { flushList(); flushInline(); out.push(`<div class="dp-h3">${m[1]}</div>`); continue; }
        if ((m = rawLine.match(/^## (.+)$/)))  { flushList(); flushInline(); out.push(`<div class="dp-h2">${m[1]}</div>`); continue; }
        if ((m = rawLine.match(/^# (.+)$/)))   { flushList(); flushInline(); out.push(`<div class="dp-h1">${m[1]}</div>`); continue; }

        if ((m = rawLine.match(/^-# (.+)$/)))  { flushList(); flushInline(); out.push(`<div class="dp-subtext">${m[1]}</div>`); continue; }

        if ((m = rawLine.match(/^&gt; (.+)$/))) { flushList(); flushInline(); out.push(`<div class="dp-quote">${m[1]}</div>`); continue; }

        if (/^━+$/.test(rawLine)) {
          flushList();
          const { trailingBlankLines } = flushInline();
          const isLarge = trailingBlankLines >= 2;
          const margin = isLarge ? '18px 0' : '8px 0';
          const cls = isLarge ? 'dp-hr dp-hr--large' : 'dp-hr';
          out.push(
            `<hr class="${cls}" data-spacing="${isLarge ? 'large' : 'small'}" ` +
            `style="border:none;border-top:1px solid rgba(255,255,255,.08);margin:${margin}">`
          );
          continue;
        }

        if ((m = rawLine.match(/^\d+\. (.+)$/))) {
          flushInline();
          if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
          list.items.push(m[1]);
          continue;
        }

        if ((m = rawLine.match(/^[•\-] (.+)$/))) {
          flushInline();
          if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
          list.items.push(m[1]);
          continue;
        }

        flushList();
        inlineBuffer.push(rawLine);
      }

      flushList();
      flushInline();

      return out.join('');
    },

  });
}