// server/core/role-buttons-persist.js
//
// Извлекает блоки role-buttons из MessageConfig и пишет в БД
// (таблица role_button_configs). Вызывается при сохранении конфига модуля.

import {
  defaultRoleSuccessAddResponse,
  defaultRoleSuccessRemoveResponse,
  defaultRoleErrorResponse,
} from '../../shared/role-button-responses.js';

export function extractRoleButtonsFromMessageConfig(cfg) {
  const out = [];
  if (!cfg || typeof cfg !== 'object') return out;
  for (const block of cfg.blocks || []) {
    if (block.type !== 'role-buttons') continue;
    for (const btn of block.buttons || []) {
      if (!btn?.id || !btn?.roleId) continue;
      out.push({
        buttonId: btn.id,
        roleId: btn.roleId,
        label: btn.label || 'Роль',
        style: btn.style || 'primary',
        emoji: btn.emoji || '',
        successAddResponse: btn.successAddResponse || defaultRoleSuccessAddResponse(),
        successRemoveResponse: btn.successRemoveResponse || defaultRoleSuccessRemoveResponse(),
        errorResponse: btn.errorResponse || defaultRoleErrorResponse(),
      });
    }
  }
  return out;
}

export function persistRoleButtonsFromConfig(db, botId, guildId, source, cfg) {
  const buttons = extractRoleButtonsFromMessageConfig(cfg);
  db.replaceRoleButtonConfigsForSource(botId, guildId, source, buttons);
}

export function persistMessagesRoleButtons(db, botId, guildId, sourcePrefix, messages) {
  if (!messages || typeof messages !== 'object') return;
  for (const key of Object.keys(messages)) {
    const msgCfg = messages[key];
    if (!msgCfg || typeof msgCfg !== 'object') continue;
    persistRoleButtonsFromConfig(db, botId, guildId, `${sourcePrefix}.${key}`, msgCfg);
  }
}

export function deleteRoleButtonsForSource(db, botId, guildId, source) {
  db.deleteRoleButtonConfigsForSource(botId, guildId, source);
}