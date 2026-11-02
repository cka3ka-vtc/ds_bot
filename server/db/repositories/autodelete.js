// server/db/repositories/autodelete.js

function rowToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    channelId: row.channel_id,
    mode: row.mode,
    delayValue: row.delay_value,
    delayUnit: row.delay_unit,
    lastDeletedAt: row.last_deleted_at || null,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createAutodeleteRepo(raw) {
  return {
    listAutodeleteRules() {
      return raw.prepare('SELECT * FROM autodelete_rules ORDER BY created_at DESC')
        .all().map(rowToDto);
    },

    getAutodeleteRule(id) {
      return rowToDto(raw.prepare('SELECT * FROM autodelete_rules WHERE id = ?').get(id));
    },

    listAutodeleteRulesByChannel(channelId) {
      return raw.prepare(
        'SELECT * FROM autodelete_rules WHERE channel_id = ? AND enabled = 1'
      ).all(channelId).map(rowToDto);
    },

    createAutodeleteRule(data) {
      const id = 'ad_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO autodelete_rules
          (id, name, channel_id, mode, delay_value, delay_unit, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.channelId,
        data.mode,
        data.delayValue ?? null,
        data.delayUnit ?? null,
        data.enabled === false ? 0 : 1,
      );
      return id;
    },

    updateAutodeleteRule(id, data) {
      const sets = [];
      const vals = [];
      const push = (col, val) => { sets.push(`${col} = ?`); vals.push(val); };

      if (data.name !== undefined)       push('name', data.name);
      if (data.channelId !== undefined)  push('channel_id', data.channelId);
      if (data.mode !== undefined)       push('mode', data.mode);
      if (data.delayValue !== undefined) push('delay_value', data.delayValue ?? null);
      if (data.delayUnit !== undefined)  push('delay_unit', data.delayUnit ?? null);
      if (data.enabled !== undefined)    push('enabled', data.enabled ? 1 : 0);

      if (!sets.length) return;
      push('updated_at', Math.floor(Date.now() / 1000));
      raw.prepare(`UPDATE autodelete_rules SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id);
    },

    touchAutodeleteLastDeleted(id) {
      raw.prepare('UPDATE autodelete_rules SET last_deleted_at = unixepoch() WHERE id = ?').run(id);
    },

    deleteAutodeleteRule(id) {
      raw.prepare('DELETE FROM autodelete_rules WHERE id = ?').run(id);
    },

    countEnabledRulesForChannel(channelId, excludeId) {
      const row = excludeId
        ? raw.prepare(`
            SELECT COUNT(*) AS c FROM autodelete_rules
            WHERE channel_id = ? AND enabled = 1 AND id != ?
          `).get(channelId, excludeId)
        : raw.prepare(`
            SELECT COUNT(*) AS c FROM autodelete_rules
            WHERE channel_id = ? AND enabled = 1
          `).get(channelId);
      return row?.c || 0;
    },

    scheduleAutodelete(messageId, channelId, deleteAt) {
      raw.prepare(`
        INSERT INTO autodelete_pending (message_id, channel_id, delete_at)
        VALUES (?, ?, ?)
        ON CONFLICT(message_id) DO UPDATE SET delete_at = excluded.delete_at
      `).run(messageId, channelId, deleteAt);
    },

    popDueAutodeletions(nowSec) {
      const rows = raw.prepare(`
        DELETE FROM autodelete_pending
        WHERE delete_at <= ?
        RETURNING message_id, channel_id
      `).all(nowSec);
      return rows.map((r) => ({ messageId: r.message_id, channelId: r.channel_id }));
    },

    clearAutodeletePendingForChannel(channelId) {
      raw.prepare('DELETE FROM autodelete_pending WHERE channel_id = ?').run(channelId);
    },
  };
}