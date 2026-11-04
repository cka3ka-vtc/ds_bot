// server/db/repositories/role-buttons.js

function safeParse(raw) {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function rowToDto(row) {
  if (!row) return null;
  // Fallback: старые записи без success_add_response/remove_response
  // читают единый success_response в оба поля.
  return {
    buttonId: row.button_id,
    roleId: row.role_id,
    source: row.source,
    label: row.label || 'Роль',
    style: row.style || 'primary',
    emoji: row.emoji || '',
    successAddResponse: safeParse(row.success_add_response || row.success_response || '{}'),
    successRemoveResponse: safeParse(row.success_remove_response || row.success_response || '{}'),
    errorResponse: safeParse(row.error_response || '{}'),
    updatedAt: row.updated_at,
  };
}

export function createRoleButtonsRepo(raw) {
  return {
    getRoleButtonConfig(buttonId) {
      return rowToDto(raw.prepare(
        'SELECT * FROM role_button_configs WHERE button_id = ?'
      ).get(buttonId));
    },

    replaceRoleButtonConfigsForSource(botId, guildId, source, buttons) {
      const tx = raw.transaction(() => {
        raw.prepare(
          'DELETE FROM role_button_configs WHERE bot_id = ? AND guild_id = ? AND source = ?'
        ).run(botId, guildId, source);

        const ins = raw.prepare(`
          INSERT INTO role_button_configs
            (bot_id, guild_id, button_id, source, role_id, label, style, emoji,
             success_add_response, success_remove_response, error_response)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const b of buttons) {
          ins.run(
            botId, guildId, b.buttonId, source, b.roleId,
            b.label || 'Роль', b.style || 'primary', b.emoji || '',
            JSON.stringify(b.successAddResponse || {}),
            JSON.stringify(b.successRemoveResponse || {}),
            JSON.stringify(b.errorResponse || {}),
          );
        }
      });
      tx();
    },

    deleteRoleButtonConfigsForSource(botId, guildId, source) {
      raw.prepare(
        'DELETE FROM role_button_configs WHERE bot_id = ? AND guild_id = ? AND source = ?'
      ).run(botId, guildId, source);
    },
  };
}