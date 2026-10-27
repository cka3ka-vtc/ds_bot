// public/assets/js/views/settings/rolePicker.js
import { openModal } from '../../core/modal.js';
import { escapeHtml, WORD } from '../../core/utils.js';

export function openRolePicker(view) {
  const currentIds = new Set(
    [...view.container.querySelectorAll('.exclusion-chip')].map((c) => c.dataset.roleId),
  );
  const available = view.roles.filter((r) => !currentIds.has(r.id));

  if (available.length === 0) {
    openModal({
      title: 'Все роли уже исключены',
      subtitle: `${view.roles.length} ${WORD.role(view.roles.length)} на сервере`,
      body: `<div class="empty-state" style="padding:24px;">
        <i class="fa-solid fa-check" style="color:var(--green);"></i>
        <strong>Нечего добавлять</strong>
      </div>`,
      ctaLabel: 'Понятно',
    });
    return;
  }

  openModal({
    title: 'Добавить роль в исключения',
    subtitle: `Выберите из ${available.length} ${WORD.role(available.length)}`,
    body: `
      <div class="role-picker">
        ${available.map((r) => `
          <button type="button" class="role-picker-item" data-role-id="${r.id}">
            <span class="role-color-dot" style="background:${r.color || '#5b6373'};"></span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(r.name)}
            </span>
            <span style="font-size:11px;color:var(--muted);">${r.memberCount} уч.</span>
          </button>`).join('')}
      </div>
    `,
    ctaLabel: 'Отмена',
    onOpen: (modal) => {
      modal.querySelectorAll('[data-role-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.roleId;
          const role = view.roles.find((r) => r.id === id);
          view.addChip(id, role);
          modal.remove();
        });
      });
    },
  });
}