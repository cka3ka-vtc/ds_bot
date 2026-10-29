// server/api/dto/index.js
// Единые DTO-мапперы: snake_case из БД → camelCase на фронт.
// Используются только там, где это нужно. Удалены неиспользуемые мапперы.

export function botToDto(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    isMain: !!row.is_main,
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

export function guildSettingsToDto(row) {
  return {
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