// server/core/v2-to-markdown.js
/**
 * Рендерит MessageConfig (V2-блоки) в плоский Discord-markdown.
 * Используется, когда сообщение нужно отправить как `content`, чтобы
 * `<@id>` резолвился Discord API на отправке (pill у всех зрителей,
 * не зависит от их клиентского кеша).
 *
 * Что сохраняется: title (##), subtitle, text, sections (список),
 * separator, footer (-#), link-buttons (как markdown-ссылки).
 * Что теряется: embed-цвета, thumbnail, images, file, role-buttons
 * (Discord не поддерживает это в content).
 *
 * Discord лимит content = 2000 символов. При превышении обрезаем.
 */

const CONTENT_LIMIT = 2000;

function resolveTokens(text, tokens) {
  if (!text) return '';
  return String(text).replace(/\{(\w+)\}/g, (m, key) =>
    tokens[key] != null ? String(tokens[key]) : m,
  );
}

export function v2ConfigToMarkdown(config, tokens) {
  if (!config || typeof config !== 'object') return '';

  const parts = [];

  if (config.title) {
    const t = resolveTokens(config.title, tokens).trim();
    if (t) parts.push(`## ${t}`);
  }
  if (config.subtitle) {
    const s = resolveTokens(config.subtitle, tokens).trim();
    if (s) parts.push(s);
  }

  for (const block of config.blocks || []) {
    switch (block.type) {
      case 'text':
      case 'section':
        if (block.content) {
          const t = resolveTokens(block.content, tokens).trim();
          if (t) parts.push(t);
        }
        break;

      case 'sections': {
        const lines = [];
        if (block.title) {
          const t = resolveTokens(block.title, tokens).trim();
          if (t) lines.push(`**${t}**`);
        }
        if (Array.isArray(block.items)) {
          block.items.forEach((item, i) => {
            const resolved = resolveTokens(item, tokens).trim();
            if (!resolved) return;
            const prefix = block.listStyle === 'dot' ? '•' : `${i + 1}.`;
            lines.push(`${prefix} ${resolved}`);
          });
        }
        if (lines.length) parts.push(lines.join('\n'));
        break;
      }

      case 'separator':
        parts.push('━━━━━━━━━━━━━');
        break;

      case 'footer':
        if (block.content) {
          const t = resolveTokens(block.content, tokens).trim();
          if (t) parts.push(`-# ${t}`);
        }
        break;

      case 'buttons': {
        if (Array.isArray(block.buttons)) {
          const links = block.buttons
            .filter((b) => b.url && /^https?:\/\//i.test(b.url))
            .map((b) => {
              const label = resolveTokens(b.label || 'Ссылка', tokens).trim();
              return `[${label}](${b.url})`;
            });
          if (links.length) parts.push(links.join(' · '));
        }
        break;
      }

      // image, images, file, role-buttons — пропускаем:
      // Discord не поддерживает их в content.
    }
  }

  let out = parts.join('\n\n').trim();
  if (out.length > CONTENT_LIMIT) {
    out = out.slice(0, CONTENT_LIMIT - 3) + '...';
  }
  return out;
}