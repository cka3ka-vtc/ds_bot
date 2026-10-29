// server/api/routes/public.js
import { Router } from 'express';

export function publicRouter() {
  const router = Router();

  router.get('/stats', (req, res) => {
    const botManager = req.app.locals.botManager;

    let online = false;
    let servers = 0;
    let users = 0;
    const latencies = [];

    for (const bot of botManager.all()) {
      if (bot.client?.isReady()) {
        online = true;
        servers += bot.client.guilds.cache.size;
        for (const [, guild] of bot.client.guilds.cache) {
          users += guild.memberCount || 0;
        }
        if (typeof bot.client.ws.ping === 'number') {
          latencies.push(bot.client.ws.ping);
        }
      }
    }

    const latency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const uptimePct = 99.9;

    res.set('Cache-Control', 'public, max-age=30');
    res.json({ online, servers, users, latency, uptime: uptimePct });
  });

  return router;
}