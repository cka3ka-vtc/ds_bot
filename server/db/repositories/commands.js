// server/db/repositories/commands.js
function parseJsonArray(raw) {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw) {
  try {
    const v = JSON.parse(raw || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function rowToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    type: row.type || 'custom',
    response: row.response || '',
    enabled: !!row.enabled,
    channelsMode: row.channels_mode || 'all',
    channels: parseJsonArray(row.channels),
    cooldownSeconds: row.cooldown_seconds | 0,
    requireRoles: parseJsonArray(row.require_roles),
    excludeRoles: parseJsonArray(row.exclude_roles),
    ephemeral: !!row.ephemeral,
    responseMode: row.response_mode || 'text',
    responseEmbedColor: row.response_embed_color || '#5865F2',
    messageConfig: parseJsonObject(row.message_config),
    usageCount: row.usage_count | 0,
    lastUsedAt: row.last_used_at || null,
    createdAt: row.created_at,
  };
}

function builtinRowToDto(row) {
  if (!row) return null;
  return {
    enabled: !!row.enabled,
    description: row.description || '',
    cooldownSeconds: row.cooldown_seconds | 0,
    channelsMode: row.channels_mode || 'all',
    channels: parseJsonArray(row.channels),
    requireRoles: parseJsonArray(row.require_roles),
    excludeRoles: parseJsonArray(row.exclude_roles),
    ephemeral: !!row.ephemeral,
  };
}

const BUILTIN_DEFAULTS = {
  enabled: true,
  description: '',
  cooldownSeconds: 0,
  channelsMode: 'all',
  channels: [],
  requireRoles: [],
  excludeRoles: [],
  ephemeral: true,
};

export function createCommandsRepo(raw) {
  return {
    /* ═══════════════ custom commands ═══════════════ */

    getCustomCommands() {
      return raw.prepare('SELECT * FROM custom_commands ORDER BY name').all().map(rowToDto);
    },

    getCustomCommand(id) {
      return rowToDto(raw.prepare('SELECT * FROM custom_commands WHERE id = ?').get(id));
    },

    createCustomCommand(c) {
      const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO custom_commands
          (id, name, description, type, response, enabled,
           channels_mode, channels, cooldown_seconds, require_roles, exclude_roles,
           ephemeral, response_mode, response_embed_color, message_config)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        c.name,
        c.description || '',
        c.type || 'custom',
        c.response || '',
        c.enabled ? 1 : 0,
        c.channelsMode || 'all',
        JSON.stringify(c.channels || []),
        c.cooldownSeconds | 0,
        JSON.stringify(c.requireRoles || []),
        JSON.stringify(c.excludeRoles || []),
        c.ephemeral ? 1 : 0,
        c.responseMode || 'text',
        c.responseEmbedColor || '#5865F2',
        JSON.stringify(c.messageConfig || {}),
      );
      return id;
    },

    updateCustomCommand(id, data) {
      const sets = [];
      const vals = [];
      const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };

      if (data.name !== undefined)              push('name', data.name);
      if (data.description !== undefined)       push('description', data.description);
      if (data.response !== undefined)          push('response', data.response);
      if (data.enabled !== undefined)           push('enabled', data.enabled ? 1 : 0);
      if (data.channelsMode !== undefined)      push('channels_mode', data.channelsMode);
      if (data.channels !== undefined)          push('channels', JSON.stringify(data.channels));
      if (data.cooldownSeconds !== undefined)   push('cooldown_seconds', data.cooldownSeconds | 0);
      if (data.requireRoles !== undefined)      push('require_roles', JSON.stringify(data.requireRoles));
      if (data.excludeRoles !== undefined)      push('exclude_roles', JSON.stringify(data.excludeRoles));
      if (data.ephemeral !== undefined)         push('ephemeral', data.ephemeral ? 1 : 0);
      if (data.responseMode !== undefined)      push('response_mode', data.responseMode);
      if (data.responseEmbedColor !== undefined) push('response_embed_color', data.responseEmbedColor);
      if (data.messageConfig !== undefined)     push('message_config', JSON.stringify(data.messageConfig || {}));

      if (!sets.length) return;
      raw.prepare(`UPDATE custom_commands SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    },

    deleteCustomCommand(id) {
      raw.prepare('DELETE FROM custom_commands WHERE id = ?').run(id);
    },

    incrementCommandUsage(id) {
      raw.prepare(`
        UPDATE custom_commands
        SET usage_count = usage_count + 1, last_used_at = unixepoch()
        WHERE id = ?
      `).run(id);
    },

    /* ═══════════════ builtin command settings ═══════════════ */

    getBuiltinSettings(name) {
      const row = raw
        .prepare('SELECT * FROM builtin_command_settings WHERE command_name = ?')
        .get(name);
      return row ? builtinRowToDto(row) : { ...BUILTIN_DEFAULTS };
    },

    getAllBuiltinSettings() {
      const rows = raw.prepare('SELECT * FROM builtin_command_settings').all();
      const map = {};
      for (const row of rows) map[row.command_name] = builtinRowToDto(row);
      return map;
    },

    upsertBuiltinSettings(name, data) {
      raw.prepare(`
        INSERT INTO builtin_command_settings
          (command_name, enabled, description, cooldown_seconds,
           channels_mode, channels, require_roles, exclude_roles, ephemeral)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(command_name) DO UPDATE SET
          enabled = excluded.enabled,
          description = excluded.description,
          cooldown_seconds = excluded.cooldown_seconds,
          channels_mode = excluded.channels_mode,
          channels = excluded.channels,
          require_roles = excluded.require_roles,
          exclude_roles = excluded.exclude_roles,
          ephemeral = excluded.ephemeral,
          updated_at = unixepoch()
      `).run(
        name,
        data.enabled !== false ? 1 : 0,
        data.description || null,
        Math.max(0, data.cooldownSeconds | 0),
        data.channelsMode || 'all',
        JSON.stringify(data.channels || []),
        JSON.stringify(data.requireRoles || []),
        JSON.stringify(data.excludeRoles || []),
        data.ephemeral !== false ? 1 : 0,
      );
    },
  };
}