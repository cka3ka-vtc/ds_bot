// server/core/interaction-reply.js
import { v2ConfigToEmbed, embedHasContent } from './v2-to-embed.js';
import { hasMessageContent } from '../../shared/message-presets.js';
import { retryDiscord } from './retry.js';
import { editReplyWithMessageConfig } from './message-sender.js';

/**
 * Универсальная отправка MessageConfig через interaction.editReply.
 *
 * Порядок:
 *   1) editReplyWithMessageConfig() — по displayMode (context/V2).
 *   2) Fallback на embed через v2ConfigToEmbed() — если V2 не сработал
 *      (несовместимость с эфемерным ответом и т.п.).
 */
export async function tryReplyWithMessageConfig(interaction, cfgMsg, tokens) {
  if (!hasMessageContent(cfgMsg)) return false;

  if (await editReplyWithMessageConfig(interaction, cfgMsg, tokens)) return true;

  const embed = v2ConfigToEmbed(cfgMsg, tokens);
  if (!embedHasContent(embed)) return false;

  try {
    await retryDiscord(
      () => interaction.editReply({
        embeds: [embed],
        allowedMentions: { parse: ['users'] },
      }),
      {
        maxAttempts: 2,
        baseDelayMs: 500,
        maxDelayMs: 3000,
        label: 'interaction.editReply.embed',
      },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Отправляет MessageConfig или fallback-текст.
 */
export async function replyWithConfig(interaction, cfgMsg, tokens, fallbackText) {
  const sent = await tryReplyWithMessageConfig(interaction, cfgMsg, tokens);
  if (sent) return;

  try {
    await retryDiscord(
      () => interaction.editReply({
        content: fallbackText,
        allowedMentions: { parse: [] },
      }),
      {
        maxAttempts: 2,
        baseDelayMs: 500,
        maxDelayMs: 3000,
        label: 'interaction.editReply.fallback',
      },
    );
  } catch {}
}