// server/api/routes/auth/bot.js
import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../../../config.js';
import { authLimiter } from '../../middleware/rate-limit.js';
import { clearOauthCookies } from './_shared.js';

/**
 * OAuth для добавления бота на сервер:
 *   GET /auth/discord/bot-invite   — редирект на Discord OAuth (scope: bot applications.commands)
 *   GET /auth/discord/bot-callback — обмен code → token, если guild_id известен —
 *                                     upsertGuild через REST Discord, редирект в /panel.html#bots
 */
export function createBotInviteRouter() {
  const router = Router();

  router.get('/discord/bot-invite', authLimiter, (req, res) => {
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

  router.get('/discord/bot-callback', authLimiter, async (req, res) => {
    try {
      const { code, guild_id, state, error } = req.query;

      if (error) {
        req.app.locals.logger.info({ error, guild_id }, 'bot invite cancelled');
        clearOauthCookies(res);
        return res.redirect('/panel.html?error=' + encodeURIComponent(error) + '#bots');
      }

      if (!code || state !== req.cookies.bot_oauth_state) {
        clearOauthCookies(res);
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
        req.app.locals.logger.warn(
          { status: tokenRes.status, error: tokenData.error || null },
          'bot oauth token exchange failed',
        );
        clearOauthCookies(res);
        return res.redirect('/panel.html?error=token_exchange#bots');
      }

      if (guild_id) {
        const db = req.app.locals.db;
        const mainBot = db.getMainBot();
        if (!mainBot) {
          clearOauthCookies(res);
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

      clearOauthCookies(res);
      res.redirect('/panel.html?added=1#bots');
    } catch (err) {
      req.app.locals.logger.error({ err }, 'bot oauth callback failed');
      clearOauthCookies(res);
      res.redirect('/panel.html?error=unknown#bots');
    }
  });

  return router;
}