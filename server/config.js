// server/config.js
import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  TRUST_PROXY: z.coerce.boolean().default(false),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_CLIENT_SECRET: z.string().min(1),
  DISCORD_REDIRECT_URI: z.string().url(),
  DISCORD_MAIN_BOT_TOKEN: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'ENCRYPTION_KEY must be 64 hex chars'),
  DATABASE_PATH: z.string().default('./data/botpanel.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RETENTION_EVENTS_DAYS: z.coerce.number().int().min(0).default(30),
  RETENTION_LOGS_DAYS: z.coerce.number().int().min(0).default(60),
  RETENTION_AUDIT_DAYS: z.coerce.number().int().min(0).default(90),
});

let parsed;
try {
  parsed = schema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error('\n❌ Ошибка конфигурации .env — не хватает или неверны переменные:\n');
    for (const issue of err.errors) {
      console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('\nПроверьте файл .env. Обязательные переменные:');
    console.error('  DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI,');
    console.error('  DISCORD_MAIN_BOT_TOKEN, JWT_SECRET (32+), ENCRYPTION_KEY (64 hex)\n');
    process.exit(1);
  }
  throw err;
}

export const config = parsed;