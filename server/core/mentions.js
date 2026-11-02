// server/core/mentions.js

/**
 * Формат mention пользователя.
 *
 * Возвращает `<@!id>` (nickname mention) вместо `<@id>`:
 *   - Desktop: рендерится идентично `<@id>` (как `@username`).
 *   - Mobile:  `<@!id>` стабильнее — Discord рендерит его через guild member
 *              data, а не через global user cache. Проблема `@unknown-user`
 *              в мобильном клиенте для `<@id>` этим снижается.
 *
 * Используйте везде, где раньше было `<@${id}>` в тексте уведомлений.
 */
export function mentionUser(id) {
  if (!id) return '';
  return `<@!${id}>`;
}

/**
 * Формат mention роли.
 * Discord стабильно рендерит `<@&id>` и на desktop, и на mobile,
 * поэтому отдельного nickname-формата для ролей нет.
 */
export function mentionRole(id) {
  if (!id) return '';
  return `<@&${id}>`;
}

/**
 * Собирает allowedMentions из готовых Components V2 / Embed.
 *
 * Discord V2 по умолчанию не резолвит mentions. Нужно явно перечислить
 * пользователей/роли, которые могут быть упомянуты.
 *
 * Возвращает `{ parse: [], users: [...], roles: [...] }` — mentions
 * рендерятся как кликабельные `@user`, но **не пингуют**.
 *
 * Если нужен пинг — передайте `{ ping: true }`; тогда `parse` будет
 * `['users', 'roles']`.
 *
 * @param {object[]} components — массив Component-объектов (V2) или Embed JSON.
 * @param {{ ping?: boolean }} [opts]
 */
export function buildAllowedMentions(components, { ping = false } = {}) {
  const text = JSON.stringify(components || []);
  const users = new Set();
  const roles = new Set();

  for (const m of text.matchAll(/<@!?(\d+)>/g)) users.add(m[1]);
  for (const m of text.matchAll(/<@&(\d+)>/g)) roles.add(m[1]);

  return {
    parse: ping ? ['users', 'roles'] : [],
    users: [...users],
    roles: [...roles],
  };
}