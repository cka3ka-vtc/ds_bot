// public/assets/js/views/module-settings/pickers/emoji.js
import { escapeHtml } from '../../../core/utils.js';
import { openPickerPopup } from './popup.js';

const EMOJI_LIST = [
  '😀','😁','😂','🤣','😊','😍','🥰','😎','🤔','😅',
  '👍','👎','👏','🙌','💪','🙏','✌️','👋','🤝','❤️',
  '🔥','⭐','✨','🎉','🎂','🎁','🎮','🏆','🥇','💎',
  '✅','❌','⚠️','⚡','💯','🐕','🐗','🐒','📌','📢',
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