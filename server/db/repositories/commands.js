// server/db/repositories/commands.js
export function createCommandsRepo(raw) {
  return {
    getCustomCommands() {
      return raw.prepare('SELECT * FROM custom_commands ORDER BY name').all();
    },

    createCustomCommand(c) {
      const id = 'cmd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      raw.prepare(`
        INSERT INTO custom_commands (id, name, description, type, response, enabled)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id, c.name,
        c.description || '', c.type || 'custom',
        c.response || '', c.enabled ? 1 : 0,
      );
      return id;
    },

    updateCustomCommand(id, data) {
      raw.prepare(`
        UPDATE custom_commands SET
          name        = COALESCE(?, name),
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
      raw.prepare('DELETE FROM custom_commands WHERE id = ?').run(id);
    },

    getCustomCommand(id) {
      return raw.prepare('SELECT * FROM custom_commands WHERE id = ?').get(id);
    },
  };
}