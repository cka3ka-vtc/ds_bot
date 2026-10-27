// server/db/repositories/commands.js
export function createCommandsRepo(db) {
  return {
    getCustomCommands(botId, guildId) {
      return db.prepare(
        'SELECT * FROM custom_commands WHERE bot_id = ? AND guild_id = ? ORDER BY name',
      ).all(botId, guildId);
    },
    createCustomCommand(c) {
      const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      db.prepare(`
        INSERT INTO custom_commands (id, bot_id, guild_id, name, description, type, response, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, c.botId, c.guildId, c.name,
        c.description || '', c.type || 'custom', c.response || '',
        c.enabled ? 1 : 0,
      );
      return id;
    },
    updateCustomCommand(id, data) {
      db.prepare(`
        UPDATE custom_commands
        SET name        = COALESCE(?, name),
            description = COALESCE(?, description),
            response    = COALESCE(?, response),
            enabled     = COALESCE(?, enabled)
        WHERE id = ?
      `).run(
        data.name ?? null,
        data.description ?? null,
        data.response ?? null,
        data.enabled !== undefined ? (data.enabled ? 1 : 0) : null,
        id,
      );
    },
    deleteCustomCommand(id) {
      db.prepare('DELETE FROM custom_commands WHERE id = ?').run(id);
    },
    getCustomCommand(id) {
      return db.prepare('SELECT * FROM custom_commands WHERE id = ?').get(id);
    },
  };
}