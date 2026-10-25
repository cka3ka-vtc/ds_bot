/* ============================================================
   Низкоуровневый доступ к Discord-клиенту.

   Здесь:
   - список интентов
   - singleton-ссылка на активный клиент (её ставит BotManager)
   - предзагрузка presence / member cache
   - проверка, что нужные privileged intents включены

   ВАЖНО: этот файл НЕ создаёт клиент самостоятельно.
   Создание и логин — в BotManager (см. bot-manager.js).
   Синглтон нужен, чтобы routes/api.js, scheduler и кэш
   могли получить доступ к клиенту из любого места.
   ============================================================ */

import { GatewayIntentBits } from 'discord.js';

/* ============================================================
   Интенты
   ------------------------------------------------------------
   Guilds         — slash-команды и базовые события
   GuildMembers   — проверка ролей (birthdays, profiles)
   GuildPresences — счётчик online в панели
   GuildMessages  — messageCreate для autodelete и redirect
   MessageContent — чтение содержимого legacy `!` команд
                    (включить в Developer Portal → Bot)
   ============================================================ */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildPresences,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
];

/* ============================================================
   Синглтон активного клиента
   ============================================================ */

let _clientRef = null;

/**
 * Устанавливает ссылку на клиент. Вызывается из BotManager
 * после успешного логина (и сбрасывается в null при stop).
 * @param {import('discord.js').Client|null} client
 */
export function setClientRef(client) {
  _clientRef = client;
}

/**
 * Возвращает клиент или null, если он ещё не готов.
 * @returns {import('discord.js').Client|null}
 */
export function getClientSafe() {
  return _clientRef;
}

/**
 * Возвращает клиент или бросает исключение.
 * Используется в местах, где клиент точно должен быть.
 * @returns {import('discord.js').Client}
 * @throws Если клиент не инициализирован
 */
export function getClient() {
  if (!_clientRef) throw new Error('Discord client is not initialized');
  return _clientRef;
}

/* ============================================================
   Предзагрузка кэшей
   ============================================================ */

/**
 * Загружает участников и presence для всех гильдий.
 * Вызывается один раз при onReady, чтобы панель сразу
 * показывала правильное число online.
 */
export async function preloadPresences() {
  if (!_clientRef || !_clientRef.isReady()) return;

  for (const guild of _clientRef.guilds.cache.values()) {
    try {
      await guild.members.fetch({ withPresences: true });
      const online = guild.presences.cache.filter(p => p.status !== 'offline').size;
      console.log(`   ✅ ${guild.name}: ${guild.memberCount} уч., ${online} онлайн`);
    } catch (e) {
      console.warn(`   ⚠️ ${guild.name}: не удалось загрузить — ${e.message}`);
    }
  }
}

/* ============================================================
   Диагностика интентов
   ============================================================ */

/**
 * Печатает в консоль, какие intents реально включены.
 * Если MessageContent выключен — будут проблемы с legacy `!` командами,
 * предупреждаем пользователя заранее.
 */
export function verifyIntents() {
  if (!_clientRef) return;

  const names = INTENTS.map(i =>
    Object.keys(GatewayIntentBits).find(k => GatewayIntentBits[k] === i)
  );
  console.log(`[client] Intents: ${names.join(', ')}`);

  const mc = _clientRef.options.intents.has(GatewayIntentBits.MessageContent);
  const gm = _clientRef.options.intents.has(GatewayIntentBits.GuildMessages);
  const gm2 = _clientRef.options.intents.has(GatewayIntentBits.GuildMembers);

  console.log(`[client] MessageContent: ${mc ? '✅' : '❌ DISABLED'}`);
  console.log(`[client] GuildMessages:  ${gm ? '✅' : '❌ DISABLED'}`);
  console.log(`[client] GuildMembers:   ${gm2 ? '✅' : '❌ DISABLED'}`);

  if (!mc || !gm || !gm2) {
    console.warn('');
    console.warn('   ⚠️  ВКЛЮЧИТЕ в Discord Developer Portal → Bot → Privileged Gateway Intents:');
    console.warn('       MESSAGE CONTENT INTENT  ✅  (для legacy ! команд)');
    console.warn('       SERVER MEMBERS INTENT   ✅  (проверка ролей)');
    console.warn('       PRESENCE INTENT         ✅  (счётчик online)');
    console.warn('');
  }
}