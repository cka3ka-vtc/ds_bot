// server/modules/moderation.js
import { Module } from './_base.js';

/**
 * Автомодерация:
 *  - антиспам (5+ сообщений за 3 сек)
 *  - блокировка ссылок
 *  - фильтр мата (упрощённый — список слов)
 *  - фильтр капса (70%+ заглавных)
 *  - лог в канал
 *
 * Все действия пишутся в logs.
 */
const PROFANITY = [
  'бля', 'хуй', 'пизд', 'ебан', 'ебат', 'сука', 'fuck', 'shit', 'bitch',
];

export default class ModerationModule extends Module {
  get key() {
    return 'moderation';
  }

  // In-memory rate-limit
  _spamMap = new Map();

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (!message.guild) return;
    if (message.author.bot) return;

    const botId = client.user.id;
    const { enabled, config } = await this.getConfig(botId, guildId);
    if (!enabled) return;

    // Пропускаем модераторов
    if (message.member?.permissions?.has('ManageMessages')) return;

    let reason = null;

    // ── Антиспам ──────────────────────────────────────────
    if (config.antiSpam) {
      const key = `${botId}:${guildId}:${message.author.id}`;
      const now = Date.now();
      const arr = (this._spamMap.get(key) || []).filter((t) => now - t < 3000);
      arr.push(now);
      this._spamMap.set(key, arr);

      if (arr.length >= 5) {
        reason = 'спам';
      }
    }

    // ── Фильтр мата ───────────────────────────────────────
    if (!reason && config.filterProfanity) {
      const lower = message.content.toLowerCase();
      if (PROFANITY.some((w) => lower.includes(w))) {
        reason = 'нецензурная лексика';
      }
    }

    // ── Блокировка ссылок ─────────────────────────────────
    if (!reason && config.blockLinks) {
      if (/https?:\/\/\S+/i.test(message.content)) {
        reason = 'ссылки';
      }
    }

    // ── Фильтр капса ──────────────────────────────────────
    if (!reason && config.filterCaps) {
      const letters = message.content.replace(/[^a-zA-Zа-яА-Я]/g, '');
      if (letters.length >= 10) {
        const upper = letters.replace(/[^A-ZА-Я]/g, '').length;
        if (upper / letters.length >= 0.7) {
          reason = 'капс';
        }
      }
    }

    // ── Действие ──────────────────────────────────────────
    if (reason) {
      try {
        await message.delete();
      } catch (err) {
        this.logger.warn({ err, guildId, messageId: message.id }, 'moderation: failed to delete');
        return;
      }

      this.db.addLog({
        botId,
        guildId,
        level: 'warn',
        module: 'moderation',
        message: `Удалено сообщение от ${message.author.username} (${reason})`,
        meta: {
          userId: message.author.id,
          content: message.content.slice(0, 200),
          reason,
        },
      });

      // Лог в канал (если задан)
      if (config.logChannelId) {
        const ch = await client.channels.fetch(config.logChannelId).catch(() => null);
        if (ch?.isTextBased()) {
          ch.send({
            content: `🧹 **Автомодерация:** удалено сообщение от <@${message.author.id}> — ${reason}`,
          }).catch(() => {});
        }
      }
    }
  }
}