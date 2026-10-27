// public/assets/js/views/moderation/punishModal.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';

export function openPunishModal(view) {
  openModal({
    title: 'Выдать наказание',
    subtitle: 'Предупреждение, мут или бан',
    body: `
      <div class="form-row">
        <div class="form-field">
          <label>ID пользователя</label>
          <input type="text" id="pUserId" placeholder="123456789">
        </div>
        <div class="form-field">
          <label>Тип</label>
          <div class="select-wrap">
            <select id="pKind">
              <option value="warn">Предупреждение</option>
              <option value="mute">Мут</option>
              <option value="ban">Бан</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>Причина</label>
          <input type="text" id="pReason" placeholder="Спам">
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>Длительность (минут, пусто = навсегда)</label>
          <input type="text" id="pDuration" placeholder="60">
        </div>
      </div>
    `,
    ctaLabel: 'Выдать',
    onSubmit: async (modal) => {
      const userId = modal.querySelector('#pUserId').value.trim();
      const kind = modal.querySelector('#pKind').value;
      const reason = modal.querySelector('#pReason').value.trim();
      const dur = modal.querySelector('#pDuration').value.trim();
      if (!userId) { toast('Введите ID', 'warn'); throw new Error(); }
      try {
        await api.post('/api/moderation/actions', {
          botId: store.get('activeBotId'),
          guildId: store.get('activeGuildId'),
          userId, kind, reason,
          durationMinutes: dur ? parseInt(dur, 10) : null,
        });
        toast('Наказание выдано', 'success');
        await view.render(view.container);
      } catch (err) {
        toast('Ошибка: ' + (err.data?.error || err.message), 'error');
        throw err;
      }
    },
  });
}