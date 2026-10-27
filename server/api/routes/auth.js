// server/api/routes/auth.js
import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

export function authRouter() {
  const router = Router();

  // ═══════════════════════════════════════════════════════════════
  // 1. ВХОД ПОЛЬЗОВАТЕЛЯ
  // ═══════════════════════════════════════════════════════════════

  router.get('/discord', (req, res) => {
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      maxAge: 600_000,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
    });

    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: config.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds',
      state,
      prompt: 'consent',
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/discord/callback', async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || state !== req.cookies.oauth_state) {
        return res.redirect('/auth.html?error=invalid_state');
      }

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.DISCORD_REDIRECT_URI,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        return res.redirect('/auth.html?error=token_exchange');
      }

      const [user, guilds] = await Promise.all([
        fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }).then((r) => r.json()),
        fetch('https://discord.com/api/users/@me/guilds', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }).then((r) => r.json()),
      ]);

      const db = req.app.locals.db;
      const logger = req.app.locals.logger;

      db.upsertUser({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator || null,
        avatar: user.avatar || null,
      });

      // ── ИСПРАВЛЕНО: владелец сервера (owner: true) имеет все права
      //    даже если permissions = "0" (Discord не выставляет ADMIN бит)
      const adminGuilds = guilds
        .filter((g) => g.owner === true || (BigInt(g.permissions) & 0x8n) === 0x8n)
        .map((g) => ({ guildId: g.id, permissions: g.permissions || '0' }));

      db.setUserGuilds(user.id, adminGuilds);

      logger.info(
        {
          userId: user.id,
          username: user.username,
          totalGuilds: guilds.length,
          adminGuilds: adminGuilds.length,
          adminGuildIds: adminGuilds.map((g) => g.guildId),
        },
        'oauth: saved admin guilds',
      );

      const jwtToken = jwt.sign({ sub: user.id }, config.JWT_SECRET, {
        expiresIn: '7d',
      });
      res.cookie('auth', jwtToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.redirect('/panel.html');
    } catch (err) {
      req.app.locals.logger.error({ err }, 'oauth callback failed');
      res.redirect('/auth.html?error=unknown');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 2. ДОБАВЛЕНИЕ БОТА НА СЕРВЕР
  // ═══════════════════════════════════════════════════════════════

  router.get('/discord/bot-invite', (req, res) => {
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('bot_oauth_state', state, {
      httpOnly: true,
      maxAge: 600_000,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
    });

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/discord/bot-callback`;
    const permissions = '1099780054070';

    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'bot applications.commands',
      permissions,
      state,
      disable_guild_select: 'false',
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/discord/bot-callback', async (req, res) => {
    try {
      const { code, guild_id, state, error } = req.query;

      if (error) {
        req.app.locals.logger.info({ error, guild_id }, 'bot invite cancelled');
        return res.redirect('/panel.html?error=' + encodeURIComponent(error) + '#bots');
      }

      if (!code || state !== req.cookies.bot_oauth_state) {
        return res.redirect('/panel.html?error=invalid_state#bots');
      }

      const redirectUri = `${req.protocol}://${req.get('host')}/auth/discord/bot-callback`;

      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.DISCORD_CLIENT_ID,
          client_secret: config.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        req.app.locals.logger.warn({ tokenData }, 'bot oauth token exchange failed');
        return res.redirect('/panel.html?error=token_exchange#bots');
      }

      if (guild_id) {
        const db = req.app.locals.db;
        const mainBot = db.getMainBot();
        if (!mainBot) {
          return res.redirect('/panel.html?error=no_main_bot#bots');
        }

        const guildRes = await fetch(
          `https://discord.com/api/v10/guilds/${guild_id}`,
          { headers: { Authorization: `Bot ${config.DISCORD_MAIN_BOT_TOKEN}` } },
        );

        if (guildRes.ok) {
          const guild = await guildRes.json();
          db.upsertGuild({
            id: guild.id,
            bot_id: mainBot.id,
            name: guild.name,
            icon: guild.icon,
            owner_id: guild.owner_id,
            member_count: guild.approximate_member_count || 0,
          });
          req.app.locals.logger.info(
            { botId: mainBot.id, guildId: guild.id, name: guild.name },
            'guild added via bot-callback',
          );
        }
      }

      res.redirect('/panel.html?added=1#bots');
    } catch (err) {
      req.app.locals.logger.error({ err }, 'bot oauth callback failed');
      res.redirect('/panel.html?error=unknown#bots');
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // 3. СЕССИЯ
  // ═══════════════════════════════════════════════════════════════

  router.get('/me', (req, res) => {
    const token = req.cookies?.auth;
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    try {
      const payload = jwt.verify(token, config.JWT_SECRET);
      const user = req.app.locals.db.getUser(payload.sub);
      if (!user) return res.status(401).json({ error: 'unauthorized' });
      res.json({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
      });
    } catch {
      res.status(401).json({ error: 'unauthorized' });
    }
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('auth');
    res.json({ ok: true });
  });

  return router;
}