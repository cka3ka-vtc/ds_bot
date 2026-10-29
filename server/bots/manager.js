// server/bots/manager.js
import { BotInstance } from './instance.js';
import { decrypt, encrypt } from '../core/crypto.js';

export class BotManager {
  constructor({ db, logger, eventBus }) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
    this.bots = new Map();
  }

  async restoreAll() {
    const bots = this.db.getAllBots();
    for (const row of bots) {
      try {
        const token = decrypt(row.token_encrypted);
        await this._start({ id: row.id, token, isMain: !!row.is_main, name: row.name, avatarUrl: row.avatar_url });
      } catch (err) {
        this.logger.error({ err, botId: row.id }, 'failed to restore bot');
      }
    }
  }

  async addUserBot({ token, ownerId }) {
    const instance = new BotInstance({
      token, isMain: false, logger: this.logger, eventBus: this.eventBus,
    });
    await instance.start();

    this.db.createBot({
      id: instance.id,
      owner_id: ownerId,
      name: instance.name,
      avatar_url: instance.avatarUrl,
      token_encrypted: encrypt(token),
      is_main: 0,
    });

    this.bots.set(instance.id, instance);
    this.logger.info({ botId: instance.id, ownerId }, 'user bot added');
    return this._public(instance);
  }

  async removeUserBot(botId, userId) {
    const row = this.db.getBot(botId);
    if (!row) throw new Error('bot_not_found');
    if (row.is_main) throw new Error('cannot_remove_main');
    if (row.owner_id !== userId) throw new Error('forbidden');

    const inst = this.bots.get(botId);
    if (inst) { await inst.stop(); this.bots.delete(botId); }
    this.db.deleteBot(botId);
    this.logger.info({ botId, userId }, 'user bot removed');
  }

  get(id) { return this.bots.get(id); }
  all()   { return [...this.bots.values()]; }

  async shutdown() {
    await Promise.allSettled(this.all().map(b => b.stop()));
    this.bots.clear();
  }

  // ── helpers ────────────────────────────────────────────────
  async _start({ id, token, isMain, name, avatarUrl }) {
    if (id && this.bots.has(id)) return this.bots.get(id);
    const instance = new BotInstance({
      id, token, isMain, name, avatarUrl, logger: this.logger, eventBus: this.eventBus,
    });
    await instance.start();
    this.bots.set(instance.id, instance);
    this._syncProfile(instance);
    return instance;
  }

  /** Синхронизирует имя/аватар в БД, если Discord их изменил. */
  _syncProfile(instance) {
    try {
      const row = this.db.getBot(instance.id);
      if (!row) return;
      const nextName = instance.name || row.name;
      const nextAvatar = instance.avatarUrl || row.avatar_url;
      if (row.name !== nextName || row.avatar_url !== nextAvatar) {
        this.db.updateBotProfile(instance.id, { name: nextName, avatar_url: nextAvatar });
        this.logger.info(
          { botId: instance.id, fromName: row.name, toName: nextName },
          'bot profile synced',
        );
      }
    } catch (err) {
      this.logger.debug({ err, botId: instance.id }, 'profile sync failed');
    }
  }

  _public(inst) {
    return {
      id: inst.id,
      name: inst.name,
      avatarUrl: inst.avatarUrl,
      isMain: inst.isMain,
    };
  }
}