/* ============================================================
   Пикеры: канал, роль, участник, эмодзи.

   Каждый пикер — это input с выпадающим списком и hidden-полем,
   в котором лежит выбранный ID. При выборе вызывается onSelect.

   Позиционирование выпадашки — через positionPopup() с учётом
   границ экрана.
   ============================================================ */

import { state } from './state.js';
import { escapeHtml, debounce } from './utils.js';
import { toast } from './ui.js';

/* ============================================================
   Иконки каналов (FA)
   ============================================================ */

const CHANNEL_ICONS = {
  text:         '<i class="fa-solid fa-hashtag"></i>',
  voice:        '<i class="fa-solid fa-volume-high"></i>',
  announcement: '<i class="fa-solid fa-bullhorn"></i>',
  stage:        '<i class="fa-solid fa-circle-dot"></i>',
  forum:        '<i class="fa-solid fa-comments"></i>'
};

/**
 * Возвращает HTML иконки канала по его типу.
 * @param {number} type
 * @returns {string}
 */
export function channelIcon(type) {
  const name = { 0: 'text', 2: 'voice', 5: 'announcement', 13: 'stage', 15: 'forum' }[type] || 'text';
  return CHANNEL_ICONS[name];
}

/* ============================================================
   Channel Picker
   ============================================================ */

/**
 * HTML канала-пикера.
 * @param {object} opts
 * @param {string} opts.id - уникальный id
 * @param {string} [opts.value] - предустановленный ID
 * @param {string} [opts.placeholder]
 * @param {string} [opts.iconId]
 * @param {string} [opts.hintId]
 * @returns {string}
 */
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

