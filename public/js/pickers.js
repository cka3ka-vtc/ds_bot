import { state } from './state.js';
import { escapeHtml, debounce } from './utils.js';

/* ============================================================
   CHANNEL PICKER
   ============================================================ */
const CHANNEL_ICONS = {
  text: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
  voice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  announcement: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M3 11l18-8v18l-18-8z"/></svg>`,
  stage: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
  forum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
};

export function channelIcon(type) {
  const name = { 0:'text', 2:'voice', 5:'announcement', 13:'stage', 15:'forum' }[type] || 'text';
  return CHANNEL_ICONS[name];
}

export function channelPickerHTML({ id, value = '', placeholder = 'Поиск канала...', iconId = '', hintId = '' }) {
  return `
    <div class="channel-picker" data-picker="${id}">
      <div class="channel-input-wrap">
        <span class="channel-input-icon" id="${iconId}"></span>
        <input class="input channel-search" data-input="${id}" placeholder="${escapeHtml(placeholder)}" autocomplete="off" value="">
      </div>
      <div class="channel-picker-dropdown" data-dropdown="${id}"></div>
      <input type="hidden" data-hidden="${id}" value="${escapeHtml(value)}">
      ${hintId ? `<span class="hint" id="${hintId}">Канал не выбран</span>` : ''}
    </div>
  `;
}

export function bindChannelPicker(container, { id, onSelect }) {
  const root = container.querySelector(`[data-picker="${id}"]`);
  if (!root) return;
  const searchInput = root.querySelector(`[data-input="${id}"]`);
  const dropdown = root.querySelector(`[data-dropdown="${id}"]`);
  const hidden = root.querySelector(`[data-hidden="${id}"]`);
  const iconEl = root.querySelector('.channel-input-icon');

  function setValue(ch) {
    if (ch) {
      searchInput.value = ch.name;
      hidden.value = ch.id;
      iconEl.innerHTML = channelIcon(ch.type);
    } else {
      searchInput.value = ''; hidden.value = ''; iconEl.innerHTML = '';
    }
    onSelect?.(ch);
  }

  if (hidden.value) {
    const ch = state.channels.find(c => c.id === hidden.value);
    if (ch) setValue(ch);
  }

  const renderOptions = (q = '') => {
    const query = q.trim().toLowerCase();
    const filtered = state.channels.filter(c => c.name.toLowerCase().includes(query) || c.id.includes(query));
    if (!filtered.length) { dropdown.innerHTML = '<div class="channel-empty">Не найдено</div>'; return; }
    dropdown.innerHTML = filtered.map(c => `
      <button class="channel-option" data-channel-id="${c.id}">
        <span class="channel-option-icon">${channelIcon(c.type)}</span>
        <span class="channel-option-name">${escapeHtml(c.name)}</span>
        <span class="channel-option-id">${c.id}</span>
      </button>
    `).join('');
  };

  searchInput.addEventListener('focus', () => { renderOptions(searchInput.value); positionPopup(dropdown, searchInput); });
  searchInput.addEventListener('input', () => { renderOptions(searchInput.value); if (!dropdown.classList.contains('show')) positionPopup(dropdown, searchInput); });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-channel-id]');
    if (!opt) return;
    const ch = state.channels.find(c => c.id === opt.dataset.channelId);
    if (ch) { setValue(ch); dropdown.classList.remove('show'); }
  });
  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!hidden.value) searchInput.value = '';
      else {
        const ch = state.channels.find(c => c.id === hidden.value);
        if (ch) setValue(ch);
      }
    }, 180);
  });
}

/* ============================================================
   ROLE PICKER
   ============================================================ */
export function rolePickerHTML({ id, value = '', placeholder = 'Поиск роли...', compact = false }) {
  return `
    <div class="role-picker" data-role-picker="${id}">
      <div class="role-input-wrap">
        <span class="role-input-icon"></span>
        <input class="input role-search" data-role-input="${id}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
      </div>
      <div class="role-dropdown" data-role-dropdown="${id}"></div>
      <input type="hidden" class="role-id-input" data-role-hidden="${id}" value="${escapeHtml(value)}">
    </div>
  `;
}

