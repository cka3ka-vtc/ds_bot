// server/api/dto/index.js
/* Единые DTO-мапперы: snake_case из БД → camelCase на фронт */

export function botToDto(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    isMain: !!row.is_main,
  };
}

export function guildToDto(row) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    memberCount: row.member_count ?? 0,
    online: row.online_count ?? null,
    createdAt: row.discord_created_at ?? null,
  };
}

export function commandToDto(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.type,
    response: row.response || '',
    enabled: !!row.enabled,
  };
}

export function modActionToDto(row) {
  return {
    id: row.id,
    kind: row.kind,
    userId: row.user_id,
    moderatorId: row.moderator_id || null,
    reason: row.reason || '',
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
  };
}

export function memberToDto(row, extra = {}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatar: row.avatar,
    joinedAt: row.joinedAt,
    roles: row.roles || [],
    level: extra.level || 0,
    xp: extra.xp || 0,
    warnings: extra.warnings || 0,
  };
}

export function moduleToDto(row, state = {}) {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    category: row.category,
    version: row.version,
    enabled: state.enabled ?? row.defaultEnabled ?? false,
    configSchema: row.configSchema,
  };
}

export function guildSettingsToDto(row) {
  return {
    language: row.language || 'ru',
    welcomeChannel: row.welcome_channel || '',
    logChannel: row.log_channel || '',
    excludedRoles: Array.isArray(row.excluded_roles) ? row.excluded_roles : [],
  };
}

export function roleToDto(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    position: row.position,
    memberCount: row.memberCount,
  };
}