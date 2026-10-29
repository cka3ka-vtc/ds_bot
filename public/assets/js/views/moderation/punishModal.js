// public/assets/js/views/moderation/punishModal.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { UI } from '/shared/ui-strings.js';

export function openPunishModal(view) {
  const m = UI.moderation.punishModal;

  openModal({
    title: m.title,
    subtitle: m.subtitle,
    body: `
      <div class="form-row">
        <div class="form-field">
          <label>${m.userId}</label>
          <input type="text" id="pUserId" placeholder="${m.userIdPlaceholder}">
        </div>
        <div class="form-field">
          <label>${m.kind}</label>
          <div class="select-wrap">
            <select id="pKind">
              <option value="warn">${UI.moderation.kinds.warn}</option>
              <option value="mute">${UI.moderation.kinds.mute}</option>
              <option value="ban">${UI.moderation.kinds.ban}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>${m.reason}</label>
          <input type="text" id="pReason" placeholder="${m.reasonPlaceholder}">
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>${m.duration}</label>
          <input type="text" id="pDuration" placeholder="60">
        </div>
      </div>
    `,
    ctaLabel: m.submit,
    onSubmit: async (modal) => {
      const userId = modal.querySelector('#pUserId').value.trim();
      const kind = modal.querySelector('#pKind').value;
      const reason = modal.querySelector('#pReason').value.trim();
      const dur = modal.querySelector('#pDuration').value.trim();
      if (!userId) { toast(m.userIdRequired, 'warn'); throw new Error(); }
      try {
        await api.post('/api/moderation/actions', {
          botId: store.get('activeBotId'),
          guildId: store.get('activeGuildId'),
          userId, kind, reason,
          durationMinutes: dur ? parseInt(dur, 10) : null,
        });
        toast(m.done, 'success');
        await view.render(view.container);
      } catch (err) {
        toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
        throw err;
      }
    },
  });
}