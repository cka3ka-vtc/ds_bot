// tests/setup.js
//
// Задаёт env до загрузки config.js. Все значения проходят Zod-схему
// из server/config.js.

process.env.NODE_ENV = 'development';
process.env.PORT = '3001';
process.env.HOST = '127.0.0.1';
process.env.TRUST_PROXY = 'false';

process.env.JWT_SECRET = 'test_jwt_secret_32_bytes_minimum!';
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex-символа

process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DISCORD_CLIENT_SECRET = 'test_client_secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3001/auth/discord/callback';
process.env.DISCORD_MAIN_BOT_TOKEN = 'test_main_bot_token';

process.env.DATABASE_PATH = ':memory:';
process.env.LOG_LEVEL = 'warn';