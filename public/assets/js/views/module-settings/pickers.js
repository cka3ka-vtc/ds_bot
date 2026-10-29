// public/assets/js/views/module-settings/pickers.js
import { escapeHtml } from '../../core/utils.js';

export function channelIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`;
}

const ROLE_SHIELD = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;

const CLEAR_ICON = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

export function positionPopup(popup, anchor, minWidth = 220) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  popup.style.position = 'fixed';
  popup.style.zIndex = '5000';
  popup.style.minWidth = Math.max(minWidth, rect.width) + 'px';
  const pw = popup.offsetWidth || minWidth;
  const ph = popup.offsetHeight || 320;
  let left = rect.left;
  let top = rect.bottom + 4;
  if (left + pw > vw - 8) left = Math.max(8, vw - pw - 8);
  if (top + ph > vh - 8) top = Math.max(8, rect.top - ph - 4);
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

function openPickerPopup(anchor, innerHtml, opts = {}) {
  document.querySelectorAll('.picker-popup').forEach((p) => p.remove());
  const popup = document.createElement('div');
  popup.className = 'picker-popup';
  popup.innerHTML = innerHtml;
  document.body.appendChild(popup);
  positionPopup(popup, anchor, opts.minWidth || 240);

  const cleanup = () => {
    popup.remove();
    document.removeEventListener('mousedown', closeOnOutside);
    window.removeEventListener('resize', cleanup);
    window.removeEventListener('scroll', closeOnScroll, true);
  };
  const closeOnOutside = (e) => {
    if (popup.contains(e.target) || anchor.contains(e.target)) return;
    cleanup();
  };
  const closeOnScroll = (e) => {
    if (e && e.target && popup.contains(e.target)) return;
    cleanup();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', closeOnOutside);
    window.addEventListener('resize', cleanup);
    window.addEventListener('scroll', closeOnScroll, true);
  }, 0);
  return popup;
}

/* ─── CHANNEL PICKER ─── */
export function channelPickerHTML({ id, hintId, value = '', placeholder = 'Выберите канал...' } = {}) {
  return `
    <div class="channel-picker" data-channel-picker="${escapeHtml(id)}" data-hint-id="${escapeHtml(hintId || '')}">
      <div class="channel-input-wrap">
        <span class="channel-input-icon" aria-hidden="true">${channelIcon()}</span>
        <input type="text" class="input channel-search" placeholder="${escapeHtml(placeholder)}" readonly value="">
        <button type="button" class="picker-clear-btn hidden" data-channel-clear aria-label="Очистить" tabindex="-1">
          ${CLEAR_ICON}
        </button>
      </div>
      ${hintId ? `<div class="hint" id="${escapeHtml(hintId)}">${value ? '' : 'Канал не выбран'}</div>` : ''}
    </div>
  `;
}

export function bindChannelPicker(container, { id, channels, onSelect, multiSelect = false, filterList = null }) {
  const root = container.querySelector(`[data-channel-picker="${id}"]`);
  if (!root) return;

  const wrap = root.querySelector('.channel-input-wrap');
  const input = root.querySelector('.channel-search');
  const clearBtn = root.querySelector('[data-channel-clear]');
  const hint = root.dataset.hintId ? document.getElementById(root.dataset.hintId) : null;

  const setValue = (ch) => {
    if (multiSelect) {
      input.value = '';
      clearBtn.classList.add('hidden');
      if (hint) hint.textContent = '';
    } else if (ch) {
      input.value = ch.name;
      clearBtn.classList.remove('hidden');
      if (hint) hint.textContent = `Выбран: ${ch.name} · ${ch.id}`;
    } else {
      input.value = '';
      clearBtn.classList.add('hidden');
      if (hint) hint.textContent = 'Канал не выбран';
    }
    onSelect?.(ch || null);
  };

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue(null);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-channel-clear]')) return;
    e.stopPropagation();
    if (root.dataset.open === '1') return;
    root.dataset.open = '1';

    const list = filterList ? filterList(channels) : channels;

    const listHTML = (items) => items.length
      ? items.map((c) => `
          <button type="button" class="channel-option" data-channel-id="${escapeHtml(c.id)}">
            <span class="channel-option-icon">${channelIcon()}</span>
            <span class="channel-option-name">${escapeHtml(c.name)}</span>
            ${c.parentName ? `<span class="channel-option-id">${escapeHtml(c.parentName)}</span>` : ''}
          </button>
        `).join('')
      : '<div class="channel-empty">Ничего не найдено</div>';

    const popup = openPickerPopup(wrap, `
      <div class="picker-search">
        <input type="text" class="input picker-search-input" placeholder="Поиск...">
      </div>
      <div class="picker-list">${listHTML(list)}</div>
    `, { minWidth: 320 });

    const search = popup.querySelector('.picker-search-input');
    const listEl = popup.querySelector('.picker-list');
    search.focus();

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      listEl.innerHTML = listHTML(list.filter((c) => !q || c.name.toLowerCase().includes(q)));
    });

    popup.addEventListener('click', (ev) => {
      const opt = ev.target.closest('[data-channel-id]');
      if (!opt) return;
      const ch = list.find((c) => c.id === opt.dataset.channelId);
      if (!ch) return;
      setValue(ch);
      root.dataset.open = '';
      popup.remove();
    });

    const observer = new MutationObserver(() => {
      if (!document.body.contains(popup)) { root.dataset.open = ''; observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  });

  return { setValue };
}

/* ─── ROLE PICKER ─── */
export function rolePickerHTML({ id, value = '', roles = [], placeholder = 'Выберите роль...' } = {}) {
  const selected = roles.find((r) => r.id === value);
  const label = selected ? selected.name : '';
  const iconHTML = selected
    ? `<span class="role-color-dot" style="background:${escapeHtml(selected.color || '#5b6373')};"></span>`
    : ROLE_SHIELD;
  return `
    <div class="role-picker" data-role-picker="${escapeHtml(id)}">
      <div class="role-input-wrap">
        <span class="role-input-icon" aria-hidden="true">${iconHTML}</span>
        <input type="text" class="input role-search" placeholder="${escapeHtml(placeholder)}" readonly value="${escapeHtml(label)}">
        <button type="button" class="picker-clear-btn ${label ? '' : 'hidden'}" data-role-clear aria-label="Очистить" tabindex="-1">
          ${CLEAR_ICON}
        </button>
      </div>
    </div>
  `;
}

export function bindRolePicker(container, { id, roles, onSelect, multiSelect = false, filterList = null }) {
  const root = container.querySelector(`[data-role-picker="${id}"]`);
  if (!root) return;
  const wrap = root.querySelector('.role-input-wrap');
  const input = root.querySelector('.role-search');
  const iconEl = root.querySelector('.role-input-icon');
  const clearBtn = root.querySelector('[data-role-clear]');

  const setValue = (role) => {
    if (multiSelect) {
      input.value = '';
      iconEl.innerHTML = ROLE_SHIELD;
      clearBtn.classList.add('hidden');
    } else if (role) {
      input.value = role.name;
      iconEl.innerHTML = `<span class="role-color-dot" style="background:${escapeHtml(role.color || '#5b6373')};"></span>`;
      clearBtn.classList.remove('hidden');
    } else {
      input.value = '';
      iconEl.innerHTML = ROLE_SHIELD;
      clearBtn.classList.add('hidden');
    }
    onSelect?.(role || null);
  };

  clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setValue(null);
  });

  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-role-clear]')) return;
    e.stopPropagation();
    if (root.dataset.open === '1') return;
    root.dataset.open = '1';

    const list = filterList ? filterList(roles) : roles;

    const listHTML = (items) => items.length
      ? items.map((r) => `
          <button type="button" class="role-option" data-role-id="${escapeHtml(r.id)}">
            <span class="role-option-dot" style="background:${escapeHtml(r.color || '#5b6373')};"></span>
            <span class="role-option-name">${escapeHtml(r.name)}</span>
            <span class="role-option-id">${r.memberCount || 0} уч.</span>
          </button>
        `).join('')
      : '<div class="role-empty">Ничего не найдено</div>';

    const popup = openPickerPopup(wrap, `
      <div class="picker-search">
        <input type="text" class="input picker-search-input" placeholder="Поиск...">
      </div>
      <div class="picker-list">${listHTML(list)}</div>
    `, { minWidth: 280 });

    const search = popup.querySelector('.picker-search-input');
    const listEl = popup.querySelector('.picker-list');
    search.focus();

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      listEl.innerHTML = listHTML(list.filter((r) => !q || r.name.toLowerCase().includes(q)));
    });

    popup.addEventListener('click', (ev) => {
      const opt = ev.target.closest('[data-role-id]');
      if (!opt) return;
      const role = list.find((r) => r.id === opt.dataset.roleId);
      if (!role) return;
      setValue(role);
      root.dataset.open = '';
      popup.remove();
    });

    const observer = new MutationObserver(() => {
      if (!document.body.contains(popup)) { root.dataset.open = ''; observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  });

  return { setValue };
}

/* ─── EMOJI ─── */
const EMOJI_LIST = [
  '😀','😁','😂','🤣','😊','😍','🥰','😎','🤔','😅',
  '👍','👎','👏','🙌','💪','🙏','✌️','👋','🤝','❤️',
  '🔥','⭐','✨','🎉','🎂','🎁','🎮','🏆','🥇','💎',
  '✅','❌','⚠️','⚡','💯','🆕','🆗','🆒','📌','📢',
];

export function emojiPickerHTML({ id, value = '' } = {}) {
  return `
    <div class="emoji-picker" data-emoji-picker="${escapeHtml(id)}">
      <div class="emoji-input-wrap">
        <input type="text" class="input emoji-value-input" placeholder="Emoji / <:name:id>" value="${escapeHtml(value)}" readonly>
        <button type="button" class="emoji-clear-btn ${value ? '' : 'hidden'}" title="Очистить">×</button>
      </div>
    </div>
  `;
}

export function bindEmojiPicker(container, { id, onChange }) {
  const root = container.querySelector(`[data-emoji-picker="${id}"]`);
  if (!root) return;
  const wrap = root.querySelector('.emoji-input-wrap');
  const input = root.querySelector('.emoji-value-input');
  const clearBtn = root.querySelector('.emoji-clear-btn');

  const setValue = (v) => {
    input.value = v || '';
    clearBtn.classList.toggle('hidden', !v);
    onChange?.(v || '');
  };

  clearBtn.addEventListener('click', (e) => { e.stopPropagation(); setValue(''); });

  wrap.addEventListener('click', (e) => {
    if (e.target === clearBtn) return;
    if (root.dataset.open === '1') return;
    root.dataset.open = '1';

    const grid = EMOJI_LIST.map((em) => `<button type="button" class="emoji-grid-item" data-emoji="${em}">${em}</button>`).join('');
    const popup = openPickerPopup(wrap, `
      <div class="emoji-grid-list">${grid}</div>
      <div class="emoji-manual-row">
        <input type="text" class="input emoji-manual-input" placeholder="Или <:name:id>">
        <button type="button" class="btn btn-primary btn-sm emoji-manual-apply">OK</button>
      </div>
    `, { minWidth: 340 });

    popup.addEventListener('click', (ev) => {
      const em = ev.target.closest('[data-emoji]');
      if (em) { setValue(em.dataset.emoji); root.dataset.open = ''; popup.remove(); return; }
      if (ev.target.closest('.emoji-manual-apply')) {
        const v = popup.querySelector('.emoji-manual-input').value.trim();
        if (v) setValue(v);
        root.dataset.open = '';
        popup.remove();
      }
    });

    const observer = new MutationObserver(() => {
      if (!document.body.contains(popup)) { root.dataset.open = ''; observer.disconnect(); }
    });
    observer.observe(document.body, { childList: true });
  });
}