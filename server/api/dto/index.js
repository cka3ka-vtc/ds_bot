// server/api/dto/index.js

export function botToDto(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    isMain: !!row.is_main,
  };
}

function computeModStatus(row, now = Math.floor(Date.now() / 1000)) {
  if (row.kind === 'warn' || row.kind === 'kick') return 'executed';
  if (row.removed_at) return 'removed';
  if (row.expires_at && row.expires_at <= now) return 'expired';
  return 'active';
}

export function modActionToDto(row) {
  return {
    id: row.id,
    kind: row.kind,
    status: computeModStatus(row),
    auto: row.moderator_id == null,
    userId: row.user_id,
    username: row.user_username || null,
    displayName: row.user_display_name || null,
    avatarUrl: row.user_avatar_url || null,
    moderatorId: row.moderator_id || null,
    moderatorName: row.moderator_username || null,
    moderatorDisplayName: row.moderator_display_name || null,
    moderatorAvatarUrl: row.moderator_avatar_url || null,
    reason: row.reason || '',
    filterKey: row.filter_key || null,
    violation: row.violation != null ? Number(row.violation) : null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at,
    removedAt: row.removed_at || null,
    removedBy: row.removed_by || null,
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

export function stickyToDto(row) {
  return {
    id: row.id,
    name: row.name,
    channelId: row.channelId,
    messageConfig: row.messageConfig || {},
    lastMessageId: row.lastMessageId || null,
    enabled: !!row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function autodeleteToDto(row) {
  return {
    id: row.id,
    name: row.name,
    channelId: row.channelId,
    mode: row.mode,
    delayValue: row.delayValue,
    delayUnit: row.delayUnit,
    lastDeletedAt: row.lastDeletedAt || null,
    enabled: !!row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function scheduledToDto(row) {
  return {
    id: row.id,
    name: row.name,
    channelId: row.channelId,
    messageConfig: row.messageConfig || {},
    scheduledAt: row.scheduledAt,
    status: row.status,
    lastSentAt: row.lastSentAt || null,
    lastError: row.lastError || null,
    enabled: !!row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function messageTemplateToDto(row) {
  return {
    id: row.id,
    name: row.name,
    defaultChannelId: row.defaultChannelId || null,
    messageConfig: row.messageConfig || {},
    lastSentAt: row.lastSentAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}