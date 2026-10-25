/* ============================================================
   Менеджер ботов.

   Отвечает за:
   - запуск активного Discord-клиента по токену из config.json
   - переключение между ботами (смена токена на лету)
   - управление статусом (activity) активного бота
   - добавление/удаление/валидацию токенов
   - статистику (пинг, uptime, память, количество серверов)

   Клиент создаётся здесь, а не в client.js, потому что:
   - при смене токена старый клиент должен быть destroy()'нут
   - синглтон из client.js просто получает ссылку через setClientRef
   ============================================================ */

import { Client, ActivityType } from 'discord.js';
import fs from 'fs';
import { INTENTS, setClientRef } from './client.js';
import { CONFIG_PATH } from '../config/index.js';

/* Маппинг «строковый тип из UI → ActivityType из discord.js» */
const ACTIVITY_TYPES = {
  PLAYING:   ActivityType.Playing,
  WATCHING:  ActivityType.Watching,
  LISTENING: ActivityType.Listening,
  COMPETING: ActivityType.Competing,
  STREAMING: ActivityType.Streaming
};

/* ---------- Низкоуровневые операции с файлом ---------- */

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

/* ---------- Класс ---------- */

export class BotManager {
  /**
   * @param {object} opts
   * @param {(client: Client, bot: object) => Promise<void>|void} opts.onReady
   * @param {(interaction: object, client: Client) => Promise<void>|void} opts.onInteraction
   */
  constructor({ onReady, onInteraction }) {
    this.onReady = onReady;
    this.onInteraction = onInteraction;

    this.client = null;      // активный Discord-клиент
    this.activeId = null;    // id активного бота из конфига
    this.swapping = false;   // защита от параллельных swap
    this.readyAt = null;     // timestamp готовности (для uptime)
  }

  /* ---------- Чтение конфига ---------- */

  getConfig() {
    return loadConfig();
  }

  /**
   * Список ботов из конфига + статус каждого.
   * @returns {Array<{ id, label, activity, isActive, online }>}
   */
  listBots() {
    const cfg = this.getConfig();
    return cfg.bots.map(b => ({
      id: b.id,
      label: b.label,
      activity: b.activity,
      isActive: b.id === cfg.activeBotId,
      online: b.id === this.activeId && this.client?.isReady()
    }));
  }

  /* ---------- Запуск / остановка ---------- */

  /**
   * Запускает бота по id (или активного из конфига).
   * @param {string} [botId]
   * @returns {Promise<Client>}
   */
  async start(botId) {
    if (this.client) await this.stop();

    const cfg = this.getConfig();
    const bot = botId
      ? cfg.bots.find(b => b.id === botId)
      : cfg.bots.find(b => b.id === cfg.activeBotId);

    if (!bot) throw new Error(`Бот "${botId}" не найден в config.json`);

    const client = new Client({ intents: INTENTS });
    client.token = bot.token;

    /* ВАЖНО: фиксируем клиент в синглтоне ДО login,
       чтобы getClient() внутри onReady уже видел новый клиент */
    this.client = client;
    this.activeId = bot.id;
    setClientRef(client);

    client.once('ready', () => {
      this.readyAt = Date.now();
      this.applyActivity(bot.activity).catch(() => {});
      try { this.onReady?.(client, bot); }
      catch (e) { console.error('[bot-manager] onReady:', e); }
    });

    /* onInteraction вешаем только если передан —
       иначе пусть registerInteractionHandlers сам всё сделает */
    if (this.onInteraction) {
      client.on('interactionCreate', (i) => this.onInteraction(i, client));
    }

    client.on('error', (e) => console.error('[Discord client error]', e.message));
    client.on('warn', (msg) => console.warn('[Discord warn]', msg));

    await client.login(bot.token);

    if (cfg.activeBotId !== bot.id) {
      cfg.activeBotId = bot.id;
      saveConfig(cfg);
    }

    return client;
  }

  /**
   * Останавливает активного бота (destroy client).
   */
  async stop() {
    if (!this.client) return;
    try { await this.client.destroy(); }
    catch (e) { console.error('[bot-manager] destroy:', e.message); }
    this.client = null;
    this.activeId = null;
    this.readyAt = null;
    setClientRef(null);
  }

