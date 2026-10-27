// server/db/index.js
import { initConnection } from './connection.js';
import { createUsersRepo } from './repositories/users.js';
import { createBotsRepo } from './repositories/bots.js';
import { createGuildsRepo } from './repositories/guilds.js';
import { createModulesRepo } from './repositories/modules.js';
import { createCommandsRepo } from './repositories/commands.js';
import { createMembersRepo } from './repositories/members.js';
import { createModerationRepo } from './repositories/moderation.js';
import { createEventsRepo } from './repositories/events.js';

export function initDb(dbPath, logger) {
  const db = initConnection(dbPath, logger);

  return {
    raw: db,
    ...createUsersRepo(db),
    ...createBotsRepo(db),
    ...createGuildsRepo(db),
    ...createModulesRepo(db),
    ...createCommandsRepo(db),
    ...createMembersRepo(db),
    ...createModerationRepo(db),
    ...createEventsRepo(db),
  };
}