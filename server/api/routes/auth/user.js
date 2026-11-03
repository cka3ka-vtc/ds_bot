// server/api/routes/auth/user.js
import { Router } from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { clearOauthCookies, isAdminGuild } from './_shared.js';

export function createUserOAuthRouter() {
  const router = Router();

  router.get('/discord', authLimiter, (req, res) => {
    const state = crypto.randomBytes(24).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      maxAge: 600_000,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
    });

    // ФИКС: убран prompt:'consent' — Discord показывает экран согласия
    // только при первом входе, а не при каждом F5.
    const params = new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      redirect_uri: config.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify guilds',
      state,
    });
    res.redirect(`https://discord.com/oauth2/authorize?${params}`);
  });

  router.get('/discord/callback', authLimiter, async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || state !== req.cookies.oauth_state) {
        clearOauthCookies(res);
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
        clearOauthCookies(res);
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

      if (!user || !user.id) {
        clearOauthCookies(res);
        return res.redirect('/auth.html?error=unknown');
      }
      if (!Array.isArray(guilds)) {
        clearOauthCookies(res);
        return res.redirect('/auth.html?error=unknown');
      }

      const db = req.app.locals.db;
      const logger = req.app.locals.logger;

      db.upsertUser({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator || null,
        avatar: user.avatar || null,
      });

      const adminGuilds = guilds
        .filter(isAdminGuild)
        .map((g) => ({ guildId: g.id, permissions: g.permissions || '0' }));

      db.setUserGuilds(user.id, adminGuilds);

      logger.info(
        {
          userId: user.id,
          username: user.username,
          totalGuilds: guilds.length,
          adminGuilds: adminGuilds.length,
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

      clearOauthCookies(res);
      res.redirect('/panel.html');
    } catch (err) {
      req.app.locals.logger.error({ err }, 'oauth callback failed');
      clearOauthCookies(res);
      res.redirect('/auth.html?error=unknown');
    }
  });

  return router;
}