// server/core/message-sender.js
import { buildComponentsFromConfig, FLAG_COMPONENTS_V2 } from './componentsBuilder.js';
import { v2ConfigToMarkdown } from './v2-to-markdown.js';
import { buildAllowedMentions } from './mentions.js';
import { retryDiscord } from './retry.js';

/**
 * Универсальный отправитель MessageConfig с учётом displayMode.
 *
 *   'context'               → content с markdown (v2ConfigToMarkdown):
 *                             pill-@id резолвится Discord API на отправке,
 *                             pill рендерится у всех зрителей независимо
 *                             от их клиентского кеша. allowedMentions.parse=[] — без пингов.
 *   'flat'                  → V2 Text Display (без container)
 *   'embed'                 → V2 Container
 *   'embed-color'           → V2 Container с accent_color
 *   undefined / другое      → 'context' (обратная совместимость)
 */
export async function sendMessageConfig(channel, cfgMsg, tokens, opts = {}) {
  if (!channel?.send) return null;
  const mode = cfgMsg?.displayMode || 'context';

  if (mode === 'context') {
    const markdown = v2ConfigToMarkdown(cfgMsg, tokens);
    if (!markdown.trim()) return null;

    return retryDiscord(
      () => channel.send({
        content: markdown,
        allowedMentions: { parse: [] },
      }),
      {
        maxAttempts: opts.maxAttempts ?? 3,
        baseDelayMs: opts.baseDelayMs ?? 800,
        maxDelayMs: opts.maxDelayMs ?? 8000,
        label: opts.label || 'sendMessageConfig.context',
        logger: opts.logger,
        context: opts.context,
      },
    );
  }

  const components = buildComponentsFromConfig(cfgMsg, tokens);
  if (!components?.length) return null;

  return retryDiscord(
    () => channel.send({
      flags: FLAG_COMPONENTS_V2,
      components,
      allowedMentions: buildAllowedMentions(components, { ping: !!opts.ping }),
    }),
    {
      maxAttempts: opts.maxAttempts ?? 3,
      baseDelayMs: opts.baseDelayMs ?? 800,
      maxDelayMs: opts.maxDelayMs ?? 8000,
      label: opts.label || 'sendMessageConfig.v2',
      logger: opts.logger,
      context: opts.context,
    },
  );
}

/**
 * Аналог sendMessageConfig для interaction.editReply.
 * Возвращает true, если сообщение отправлено.
 */
export async function editReplyWithMessageConfig(interaction, cfgMsg, tokens, opts = {}) {
  const mode = cfgMsg?.displayMode || 'context';

  if (mode === 'context') {
    const markdown = v2ConfigToMarkdown(cfgMsg, tokens);
    if (!markdown.trim()) return false;

    try {
      await retryDiscord(
        () => interaction.editReply({
          content: markdown,
          allowedMentions: { parse: [] },
        }),
        {
          maxAttempts: opts.maxAttempts ?? 2,
          baseDelayMs: opts.baseDelayMs ?? 500,
          maxDelayMs: opts.maxDelayMs ?? 3000,
          label: opts.label || 'interaction.editReply.markdown',
        },
      );
      return true;
    } catch { return false; }
  }

  const components = buildComponentsFromConfig(cfgMsg, tokens);
  if (!components?.length) return false;

  try {
    await retryDiscord(
      () => interaction.editReply({
        flags: FLAG_COMPONENTS_V2,
        components,
        allowedMentions: buildAllowedMentions(components, { ping: !!opts.ping }),
      }),
      {
        maxAttempts: opts.maxAttempts ?? 2,
        baseDelayMs: opts.baseDelayMs ?? 500,
        maxDelayMs: opts.maxDelayMs ?? 3000,
        label: opts.label || 'interaction.editReply.v2',
      },
    );
    return true;
  } catch { return false; }
}