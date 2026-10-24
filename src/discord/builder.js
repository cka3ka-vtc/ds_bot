import { MessageFlags } from 'discord.js';
import { resolveTokens } from '../services/tokens.js';

export const FLAG_COMPONENTS_V2 = (MessageFlags && MessageFlags.IsComponentsV2) || 32768;
export const FLAG_EPHEMERAL = (MessageFlags && MessageFlags.Ephemeral) || 64;

function parseEmoji(raw) {
  const s = String(raw).trim();
  const custom = s.match(/^<a?:([^:]+):(\d+)>$/);
  if (custom) return { name: custom[1], id: custom[2] };
  return { name: s };
}

export function buildComponentsFromConfig(config, opts = {}) {
  const inner = [];
  const hasHeader = config.title || config.subtitle;

  if (hasHeader) {
    const title = resolveTokens(config.title, opts);
    const subtitle = resolveTokens(config.subtitle, opts);
    if (config.thumbnail) {
      const secComps = [];
      if (title) secComps.push({ type: 10, content: `# ${title}` });
      if (subtitle) secComps.push({ type: 10, content: subtitle });
      inner.push({ type: 9, components: secComps, accessory: { type: 11, media: { url: config.thumbnail } } });
    } else {
      if (title) inner.push({ type: 10, content: `# ${title}` });
      if (subtitle) inner.push({ type: 10, content: subtitle });
    }
  }

  for (const block of config.blocks || []) {
    switch (block.type) {
      case 'text':
      case 'section':
        inner.push({ type: 10, content: resolveTokens(block.content, opts) || '\u200b' });
        break;

      case 'sections': {
        let md = '';
        if (block.title) md += `### ${resolveTokens(block.title, opts)}`;
        if (block.items && block.items.length) {
          const lines = block.items.map((item, i) => {
            const resolved = resolveTokens(item, opts);
            return block.listStyle === 'dot' ? `· ${resolved}` : `${i + 1}. ${resolved}`;
          });
          md += (md ? '\n' : '') + lines.join('\n');
        }
        if (md) inner.push({ type: 10, content: md });
        break;
      }

      case 'separator':
        inner.push({ type: 14, divider: block.divider !== false, spacing: block.spacing === 2 ? 2 : 1 });
        break;

      case 'image':
        if (block.url) inner.push({ type: 12, items: [{ media: { url: resolveTokens(block.url, opts) } }] });
        break;

      case 'images': {
        const urls = (block.urls || []).map(u => resolveTokens(u, opts)).filter(Boolean).slice(0, 10);
        if (urls.length) inner.push({ type: 12, items: urls.map(u => ({ media: { url: u } })) });
        break;
      }

      case 'file':
        if (block.url) inner.push({ type: 12, items: [{ media: { url: resolveTokens(block.url, opts) } }] });
        break;

      case 'buttons': {
        if (!block.buttons?.length) break;
        const comps = block.buttons.slice(0, 5).map(b => {
          const label = resolveTokens(b.label || 'Ссылка', opts).slice(0, 80);
          const rawUrl = resolveTokens(b.url || '', opts).trim();
          const url = /^https?:\/\/.+/i.test(rawUrl) ? rawUrl : 'https://discord.com';
          const comp = {
            type: 2,
            style: 5,
            label,
            url
          };
          if (b.emoji) comp.emoji = parseEmoji(b.emoji);
          if (b.disabled) comp.disabled = true;
          return comp;
        });
        inner.push({ type: 1, components: comps });
        break;
      }

      case 'role-buttons': {
        if (!block.buttons?.length) break;
        const styleMap = { primary: 1, secondary: 2, success: 3, danger: 4 };
        const comps = block.buttons.slice(0, 5).map(b => {
          const comp = {
            type: 2,
            style: styleMap[b.style] || 1,
            label: resolveTokens(b.label || 'Role', opts).slice(0, 80),
            custom_id: `role_${opts.section || 'rules'}_${b.roleId}_${b.id}`
          };
          if (b.emoji) comp.emoji = parseEmoji(b.emoji);
          return comp;
        });
        inner.push({ type: 1, components: comps });
        break;
      }

      case 'footer':
        if (block.content) inner.push({ type: 10, content: `-# ${resolveTokens(block.content, opts)}` });
        break;
    }
  }

  if (config.displayMode === 'flat') return inner;

  const container = { type: 17, components: inner };
  if (config.displayMode === 'embed-color' && config.accentColor) {
    const hex = config.accentColor.replace('#', '');
    const num = parseInt(hex, 16);
    if (!isNaN(num)) container.accent_color = num;
  }
  return [container];
}

export const LIMITS = {
  ACTION_ROW_BUTTONS: 5,
  MAX_COMPONENTS: 40,
  TEXT_LENGTH: 4000,
  TITLE_LENGTH: 4000,
  LABEL_LENGTH: 80,
  MEDIA_GALLERY_ITEMS: 10
};