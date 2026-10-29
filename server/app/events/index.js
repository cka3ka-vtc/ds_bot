// server/app/events/index.js
import { eventBus } from '../../core/eventBus.js';
import { onMessage } from './message.js';
import { onMemberJoin, onMemberLeave } from './member.js';
import { onVoice } from './voice.js';
import { onInteraction } from './interaction.js';
import { onGuildCreate, onGuildDelete } from './guild.js';

const FORWARDED_EVENTS = [
  'guildMemberAdd',
  'guildMemberRemove',
  'messageCreate',
  'interactionCreate',
  'voiceStateUpdate',
];

export function registerAllEvents({ db, botManager, registry, logger }) {
  // 1. Forward to registry (modules.onEvent) — с catch на каждый dispatch
  for (const event of FORWARDED_EVENTS) {
    eventBus.on(event, (payload) => {
      registry.dispatch({ ...payload, event }).catch((err) => {
        logger.error({ err, event }, 'registry.dispatch failed');
      });
    });
  }

  // 2. Business events — safe wrapper, чтобы rejections не терялись
  const safe = (name, fn, payload) => {
    Promise.resolve(fn({ db, botManager, registry, logger, payload })).catch((err) => {
      logger.error({ err, handler: name }, 'event handler failed');
    });
  };

  eventBus.on('messageCreate',     (p) => safe('message',      onMessage,      p));
  eventBus.on('guildMemberAdd',    (p) => safe('member_join',  onMemberJoin,   p));
  eventBus.on('guildMemberRemove', (p) => safe('member_leave', onMemberLeave,  p));
  eventBus.on('voiceStateUpdate',  (p) => safe('voice',        onVoice,        p));
  eventBus.on('interactionCreate', (p) => safe('interaction',  onInteraction,  p));
  eventBus.on('guildCreate',       (p) => safe('guild_create', onGuildCreate,  p));
  eventBus.on('guildDelete',       (p) => safe('guild_delete', onGuildDelete,  p));
}