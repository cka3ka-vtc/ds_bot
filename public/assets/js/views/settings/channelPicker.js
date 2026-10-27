// public/assets/js/views/settings/channelPicker.js
import { openModal } from '../../core/modal.js';
import { escapeHtml } from '../../core/utils.js';

export function openChannelPicker(view) {
  const channels = view.channels || [];
  if (!channels.length) {
    openModal({
      title: 'Каналы недоступны',
      subtitle: 'Бот офлайн или у него нет доступа к каналам',
      body: `<div class="empty-state" style="padding:24px;">
        <i class="fa-solid fa-plug-circle-xmark" style="color:var(--orange);"></i>
        <strong>Не удалось загрузить каналы</strong>
        <span>Проверьте, что бот запущен и имеет доступ к каналам</span>
      </div>`,
      ctaLabel: 'Понятно',
    });
    return;
  }

  const currentId = view.settings?.logChannel || '';

  openModal({
    title: 'Выбрать канал логов',
    subtitle: 'Поиск по названию или ID',
    body: `
      <div class="search-input" style="margin-bottom:12px;">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" id="channelSearch" placeholder="Поиск канала..." autofocus>
      </div>
      <div class="role-picker" id="channelList"></div>
    `,
    ctaLabel: 'Отмена',
    onOpen: (modal) => {
      const list = modal.querySelector('#channelList');
      const search = modal.querySelector('#channelSearch');

      const render = (query = '') => {
        const q = query.trim().toLowerCase();
        const filtered = channels.filter((c) =>
          !q || c.name.toLowerCase().includes(q) || c.id.includes(q),
        );

        if (!filtered.length) {
          list.innerHTML = `<div class="empty-state" style="padding:24px;">
            <i class="fa-solid fa-hashtag"></i>
            <strong>Ничего не найдено</strong>
          </div>`;
          return;
        }

        list.innerHTML = filtered.map((c) => {
          const isCurrent = c.id === currentId;
          return `<button type="button" class="role-picker-item" data-channel-id="${c.id}" data-channel-name="${escapeHtml(c.name)}">
            <i class="fa-solid fa-hashtag" style="color:var(--muted);font-size:11px;"></i>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(c.name)}
            </span>
            ${c.parentName ? `<span style="font-size:11px;color:var(--muted);">${escapeHtml(c.parentName)}</span>` : ''}
            ${isCurrent ? '<span class="badge online">Выбран</span>' : ''}
          </button>`;
        }).join('');

        list.querySelectorAll('[data-channel-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            view.setLogChannel(btn.dataset.channelId, btn.dataset.channelName);
            modal.remove();
          });
        });
      };

      search.addEventListener('input', () => render(search.value));
      render();
      setTimeout(() => search.focus(), 50);
    },
  });
}