export function bindRolePicker(container, { id, onSelect }) {
  const root = container.querySelector(`[data-role-picker="${id}"]`);
  if (!root) return;
  const input = root.querySelector(`[data-role-input="${id}"]`);
  const dropdown = root.querySelector(`[data-role-dropdown="${id}"]`);
  const hidden = root.querySelector(`[data-role-hidden="${id}"]`);
  const iconEl = root.querySelector('.role-input-icon');

  function setValue(role) {
    input.value = role?.name || '';
    hidden.value = role?.id || '';
    iconEl.innerHTML = role ? `<span class="role-color-dot" style="background:${role.color};"></span>` : '';
    onSelect?.(role);
  }

  if (hidden.value) {
    const role = state.roles.find(r => r.id === hidden.value);
    if (role) setValue(role);
  }

  const renderOptions = (q = '') => {
    const query = q.trim().toLowerCase();
    const filtered = state.roles.filter(r => r.name.toLowerCase().includes(query) || r.id.includes(query));
    if (!filtered.length) { dropdown.innerHTML = '<div class="role-empty">Не найдено</div>'; return; }
    dropdown.innerHTML = filtered.map(r => `
      <button class="role-option" data-role-id="${r.id}">
        <span class="role-option-dot" style="background:${r.color};"></span>
        <span class="role-option-name">${escapeHtml(r.name)}</span>
        <span class="role-option-id">${r.id}</span>
      </button>
    `).join('');
  };

  input.addEventListener('focus', () => { renderOptions(input.value); positionPopup(dropdown, input); });
  input.addEventListener('input', () => { renderOptions(input.value); if (!dropdown.classList.contains('show')) positionPopup(dropdown, input); });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-role-id]');
    if (!opt) return;
    const role = state.roles.find(r => r.id === opt.dataset.roleId);
    if (role) { setValue(role); dropdown.classList.remove('show'); }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!hidden.value) input.value = '';
      else {
        const role = state.roles.find(r => r.id === hidden.value);
        if (role) setValue(role);
      }
    }, 180);
  });
}

/* ============================================================
   MEMBER PICKER
   ============================================================ */
const MEMBER_EMPTY_LIMIT = 100;   // при пустом запросе
const MEMBER_SEARCH_LIMIT = 200;  // максимум результатов при поиске

export function memberPickerHTML({ id, value = '', placeholder = 'Поиск пользователя...' }) {
  return `
    <div class="member-picker" data-member-picker="${id}">
      <div class="member-input-wrap">
        <span class="member-input-icon"></span>
        <input class="input member-search" data-member-input="${id}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
      </div>
      <div class="member-dropdown" data-member-dropdown="${id}"></div>
      <input type="hidden" data-member-hidden="${id}" value="${escapeHtml(value)}">
    </div>
  `;
}

