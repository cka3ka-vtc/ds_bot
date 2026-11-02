// public/assets/js/views/moderation/punishModal.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { UI } from '/shared/ui-strings.js';

const M = UI.moderation;

const KIND_OPTIONS = [
  { value: 'warn', label: M.kinds.warn, icon: 'fa-triangle-exclamation' },
  { value: 'mute', label: M.kinds.mute, icon: 'fa-microphone-slash' },
  { value: 'ban',  label: M.kinds.ban,  icon: 'fa-ban' },
];

const DURATION_PRESETS = [
  { value: 60,   label: '1 час' },
  { value: 360,  label: '6 часов' },
  { value: 1440, label: '1 день' },
  { value: 10080, label: '7 дней' },
  { value: 43200, label: '30 дней' },
  { value: null,  label: 'Бессрочно' },
];

export function openPunishModal() {
  return openModal({
    title: M.punishModal.title,
    subtitle: M.punishModal.subtitle,
    body: `
      <div class="form-field">
        <label>${M.punishModal.userId}</label>
        <input type="text" id="pUserId" inputmode="numeric" autocomplete="off"
               placeholder="${M.punishModal.userIdPlaceholder}">
      </div>

      <div class="form-field" style="margin-top:14px;">
        <label>${M.punishModal.kind}</label>
        <div class="segmented-control" data-kind-seg>
          ${KIND_OPTIONS.map((o, i) => `
            <button type="button" class="seg-btn ${i === 0 ? 'active' : ''}" data-kind="${o.value}">
              <i class="fa-solid ${o.icon}" style="margin-right:6px;"></i>${o.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="form-field" style="margin-top:14px;">
        <label>${M.punishModal.reason}</label>
        <input type="text" id="pReason" maxlength="500"
               placeholder="${M.punishModal.reasonPlaceholder}">
      </div>

      <div class="form-field" id="pDurationField" style="margin-top:14px;display:none;">
        <label>${M.punishModal.duration}</label>
        <div class="segmented-control" data-duration-seg>
          ${DURATION_PRESETS.map((o, i) => `
            <button type="button" class="seg-btn ${i === 2 ? 'active' : ''}"
                    data-duration="${o.value === null ? 'null' : o.value}">
              ${o.label}
            </button>
          `).join('')}
        </div>
        <span class="hint" id="pDurationHint"></span>
      </div>
    `,
    ctaLabel: M.punishModal.submit,
    onOpen: (modal) => bindModal(modal),
    onSubmit: async (modal) => submitModal(modal),
  });
}

/* ═════════════════ Bind ═════════════════ */

function bindModal(modal) {
  const state = {
    kind: 'warn',
    durationMinutes: 1440,
  };

  const kindSeg = modal.querySelector('[data-kind-seg]');
  const durationField = modal.querySelector('#pDurationField');
  const durationSeg = modal.querySelector('[data-duration-seg]');
  const durationHint = modal.querySelector('#pDurationHint');

  function syncKind() {
    kindSeg.querySelectorAll('.seg-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.kind === state.kind);
    });
    const showDuration = state.kind === 'mute' || state.kind === 'ban';
    durationField.style.display = showDuration ? '' : 'none';
    if (showDuration) {
      durationHint.textContent = M.punishModal.foreverHint;
    }
  }

  function syncDuration() {
    durationSeg.querySelectorAll('.seg-btn').forEach((b) => {
      const v = b.dataset.duration;
      const isActive = v === 'null'
        ? state.durationMinutes === null
        : parseInt(v, 10) === state.durationMinutes;
      b.classList.toggle('active', isActive);
    });
  }

  kindSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-kind]');
    if (!btn) return;
    state.kind = btn.dataset.kind;
    syncKind();
  });

  durationSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-duration]');
    if (!btn) return;
    state.durationMinutes = btn.dataset.duration === 'null' ? null : parseInt(btn.dataset.duration, 10);
    syncDuration();
  });

  modal._punishState = state;
  syncKind();
  syncDuration();

  setTimeout(() => modal.querySelector('#pUserId')?.focus(), 60);
}

/* ═════════════════ Submit ═════════════════ */

async function submitModal(modal) {
  const state = modal._punishState || { kind: 'warn', durationMinutes: 1440 };
  const userId = modal.querySelector('#pUserId').value.trim();
  const reason = modal.querySelector('#pReason').value.trim();

  if (!/^\d{5,32}$/.test(userId)) {
    toast(M.punishModal.userIdRequired, 'warn');
    modal.querySelector('#pUserId')?.focus();
    throw new Error('invalid_user_id');
  }

  const btn = modal.querySelector('[data-cta]');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ...';

  try {
    await api.post('/api/moderation/actions', {
      botId: store.get('activeBotId'),
      guildId: store.get('activeGuildId'),
      userId,
      kind: state.kind,
      reason,
      durationMinutes: (state.kind === 'mute' || state.kind === 'ban')
        ? state.durationMinutes
        : null,
    });
    toast(M.punishModal.done, 'success');
    return true;
  } catch (err) {
    const code = err.data?.error;
    const msg = code === 'member_not_found'
      ? 'Пользователь не найден на сервере'
      : code === 'discord_action_failed'
        ? (M.punishModal.discordFailed + (err.data?.details ? `: ${err.data.details}` : ''))
        : (err.data?.error || err.message);
    toast(msg, 'error');
    btn.disabled = false;
    btn.innerHTML = orig;
    throw err;
  }
}