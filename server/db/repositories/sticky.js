// server/db/repositories/sticky.js

function rowToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    channelId: row.channel_id,
    messageConfig: safeParseJson(row.message_config) || {},
    lastMessageId: row.last_message_id || null,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParseJson(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

export function createStickyRepo(raw) {
  return {
    listSticky() {
      return raw.prepare('SELECT * FROM sticky_messages ORDER BY created_at DESC')
        .all().map(rowToDto);
    },

    getSticky(id) {
      return rowToDto(raw.prepare('SELECT * FROM sticky_messages WHERE id = ?').get(id));
    },

    listStickyByChannel(channelId) {
      return raw.prepare(
        'SELECT * FROM sticky_messages WHERE channel_id = ? AND enabled = 1'
      ).all(channelId).map(rowToDto);
    },

    createSticky(data) {
      const id = 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO sticky_messages
          (id, name, channel_id, message_config, enabled)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.channelId,
        JSON.stringify(data.messageConfig || {}),
        data.enabled === false ? 0 : 1,
      );
      return id;
    },

    updateSticky(id, data) {
      const sets = [];
      const vals = [];
      const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };

      if (data.name !== undefined)          push('name', data.name);
      if (data.channelId !== undefined)     push('channel_id', data.channelId);
      if (data.messageConfig !== undefined) push('message_config', JSON.stringify(data.messageConfig || {}));
      if (data.enabled !== undefined)       push('enabled', data.enabled ? 1 : 0);

      if (!sets.length) return;
      push('updated_at', Math.floor(Date.now() / 1000));
      raw.prepare(`UPDATE sticky_messages SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    },

    setStickyLastMessage(id, messageId) {
      raw.prepare(`
        UPDATE sticky_messages
        SET last_message_id = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(messageId, id);
    },

    deleteSticky(id) {
      raw.prepare('DELETE FROM sticky_messages WHERE id = ?').run(id);
    },

    countEnabledStickyForChannel(channelId, excludeId) {
      const row = excludeId
        ? raw.prepare(`
            SELECT COUNT(*) AS c FROM sticky_messages
            WHERE channel_id = ? AND enabled = 1 AND id != ?
          `).get(channelId, excludeId)
        : raw.prepare(`
            SELECT COUNT(*) AS c FROM sticky_messages
            WHERE channel_id = ? AND enabled = 1
          `).get(channelId);
      return row?.c || 0;
    },
  };
}