  /**
   * Переключает активного бота. Блокирует параллельные вызовы.
   * @param {string} botId
   * @returns {Promise<{ id: string, label: string, tag: string }>}
   */
  async switchTo(botId) {
    if (this.swapping) throw new Error('Переключение уже выполняется');
    this.swapping = true;

    try {
      const cfg = this.getConfig();
      const target = cfg.bots.find(b => b.id === botId);
      if (!target) throw new Error(`Бот "${botId}" не найден`);

      console.log(`[bot-manager] Переключаемся на "${target.label}" (${target.id})`);
      await this.start(botId);

      return {
        id: target.id,
        label: target.label,
        tag: this.client.user.tag
      };
    } finally {
      this.swapping = false;
    }
  }

  /* ---------- Статус (activity) ---------- */

  /**
   * Применяет activity к текущему клиенту.
   * @param {{ type: string, text: string, url?: string|null }} activity
   */
  async applyActivity(activity) {
    if (!this.client?.user) return;

    if (!activity || !activity.text) {
      this.client.user.setActivity(null);
      return;
    }

    const type = ACTIVITY_TYPES[activity.type] || ActivityType.Watching;
    const opts = { type, name: activity.text };
    if (activity.type === 'STREAMING' && activity.url) opts.url = activity.url;

    this.client.user.setActivity(opts.name, opts);
  }

  /**
   * Меняет activity активного бота и сохраняет в конфиг.
   * @param {{ type: string, text: string, url?: string|null }} activity
   * @returns {Promise<object>} сохранённая activity
   */
  async setActiveActivity(activity) {
    const cfg = this.getConfig();
    const bot = cfg.bots.find(b => b.id === cfg.activeBotId);
    if (!bot) throw new Error('Активный бот не найден');

    bot.activity = activity;
    saveConfig(cfg);
    await this.applyActivity(activity);

    return activity;
  }

  /* ---------- Управление списком ботов ---------- */

  /**
   * Добавляет нового бота или обновляет существующего по id.
   * @param {{ id, label, token, activity? }} payload
   * @returns {Promise<{ id: string, label: string }>}
   */
  async upsertBot({ id, label, token, activity }) {
    if (!id || !token) throw new Error('id и token обязательны');

    const cfg = this.getConfig();
    const idx = cfg.bots.findIndex(b => b.id === id);

    const payload = {
      id,
      label: label || id,
      token,
      activity: activity || { type: 'WATCHING', text: 'за сервером', url: null }
    };

    if (idx >= 0) cfg.bots[idx] = payload;
    else cfg.bots.push(payload);

    saveConfig(cfg);
    return { id, label: payload.label };
  }

  /**
   * Удаляет бота из конфига.
   * Запрещено удалять последнего и активного.
   * @param {string} id
   */
  async removeBot(id) {
    const cfg = this.getConfig();
    if (cfg.bots.length <= 1) throw new Error('Нельзя удалить единственного бота');
    if (cfg.activeBotId === id) throw new Error('Нельзя удалить активного бота. Переключитесь сначала.');

    cfg.bots = cfg.bots.filter(b => b.id !== id);
    saveConfig(cfg);
  }

  /**
   * Проверяет токен во временном клиенте (без изменения состояния).
   * @param {string} token
   * @returns {Promise<{ ok: true, tag: string, id: string } | { ok: false, error: string }>}
   */
  async validateToken(token) {
    const probe = new Client({ intents: INTENTS });
    try {
      await probe.login(token);
      const user = probe.user;
      await probe.destroy();
      return { ok: true, tag: user.tag, id: user.id };
    } catch (e) {
      try { await probe.destroy(); } catch {}
      return { ok: false, error: e.message };
    }
  }

  /* ---------- Статистика ---------- */

  /**
   * Возвращает статистику активного бота для панели.
   * @returns {object}
   */
  getStats() {
    const client = this.client;
    if (!client) return { online: false };

    return {
      online: !!client.isReady(),
      tag: client.user?.tag ?? null,
      id: client.user?.id ?? null,
      guilds: client.guilds?.cache?.size ?? 0,
      users: client.guilds?.cache?.reduce((s, g) => s + (g.memberCount || 0), 0) ?? 0,
      ping: client.ws?.ping ?? -1,
      uptimeMs: this.readyAt ? Date.now() - this.readyAt : 0,
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    };
  }
}