export function bindMemberPicker(container, { id, onSelect }) {
  const root = container.querySelector(`[data-member-picker="${id}"]`);
  if (!root) return;
  const input = root.querySelector(`[data-member-input="${id}"]`);
  const dropdown = root.querySelector(`[data-member-dropdown="${id}"]`);
  const hidden = root.querySelector(`[data-member-hidden="${id}"]`);
  const iconEl = root.querySelector('.member-input-icon');

  function setValue(member) {
    input.value = member?.displayName || '';
    hidden.value = member?.id || '';
    iconEl.innerHTML = member?.avatar
      ? `<img src="${member.avatar}" alt="">`
      : (member ? `<span class="role-color-dot" style="background:#99aab5;"></span>` : '');
    onSelect?.(member);
  }

  if (hidden.value) {
    const m = state.members.find(x => x.id === hidden.value);
    if (m) setValue(m);
  }

  function renderOptions(q = '') {
    const query = q.trim().toLowerCase();
    const total = state.members.length;

    let filtered;
    let truncated = false;

    if (!query) {
      /* Пустой запрос — первые N участников */
      filtered = state.members.slice(0, MEMBER_EMPTY_LIMIT);
      truncated = total > MEMBER_EMPTY_LIMIT;
    } else {
      /* Поиск по всем (username + displayName + id) */
      filtered = [];
      for (const m of state.members) {
        const haystack = `${m.username} ${m.displayName}`.toLowerCase();
        if (haystack.includes(query) || m.id.includes(query)) {
          filtered.push(m);
          if (filtered.length >= MEMBER_SEARCH_LIMIT) { truncated = true; break; }
        }
      }
    }

    if (!filtered.length) {
      dropdown.innerHTML = '<div class="member-empty">Не найдено</div>';
      return;
    }

    let html = filtered.map(m => `
      <button class="member-option" data-member-id="${m.id}">
        <span class="member-option-avatar">${m.avatar ? `<img src="${m.avatar}" alt="">` : (m.username.charAt(0) || '?').toUpperCase()}</span>
        <span class="member-option-name">${escapeHtml(m.displayName)}</span>
        <span class="member-option-id">${m.id}</span>
      </button>
    `).join('');

    if (truncated) {
      const hint = query
        ? `Показано ${MEMBER_SEARCH_LIMIT} из многих. Уточните запрос.`
        : `Показано ${MEMBER_EMPTY_LIMIT} из ${total}. Введите имя для поиска.`;
      html += `<div class="member-hint">${hint}</div>`;
    }

    dropdown.innerHTML = html;
  }

  const debouncedRender = debounce((q) => renderOptions(q), 120);

  input.addEventListener('focus', () => {
    renderOptions(input.value);
    positionPopup(dropdown, input);
  });

  input.addEventListener('input', () => {
    debouncedRender(input.value);
    if (!dropdown.classList.contains('show')) positionPopup(dropdown, input);
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-member-id]');
    if (!opt) return;
    const m = state.members.find(x => x.id === opt.dataset.memberId);
    if (m) { setValue(m); dropdown.classList.remove('show'); }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (!hidden.value) input.value = '';
      else {
        const m = state.members.find(x => x.id === hidden.value);
        if (m) setValue(m);
      }
    }, 180);
  });
}

/* ============================================================
   EMOJI PICKER
   ============================================================ */
const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','🤗','😋','🤤','😛','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤫','🤭','🧐','🤓','😎','🤵','🥳','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖',
  '👋','🤚','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪','🦾',
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐓','🦃','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️','🦔',
  '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯',
  '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍','🏏','🪃','🥅','⛳','🪁','🏹','🎣','🤿','🥊','🥋','🎽','🛹','🛼','🛷','⛸️','🥌','🎿','⛷️','🏂','🪂','🏋️','🤼','🤸','🤺','⛹️','🤾','🏌️','🏇','🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖️','🏵️','🎗️','🎫','🎟️','🎪','🤹','🎭','🩰','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🪗','🎸','🎻','🎲','♟️','🎯','🎳','🎮','🎰','🧩',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅',
  '💌','💎','🔑','🗝️','🔨','🪓','⛏️','🛠️','🔧','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🧴','🛎️','🔔','📢','📣','📯','🔕','🎺','🎷','🎸','🎻','🎹','🥁','🪘','🎤','🎧','🎼','🎵','🎶','💿','📀','💾','💽','💻','🖥️','🖨️','⌨️','🖱️','🖲️','🕹️','🗜️','💾','📱','📲','☎️','📞','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🧴'
];

let activeEmoji = null;

export function emojiPickerHTML({ id, value = '' }) {
  const has = !!(value && value.trim());
  return `
    <div class="emoji-picker" data-emoji-picker="${id}">
      <div class="emoji-input-wrap">
        <input class="input emoji-value-input" data-emoji-input="${id}" value="${escapeHtml(value)}" placeholder="Emoji" readonly>
        <button type="button" class="emoji-clear-btn ${has ? '' : 'hidden'}" data-emoji-clear="${id}" aria-label="Очистить эмодзи">×</button>
      </div>
      <div class="emoji-dropdown" data-emoji-dropdown="${id}">
        <div class="emoji-grid-list" data-emoji-list="${id}"></div>
        <div class="emoji-manual-row">
          <input class="input emoji-manual-input" data-emoji-manual="${id}" placeholder="Вручную (😀 или <:name:id>)" maxlength="60">
          <button class="btn btn-primary btn-sm" data-emoji-apply="${id}">OK</button>
        </div>
      </div>
    </div>
  `;
}

