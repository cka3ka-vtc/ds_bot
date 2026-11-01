// server/core/v2-to-embed.js
import { EmbedBuilder } from 'discord.js';

export function resolveTokensText(text, tokens) {
  if (!text) return '';
  return String(text).replace(/\{(\w+)\}/g, (m, key) =>
    tokens[key] != null ? String(tokens[key]) : m,
  );
}

/**
 * Конвертирует V2-конфиг сообщения (title/subtitle/blocks) в EmbedBuilder.
 * Игнорирует: media, images, buttons, role-buttons.
 * Использует: title, subtitle, text/sections (в description),
 * footer, thumbnail, accentColor.
 */
export function v2ConfigToEmbed(config, tokens) {
  const embed = new EmbedBuilder();

  const color = typeof config?.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(config.accentColor)
    ? config.accentColor
    : '#5865F2';
  embed.setColor(color);

  const parts = [];

  if (config?.title) {
    const t = resolveTokensText(config.title, tokens);
    if (t) embed.setTitle(t.slice(0, 256));
  }

  if (config?.subtitle) {
    const s = resolveTokensText(config.subtitle, tokens);
    if (s) parts.push(s);
  }

  let footerText = '';

  for (const block of config?.blocks || []) {
    switch (block.type) {
      case 'text':
      case 'section':
        if (block.content) parts.push(resolveTokensText(block.content, tokens));
        break;

      case 'sections': {
        if (block.title) parts.push(`\n**${resolveTokensText(block.title, tokens)}**`);
        if (Array.isArray(block.items) && block.items.length) {
          block.items.forEach((item, i) => {
            const resolved = resolveTokensText(item, tokens);
            if (!resolved) return;
            const prefix = block.listStyle === 'dot' ? '•' : `${i + 1}.`;
            parts.push(`${prefix} ${resolved}`);
          });
        }
        break;
      }

      case 'separator':
        parts.push('────────────────────');
        break;

      case 'footer':
        if (block.content) {
          footerText = resolveTokensText(block.content, tokens).slice(0, 2048);
        }
        break;

      default:
        break;
    }
  }

  if (parts.length) {
    const desc = parts.join('\n').trim();
    if (desc) embed.setDescription(desc.slice(0, 4096));
  }

  if (footerText) embed.setFooter({ text: footerText });

  if (config?.thumbnail) {
    const url = resolveTokensText(config.thumbnail, tokens).trim();
    if (/^https?:\/\//i.test(url)) {
      try { embed.setThumbnail(url); } catch {}
    }
  }

  return embed;
}

export function embedHasContent(embed) {
  const json = typeof embed?.toJSON === 'function' ? embed.toJSON() : (embed || {});
  return !!(
    json.title ||
    json.description ||
    json.footer?.text ||
    (Array.isArray(json.fields) && json.fields.length) ||
    json.image?.url ||
    json.thumbnail?.url
  );
}