/**
 * Навешивает обработчики на channel-picker.
 * Показывает права бота на каждый канал: ✅/❌ для отправки,
 * 🔒 для «нет доступа».
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string} opts.id
 * @param {(channel: object|null) => void} [opts.onSelect]
 */
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
      searchInput.value = '';
      hidden.value = '';
      iconEl.innerHTML = '';
    }
    onSelect?.(ch);
  }

  /* Восстановление выбранного значения при перерисовке */
  if (hidden.value) {
    const ch = state.channels.find(c => c.id === hidden.value);
    if (ch) setValue(ch);
  }

  const renderOptions = (q = '') => {
    const query = q.trim().toLowerCase();
    const filtered = state.channels.filter(c =>
      c.name.toLowerCase().includes(query) || c.id.includes(query)
    );

    if (!filtered.length) {
      dropdown.innerHTML = '<div class="channel-empty">Не найдено</div>';
      return;
    }

    dropdown.innerHTML = filtered.map(c => {
      const p = c.botPerms || {};
      const canView = p.view !== false;
      const canSend = p.send === true;
      const canManage = p.manageMessages === true;

      const badges = [];
      if (!canView) {
        badges.push('<span class="perm-badge perm-bad"><i class="fa-solid fa-eye-slash"></i> нет доступа</span>');
      } else {
        badges.push(canSend
          ? '<span class="perm-badge perm-ok"><i class="fa-solid fa-check"></i> отправка</span>'
          : '<span class="perm-badge perm-bad"><i class="fa-solid fa-xmark"></i> отправка</span>');
        if (canManage) {
          badges.push('<span class="perm-badge perm-ok"><i class="fa-solid fa-broom"></i> очистка</span>');
        }
      }

      return `
        <button class="channel-option ${!canView ? 'is-disabled' : ''}" data-channel-id="${c.id}" data-can-view="${canView}">
          <span class="channel-option-icon">${canView ? channelIcon(c.type) : '<i class="fa-solid fa-lock"></i>'}</span>
          <span class="channel-option-name">
            <span class="channel-option-title">${escapeHtml(c.name)}</span>
            <span class="channel-option-badges">${badges.join('')}</span>
          </span>
          <span class="channel-option-id">${c.id}</span>
        </button>
      `;
    }).join('');
  };

  searchInput.addEventListener('focus', () => {
    renderOptions(searchInput.value);
    positionPopup(dropdown, searchInput);
  });

  searchInput.addEventListener('input', () => {
    renderOptions(searchInput.value);
    if (!dropdown.classList.contains('show')) positionPopup(dropdown, searchInput);
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-channel-id]');
    if (!opt) return;
    if (opt.dataset.canView === 'false') {
      toast('Бот не имеет доступа к этому каналу', { type: 'error' });
      return;
    }
    const ch = state.channels.find(c => c.id === opt.dataset.channelId);
    if (ch) {
      setValue(ch);
      dropdown.classList.remove('show');
    }
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
   Role Picker
   ============================================================ */

/**
 * HTML роли-пикера.
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} [opts.value]
 * @param {string} [opts.placeholder]
 * @returns {string}
 */
export function rolePickerHTML({ id, value = '', placeholder = 'Поиск роли...' }) {
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

/**
 * Навешивает обработчики на role-picker.
 * Роли, которые бот не может выдать (выше его роли), недоступны.
 *
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string} opts.id
 * @param {(role: object|null) => void} [opts.onSelect]
 */
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
    iconEl.innerHTML = role
      ? `<span class="role-color-dot" style="background:${role.color};"></span>`
      : '';
    onSelect?.(role);
  }

  if (hidden.value) {
    const role = state.roles.find(r => r.id === hidden.value);
    if (role) setValue(role);
  }

  const renderOptions = (q = '') => {
    const query = q.trim().toLowerCase();
    const filtered = state.roles.filter(r =>
      r.name.toLowerCase().includes(query) || r.id.includes(query)
    );

    if (!filtered.length) {
      dropdown.innerHTML = '<div class="role-empty">Не найдено</div>';
      return;
    }

    dropdown.innerHTML = filtered.map(r => {
      const manageable = r.manageable !== false;
      return `
        <button class="role-option" data-role-id="${r.id}" data-manageable="${manageable}" ${!manageable ? 'style="opacity:.55;"' : ''}>
          <span class="role-option-dot" style="background:${r.color};"></span>
          <span class="role-option-name">
            ${escapeHtml(r.name)}
            ${!manageable ? ' <span style="color:#f87171;font-size:11px;">(выше бота)</span>' : ''}
          </span>
          <span class="role-option-id">${r.id}</span>
        </button>
      `;
    }).join('');
  };

  input.addEventListener('focus', () => {
    renderOptions(input.value);
    positionPopup(dropdown, input);
  });

  input.addEventListener('input', () => {
    renderOptions(input.value);
    if (!dropdown.classList.contains('show')) positionPopup(dropdown, input);
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-role-id]');
    if (!opt) return;
    if (opt.dataset.manageable === 'false') {
      toast('Роль выше роли бота — бот не сможет её выдать', { type: 'error' });
      return;
    }
    const role = state.roles.find(r => r.id === opt.dataset.roleId);
    if (role) {
      setValue(role);
      dropdown.classList.remove('show');
    }
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
   Member Picker
   ============================================================ */

/* Лимит на список без поиска */
const MEMBER_EMPTY_LIMIT = 100;
/* Лимит при поиске */
const MEMBER_SEARCH_LIMIT = 200;

/**
 * HTML участника-пикера.
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} [opts.value]
 * @param {string} [opts.placeholder]
 * @returns {string}
 */
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

/**
 * Навешивает обработчики на member-picker.
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string} opts.id
 * @param {(member: object|null) => void} [opts.onSelect]
 */
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
      filtered = state.members.slice(0, MEMBER_EMPTY_LIMIT);
      truncated = total > MEMBER_EMPTY_LIMIT;
    } else {
      filtered = [];
      for (const m of state.members) {
        const haystack = `${m.username} ${m.displayName}`.toLowerCase();
        if (haystack.includes(query) || m.id.includes(query)) {
          filtered.push(m);
          if (filtered.length >= MEMBER_SEARCH_LIMIT) {
            truncated = true;
            break;
          }
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
    if (m) {
      setValue(m);
      dropdown.classList.remove('show');
    }
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
   Emoji Picker
   ============================================================ */

/* Популярные эмодзи для быстрого выбора */
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😎', '🤓',
  '🥳', '🤔', '🤫', '😐', '😴', '😷', '🤒', '🤢', '😵', '🤯',
  '😢', '😭', '😱', '😡', '🥺', '🤬', '😈', '💀', '👻', '🤖',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💯',
  '👍', '👎', '👌', '✌️', '🤝', '🙏', '💪', '👋', '👏', '🙌',
  '🎉', '🎊', '🎂', '🎁', '⭐', '🌟', '✨', '🔥', '💎', '🏆'
];

/* Какой пикер сейчас открыт (для закрытия по клику вне) */
let activeEmoji = null;

/**
 * HTML эмодзи-пикера.
 * @param {object} opts
 * @param {string} opts.id
 * @param {string} [opts.value]
 * @returns {string}
 */
export function emojiPickerHTML({ id, value = '' }) {
  const has = !!(value && value.trim());
  return `
    <div class="emoji-picker" data-emoji-picker="${id}">
      <div class="emoji-input-wrap">
        <input class="input emoji-value-input" data-emoji-input="${id}" value="${escapeHtml(value)}" placeholder="Emoji" readonly>
        <button type="button" class="emoji-clear-btn ${has ? '' : 'hidden'}" data-emoji-clear="${id}" aria-label="Очистить эмодзи">
          <i class="fa-solid fa-xmark"></i>
        </button>
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

/**
 * Навешивает обработчики на emoji-picker.
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {string} opts.id
 * @param {(value: string) => void} [opts.onChange]
 */
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

  input.addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue('');
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-emoji]');
    if (!btn) return;
    setValue(btn.dataset.emoji);
    close();
  });

  applyBtn.addEventListener('click', () => {
    const v = manual.value.trim();
    if (v) {
      setValue(v);
      close();
    }
  });

  manual.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyBtn.click();
    }
  });
}

/* ============================================================
   Позиционирование popup
   ============================================================ */

/**
 * Позиционирует выпадающий элемент относительно якоря,
 * не выходя за границы окна.
 *
 * @param {HTMLElement} popup
 * @param {HTMLElement} anchor
 * @param {number} [minWidth=0]
 */
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

/* ============================================================
   Глобальные закрытия
   ============================================================ */

document.addEventListener('click', (e) => {
  if (activeEmoji && !e.target.closest('.emoji-picker')) {
    activeEmoji.querySelector('.emoji-dropdown')?.classList.remove('show');
    activeEmoji = null;
  }
  if (!e.target.closest('.channel-picker')) {
    document.querySelectorAll('.channel-picker-dropdown.show').forEach(d => d.classList.remove('show'));
  }
  if (!e.target.closest('.role-picker')) {
    document.querySelectorAll('.role-dropdown.show').forEach(d => d.classList.remove('show'));
  }
  if (!e.target.closest('.member-picker')) {
    document.querySelectorAll('.member-dropdown.show').forEach(d => d.classList.remove('show'));
  }
  if (!e.target.closest('.time-dropdown')) {
    document.querySelectorAll('.time-dropdown').forEach(d => d.remove());
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.channel-picker-dropdown.show, .role-dropdown.show, .member-dropdown.show, .emoji-dropdown.show')
      .forEach(d => d.classList.remove('show'));
    document.querySelectorAll('.time-dropdown').forEach(d => d.remove());
  }
});