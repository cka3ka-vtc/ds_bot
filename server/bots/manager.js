// server/bots/manager.js
import { BotInstance } from './instance.js';
import { decrypt, encrypt } from '../core/crypto.js';

export class BotManager {
  constructor({ db, logger, eventBus }) {
    this.db = db;
    this.logger = logger;
    this.eventBus = eventBus;
    this.bots = new Map();
    this._starting = new Map(); // botId -> Promise<BotInstance>, защита от race
  }

  /**
   * Параллельное восстановление всех ботов. Для N ботов login идёт
   * параллельно (ограничение Discord — 1000 идентификаций/сутки на приложение,
   * реальные инсталлы — десятки, не сотни). Ускоряет старт в N раз.
   */
  async restoreAll() {
    const bots = this.db.getAllBots();
    if (!bots.length) return;

    const results = await Promise.allSettled(bots.map((row) => this._restoreOne(row)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.warn(
        { total: bots.length, failed },
        'bots: some instances failed to restore',
      );
    }
  }

  async _restoreOne(row) {
    try {
      const token = decrypt(row.token_encrypted);
      await this._start({
        id: row.id, token,
        isMain: !!row.is_main,
        name: row.name,
        avatarUrl: row.avatar_url,
      });
    } catch (err) {
      this.logger.error({ err, botId: row.id }, 'failed to restore bot');
      throw err;
    }
  }

  async addUserBot({ token, ownerId }) {
    const instance = new BotInstance({
      token, isMain: false, logger: this.logger, eventBus: this.eventBus,
    });
    await instance.start();

    try {
      this.db.createBot({
        id: instance.id,
        owner_id: ownerId,
        name: instance.name,
        avatar_url: instance.avatarUrl,
        token_encrypted: encrypt(token),
        is_main: 0,
      });
    } catch (err) {
      try { await instance.stop(); } catch {}
      this.logger.error(
        { err, botId: instance.id, ownerId },
        'addUserBot: createBot failed, instance stopped',
      );
      throw err;
    }

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
    this._starting.clear();
  }

  /**
   * Запуск с защитой от race. Если два параллельных вызова _start
   * для одного botId — второй ждёт результат первого, не создаёт второй клиент.
   */
  async _start({ id, token, isMain, name, avatarUrl }) {
    if (id && this.bots.has(id)) return this.bots.get(id);

    const key = id || token.slice(0, 16); // fallback: токен как ключ до login
    if (this._starting.has(key)) return this._starting.get(key);

    const promise = (async () => {
      const instance = new BotInstance({
        id, token, isMain, name, avatarUrl, logger: this.logger, eventBus: this.eventBus,
      });
      await instance.start();
      this.bots.set(instance.id, instance);
      this._syncProfile(instance);
      return instance;
    })();

    this._starting.set(key, promise);
    try {
      return await promise;
    } finally {
      this._starting.delete(key);
    }
  }

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