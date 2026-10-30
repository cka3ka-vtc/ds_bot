// server/modules/moderation.js
import { Module } from './_base.js';

const PROFANITY = [
  'бля', 'хуй', 'пизд', 'ебан', 'ебат', 'сука', 'fuck', 'shit', 'bitch',
];

const SPAM_WINDOW_MS = 3000;
const SPAM_THRESHOLD = 5;
const SPAM_MAP_TTL = 60_000;

export default class ModerationModule extends Module {
  get key() { return 'moderation'; }

  constructor(ctx) {
    super(ctx);
    this._spamMap = new Map();
    this._cleanupInterval = null;
  }

  async register() {
    this._cleanupInterval = setInterval(() => this._cleanupSpamMap(), SPAM_MAP_TTL);
    this.logger.info({ module: 'moderation' }, 'moderation: registered');
  }

  async unregister() {
    clearInterval(this._cleanupInterval);
    this._spamMap.clear();
  }

  _cleanupSpamMap() {
    const cutoff = Date.now() - SPAM_MAP_TTL;
    for (const [key, arr] of this._spamMap) {
      const fresh = (arr || []).filter((t) => t > cutoff);
      if (!fresh.length) this._spamMap.delete(key);
      else this._spamMap.set(key, fresh);
    }
  }

  async onEvent({ event, client, guildId, message }) {
    if (event !== 'messageCreate') return;
    if (!message.guild) return;
    if (message.author.bot) return;

    const botId = client.user.id;
    const { enabled, config } = await this.getConfig(botId, guildId);
    if (!enabled) return;

    // Защита от холодного кеша: если участника нет — не рискуем
    // удалять его сообщения (мог быть админом/модератором).
    if (!message.member) return;
    if (message.member.permissions?.has?.('ManageMessages')) return;

    let reason = null;

    if (config.antiSpam) {
      const key = `${botId}:${guildId}:${message.author.id}`;
      const now = Date.now();
      const arr = (this._spamMap.get(key) || []).filter((t) => now - t < SPAM_WINDOW_MS);
      arr.push(now);
      this._spamMap.set(key, arr);
      if (arr.length >= SPAM_THRESHOLD) reason = 'спам';
    }

    if (!reason && config.filterProfanity) {
      const lower = message.content.toLowerCase();
      if (PROFANITY.some((w) => lower.includes(w))) reason = 'нецензурная лексика';
    }

    if (!reason && config.blockLinks) {
      if (/https?:\/\/\S+/i.test(message.content)) reason = 'ссылки';
    }

    if (!reason && config.filterCaps) {
      const letters = message.content.replace(/[^a-zA-Zа-яА-Я]/g, '');
      if (letters.length >= 10) {
        const upper = letters.replace(/[^A-ZА-Я]/g, '').length;
        if (upper / letters.length >= 0.7) reason = 'капс';
      }
    }

    if (!reason) return;

    try {
      await message.delete();
    } catch (err) {
      this.logger.warn({ err, guildId, messageId: message.id }, 'moderation: failed to delete');
      return;
    }

    this.db.addLog(botId, guildId, {
      level: 'warn',
      module: 'moderation',
      message: `Удалено сообщение от ${message.author.username} (${reason})`,
      meta: {
        userId: message.author.id,
        content: message.content.slice(0, 200),
        reason,
      },
    });

    if (config.logChannelId) {
      const ch = await client.channels.fetch(config.logChannelId).catch(() => null);
      if (ch?.isTextBased() && ch.guild.id === guildId) {
        ch.send({
          content: `🧹 **Автомодерация:** удалено сообщение от <@${message.author.id}> — ${reason}`,
          allowedMentions: { parse: [] },
        }).catch(() => {});
      }
    }
  }
}