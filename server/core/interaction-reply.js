// server/core/interaction-reply.js
import { v2ConfigToEmbed, embedHasContent } from './v2-to-embed.js';
import { hasMessageContent } from '../../shared/message-presets.js';
import { retryDiscord } from './retry.js';

/**
 * Пытается ответить на interaction через messageConfig:
 *   1. Есть контент? → embed (V2→embed-конвертация).
 *   2. Retry при 429/5xx — interaction после deferReply живёт 15 минут,
 *      успеть повторить безопасно.
 *   3. 40060/10062 (interaction dead) — не retry'ится, вернёт false.
 *
 * Возвращает Promise<boolean>: true — отправлено; false — конфиг пуст / ошибка.
 */
export async function tryReplyWithMessageConfig(interaction, cfgMsg, tokens) {
  if (!hasMessageContent(cfgMsg)) return false;

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
        label: 'interaction.editReply',
      },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Ответ через messageConfig, если возможно; иначе — текстом.
 * Гарантированно отправляет что-то.
 */
export async function replyWithConfig(interaction, cfgMsg, tokens, fallbackText) {
  const sent = await tryReplyWithMessageConfig(interaction, cfgMsg, tokens);
  if (sent) return;

  try {
    await retryDiscord(
      () => interaction.editReply({
        content: fallbackText,
        allowedMentions: { parse: ['users'] },
      }),
      {
        maxAttempts: 2,
        baseDelayMs: 500,
        maxDelayMs: 3000,
        label: 'interaction.editReply.fallback',
      },
    );
  } catch {
    // уже ничего не сделать — interaction dead
  }
}