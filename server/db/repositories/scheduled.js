// server/db/repositories/scheduled.js

function safeParseJson(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function rowToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    channelId: row.channel_id,
    messageConfig: safeParseJson(row.message_config) || {},
    scheduledAt: row.scheduled_at,
    status: row.status,
    lastSentAt: row.last_sent_at || null,
    lastError: row.last_error || null,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createScheduledRepo(raw) {
  return {
    listScheduled() {
      return raw.prepare('SELECT * FROM scheduled_messages ORDER BY scheduled_at ASC')
        .all().map(rowToDto);
    },

    getScheduled(id) {
      return rowToDto(raw.prepare('SELECT * FROM scheduled_messages WHERE id = ?').get(id));
    },

    createScheduled(data) {
      const id = 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO scheduled_messages
          (id, name, channel_id, message_config, scheduled_at, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.channelId,
        JSON.stringify(data.messageConfig || {}),
        data.scheduledAt,
        data.enabled === false ? 0 : 1,
      );
      return id;
    },

    updateScheduled(id, data) {
      const sets = [];
      const vals = [];
      const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };

      if (data.name !== undefined)           push('name', data.name);
      if (data.channelId !== undefined)      push('channel_id', data.channelId);
      if (data.messageConfig !== undefined)  push('message_config', JSON.stringify(data.messageConfig || {}));
      if (data.scheduledAt !== undefined) {
        push('scheduled_at', data.scheduledAt);
        // При изменении даты — сбрасываем статус в pending, чтобы cron снова попробовал
        push('status', 'pending');
        push('last_error', null);
      }
      if (data.enabled !== undefined)        push('enabled', data.enabled ? 1 : 0);

      if (!sets.length) return;
      push('updated_at', Math.floor(Date.now() / 1000));
      raw.prepare(`UPDATE scheduled_messages SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    },

    setScheduledEnabled(id, enabled) {
      raw.prepare(`
        UPDATE scheduled_messages SET enabled = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(enabled ? 1 : 0, id);
    },

    markScheduledSent(id, ts) {
      raw.prepare(`
        UPDATE scheduled_messages
        SET status = 'sent', last_sent_at = ?, last_error = NULL, updated_at = unixepoch()
        WHERE id = ?
      `).run(ts, id);
    },

    markScheduledError(id, error) {
      raw.prepare(`
        UPDATE scheduled_messages
        SET status = 'error', last_error = ?, updated_at = unixepoch()
        WHERE id = ?
      `).run(String(error || 'unknown').slice(0, 500), id);
    },

    /** Возвращает «due» записи: enabled, pending, scheduled_at <= now. */
    getDueScheduled(nowSec) {
      return raw.prepare(`
        SELECT * FROM scheduled_messages
        WHERE enabled = 1
          AND status = 'pending'
          AND scheduled_at <= ?
        ORDER BY scheduled_at ASC
        LIMIT 50
      `).all(nowSec).map(rowToDto);
    },

    deleteScheduled(id) {
      raw.prepare('DELETE FROM scheduled_messages WHERE id = ?').run(id);
    },
  };
}