export function bindEmojiPicker(container, { id, onChange }) {
  const root = container.querySelector(`[data-emoji-picker="${id}"]`);
  if (!root) return;
  const input = root.querySelector(`[data-emoji-input="${id}"]`);
  const clearBtn = root.querySelector(`[data-emoji-clear="${id}"]`);
  const dropdown = root.querySelector(`[data-emoji-dropdown="${id}"]`);
  const list = root.querySelector(`[data-emoji-list="${id}"]`);
  const manual = root.querySelector(`[data-emoji-manual="${id}"]`);
  const applyBtn = root.querySelector(`[data-emoji-apply="${id}"]`);

  const setValue = (v) => {
    input.value = v;
    clearBtn.classList.toggle('hidden', !v);
    onChange?.(v);
  };

  const open = () => {
    if (dropdown.classList.contains('show')) return;
    list.innerHTML = EMOJI_LIST.map(e => `<button type="button" class="emoji-grid-item" data-emoji="${e}">${e}</button>`).join('');
    positionPopup(dropdown, input, 380);
    activeEmoji = root;
  };

  const close = () => {
    dropdown.classList.remove('show');
    activeEmoji = null;
  };

  input.addEventListener('click', (e) => { e.stopPropagation(); open(); });
  clearBtn.addEventListener('click', (e) => { e.stopPropagation(); setValue(''); });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-emoji]');
    if (!btn) return;
    setValue(btn.dataset.emoji);
    close();
  });
  applyBtn.addEventListener('click', () => {
    const v = manual.value.trim();
    if (v) { setValue(v); close(); }
  });
  manual.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyBtn.click(); }
  });
}

/* ============================================================
   Утилиты
   ============================================================ */
export function positionPopup(popup, anchor, minWidth = 0) {
  popup.style.position = 'fixed';
  popup.style.visibility = 'hidden';
  popup.classList.add('show');
  const rect = anchor.getBoundingClientRect();
  const width = Math.max(rect.width, minWidth);
  popup.style.width = width + 'px';
  let left = rect.left;
  if (left + width > window.innerWidth - 10) left = window.innerWidth - width - 10;
  if (left < 10) left = 10;
  popup.style.left = left + 'px';
  popup.style.top = (rect.bottom + 4) + 'px';
  requestAnimationFrame(() => {
    const pr = popup.getBoundingClientRect();
    if (pr.bottom > window.innerHeight - 10) {
      const altTop = rect.top - pr.height - 4;
      popup.style.top = (altTop > 10 ? altTop : Math.max(10, window.innerHeight - pr.height - 10)) + 'px';
    }
    popup.style.visibility = 'visible';
  });
}

document.addEventListener('click', (e) => {
  if (activeEmoji && !e.target.closest('.emoji-picker')) {
    activeEmoji.querySelector('.emoji-dropdown')?.classList.remove('show');
    activeEmoji = null;
  }
  if (!e.target.closest('.channel-picker')) document.querySelectorAll('.channel-picker-dropdown.show').forEach(d => d.classList.remove('show'));
  if (!e.target.closest('.role-picker')) document.querySelectorAll('.role-dropdown.show').forEach(d => d.classList.remove('show'));
  if (!e.target.closest('.member-picker')) document.querySelectorAll('.member-dropdown.show').forEach(d => d.classList.remove('show'));
  if (!e.target.closest('.time-dropdown')) document.querySelectorAll('.time-dropdown').forEach(d => d.remove());
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.channel-picker-dropdown.show, .role-dropdown.show, .member-dropdown.show, .emoji-dropdown.show').forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.time-dropdown').forEach(d => d.remove());
  }
});