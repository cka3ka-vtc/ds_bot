// server/db/repositories/message-templates.js

function safeParseJson(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function rowToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    defaultChannelId: row.default_channel_id || null,
    messageConfig: safeParseJson(row.message_config) || {},
    lastSentAt: row.last_sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createMessageTemplatesRepo(raw) {
  return {
    listMessageTemplates() {
      return raw.prepare('SELECT * FROM message_templates ORDER BY created_at DESC')
        .all().map(rowToDto);
    },

    getMessageTemplate(id) {
      return rowToDto(raw.prepare('SELECT * FROM message_templates WHERE id = ?').get(id));
    },

    createMessageTemplate(data) {
      const id = 'mt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO message_templates (id, name, message_config, default_channel_id)
        VALUES (?, ?, ?, ?)
      `).run(
        id,
        data.name,
        JSON.stringify(data.messageConfig || {}),
        data.defaultChannelId || null,
      );
      return id;
    },

    updateMessageTemplate(id, data) {
      const sets = [];
      const vals = [];
      const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };

      if (data.name !== undefined)             push('name', data.name);
      if (data.messageConfig !== undefined)    push('message_config', JSON.stringify(data.messageConfig || {}));
      if (data.defaultChannelId !== undefined) push('default_channel_id', data.defaultChannelId || null);

      if (!sets.length) return;
      push('updated_at', Math.floor(Date.now() / 1000));
      raw.prepare(`UPDATE message_templates SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    },

    touchMessageTemplateLastSent(id) {
      raw.prepare('UPDATE message_templates SET last_sent_at = unixepoch() WHERE id = ?').run(id);
    },

    deleteMessageTemplate(id) {
      raw.prepare('DELETE FROM message_templates WHERE id = ?').run(id);
    },
  };
}