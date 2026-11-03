// server/core/componentsBuilder.js
//
// Построитель Discord Components v2 из конфига MessageEditor.
// Ограничения Discord:
//   - 40 top-level компонентов в одном сообщении
//   - 5 кнопок в ActionRow
//   - 80 символов label
//   - контейнер (type 17) не может содержать >40 вложенных
//
// Мы резервируем место для header (title + subtitle = до 2) — поэтому
// блоки ограничены 30.

export const FLAG_COMPONENTS_V2 = 32768;

const MAX_TOP_LEVEL = 40;
const MAX_BLOCKS = 30;

function resolveTokens(text, opts) {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/\{time(?::([RrFfDdTt]))?\}/g, (_, code) => {
    const c = code || 'f';
    return `<t:${Math.floor(Date.now() / 1000)}:${c}>`;
  });
  out = out.replace(/\{(\w+)\}/g, (m, key) => {
    return opts[key] != null ? String(opts[key]) : m;
  });
  return out;
}

function parseEmoji(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  try {
    const custom = s.match(/^<a?:([^:]+):(\d+)>$/);
    if (custom) return { name: custom[1], id: custom[2] };
    return { name: s };
  } catch {
    return null;
  }
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
      inner.push({
        type: 9,
        components: secComps,
        accessory: { type: 11, media: { url: resolveTokens(config.thumbnail, opts) } },
      });
    } else {
      if (title) inner.push({ type: 10, content: `# ${title}` });
      if (subtitle) inner.push({ type: 10, content: subtitle });
    }
  }

  const blocks = (config.blocks || []).slice(0, MAX_BLOCKS);
  for (const block of blocks) {
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
            return block.listStyle === 'dot' ? `• ${resolved}` : `${i + 1}. ${resolved}`;
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
      case 'file':
        if (block.url) inner.push({ type: 12, items: [{ media: { url: resolveTokens(block.url, opts) } }] });
        break;

      case 'images': {
        const urls = (block.urls || []).map((u) => resolveTokens(u, opts)).filter(Boolean).slice(0, 10);
        if (urls.length) inner.push({ type: 12, items: urls.map((u) => ({ media: { url: u } })) });
        break;
      }

      case 'buttons': {
        if (!block.buttons?.length) break;
        const comps = block.buttons.slice(0, 5).map((b) => {
          const label = resolveTokens(b.label || 'Кнопка', opts).slice(0, 80);
          const rawUrl = resolveTokens(b.url || '', opts).trim();
          const url = /^https?:\/\/.+/i.test(rawUrl) ? rawUrl : 'https://discord.com';
          const comp = { type: 2, style: 5, label, url };
          if (b.emoji) {
            const e = parseEmoji(b.emoji);
            if (e) comp.emoji = e;
          }
          if (b.disabled) comp.disabled = true;
          return comp;
        });
        inner.push({ type: 1, components: comps });
        break;
      }

      case 'role-buttons': {
        if (!block.buttons?.length) break;
        const styleMap = { primary: 1, secondary: 2, success: 3, danger: 4 };
        const comps = block.buttons.slice(0, 5).map((b) => {
          // КРИТИЧНО: custom_id формируется как role_<section>_<roleId>_<buttonId>.
          // section = opts.section (напр. 'greetings'), fallback 'greetings'.
          // Обработчик кликов в app/events/interaction.js — handleRoleButton().
          const comp = {
            type: 2,
            style: styleMap[b.style] || 1,
            label: resolveTokens(b.label || 'Роль', opts).slice(0, 80),
            custom_id: `role_${opts.section || 'greetings'}_${b.roleId}_${b.id}`,
          };
          if (b.emoji) {
            const e = parseEmoji(b.emoji);
            if (e) comp.emoji = e;
          }
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

  if (!inner.length) return [];

  const trimmed = inner.length > MAX_TOP_LEVEL ? inner.slice(0, MAX_TOP_LEVEL) : inner;

  if (config.displayMode === 'flat') return trimmed;

  const container = { type: 17, components: trimmed };
  if (config.displayMode === 'embed-color' && config.accentColor) {
    const num = parseInt(String(config.accentColor).replace('#', ''), 16);
    if (!isNaN(num)) container.accent_color = num;
  }
  return [container];
}