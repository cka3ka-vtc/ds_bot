// server/core/mentions.js
//
// Хелперы для упоминаний Discord.
//
// buildAllowedMentions(components, { ping }) — ключевая функция.
// Принцип:
//   - ВСЕГДА parse: [] — рендер упоминаний в тексте будет, но без пинга.
//   - ping: true  → в users/roles попадают ID, найденные в компонентах.
//                    Значит пинганётся ровно тот, кого админ указал через
//                    {user}/{mention}/{role} или прямым <@id>.
//   - ping: false → users/roles пустые. Упоминания рендерятся, никто не пингуется.
//
// ВАЖНО: Discord запрещает одновременно передавать parse: ['users'] и users: [ids]
// (ошибка 50035 MESSAGE_ALLOWED_MENTIONS_PARSE_EXCLUSIVE). Поэтому parse всегда [].
// Раньше был баг: ping: true выставлял parse: ['users','roles'] И users: [ids] —
// из-за чего все greetings падали с 50035.

/**
 * Упоминание пользователя. Discord рендерит `<@!id>` на desktop и mobile
 * (с fallback на nickname), поэтому формат безопаснее обычного `<@id>`.
 */
export function mentionUser(id) {
  if (!id) return '';
  return `<@!${id}>`;
}

/**
 * Упоминание роли. Рендерится и на desktop, и на mobile — при условии,
 * что бот видит роль.
 */
export function mentionRole(id) {
  if (!id) return '';
  return `<@&${id}>`;
}

/**
 * Собирает allowedMentions для Discord API из массива компонентов (V2)
 * или embed JSON.
 *
 * @param {object[]} components — массив компонентов/embed-JSON.
 * @param {{ ping?: boolean }} [opts]
 *   - ping: true  → users/roles содержат найденные ID → они пингуются.
 *   - ping: false → users/roles пустые → упоминания рендерятся без пинга.
 *
 * @returns {{ parse: [], users: string[], roles: string[] }}
 */
export function buildAllowedMentions(components, { ping = false } = {}) {
  const text = JSON.stringify(components || []);
  const users = new Set();
  const roles = new Set();

  for (const m of text.matchAll(/<@!?(\d+)>/g)) users.add(m[1]);
  for (const m of text.matchAll(/<@&(\d+)>/g)) roles.add(m[1]);

  // parse всегда пустой — иначе Discord отклоняет запрос при непустых users/roles.
  return {
    parse: [],
    users: ping ? [...users] : [],
    roles: ping ? [...roles] : [],
  };
}