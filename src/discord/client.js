import { Client, GatewayIntentBits } from 'discord.js';

let client = null;

export function initClient(token) {
  if (client) return client;
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent  // КРИТИЧНО: без него message.content всегда пустой
    ]
  });
  client._token = token;
  return client;
}

export function getClient() {
  if (!client) throw new Error('Client not initialized');
  return client;
}

/* ============================================================
   Предзагрузка участников и присутствий при старте бота.
   ============================================================ */
export async function preloadPresences() {
  if (!client || !client.isReady()) return;
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch({ withPresences: true });
      const online = guild.presences.cache.filter(p => p.status !== 'offline').size;
      console.log(`  ✓ ${guild.name}: ${guild.memberCount} участников, ${online} онлайн`);
    } catch (e) {
      console.warn(`  ✗ ${guild.name}: не удалось загрузить участников — ${e.message}`);
    }
  }
}

/* ============================================================
   Проверка критичных интентов при старте.
   ============================================================ */
export function verifyIntents() {
  if (!client) return;
  const hasMC = client.options.intents.has(GatewayIntentBits.MessageContent);
  console.log(`[client] MessageContent intent: ${hasMC ? '✓ enabled' : '✗ DISABLED'}`);
  if (!hasMC) {
    console.warn('');
    console.warn('  ⚠️  MESSAGE CONTENT INTENT НЕ ВКЛЮЧЁН.');
    console.warn('  Команды (!hb …) работать НЕ БУДУТ.');
    console.warn('  Включите его: Discord Developer Portal → Bot → Privileged Gateway Intents');
    console.warn('     → MESSAGE CONTENT INTENT  ✓  и сохраните настройки.');
    console.warn('');
  }
}