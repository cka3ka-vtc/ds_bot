// public/assets/js/views/commands/cards.js
import { escapeHtml } from '../../core/utils.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { store } from '../../core/store.js';

function channelWord(n) {
  if (n === 1) return 'канал';
  if (n >= 2 && n <= 4) return 'канала';
  return 'каналов';
}
function roleWord(n) {
  if (n === 1) return 'роль';
  if (n >= 2 && n <= 4) return 'роли';
  return 'ролей';
}

export function renderCommandsList(view, wrap) {
  const state = view.state;
  const list = [];
  if (state.filter !== 'custom') {
    state.builtin
      .filter((c) => state.showDisabled || c.enabled)
      .forEach((c) => list.push({ ...c, _src: 'builtin' }));
  }
  if (state.filter !== 'builtin') {
    state.custom
      .filter((c) => state.showDisabled || c.enabled)
      .forEach((c) => list.push({ ...c, _src: 'custom' }));
  }

  const filtered = list.filter((c) => {
    if (!state.search) return true;
    const hay = (c.name + ' ' + (c.description || '')).toLowerCase();
    return hay.includes(state.search);
  });

  if (!filtered.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:48px 24px;">
        <i class="fa-solid fa-terminal"></i>
        <strong>${filtered.length ? 'Ничего не найдено' : 'Команд нет'}</strong>
        <span>Попробуйте изменить фильтр или создать новую команду</span>
      </div>`;
    return;
  }

  wrap.innerHTML = `<div class="commands-grid">
    ${filtered.map((c) => renderCard(c)).join('')}
  </div>`;

  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      location.hash = `commands?edit=${encodeURIComponent(btn.dataset.editId)}`;
    });
  });

  wrap.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCommand(view, btn.dataset.toggle, btn.dataset.toggleId, btn);
    });
  });

  wrap.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCommand(view, btn.dataset.delete);
    });
  });

  wrap.querySelectorAll('.command-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, input, [role="switch"]')) return;
      const id = card.dataset.editId;
      if (id) location.hash = `commands?edit=${encodeURIComponent(id)}`;
    });
    card.addEventListener('keydown', (e) => {
      if (e.target !== card) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const id = card.dataset.editId;
        if (id) location.hash = `commands?edit=${encodeURIComponent(id)}`;
      }
    });
  });
}

function renderCard(c) {
  const isBuiltin = c._src === 'builtin';
  const iconClass = isBuiltin ? (c.icon || 'fa-bolt') : 'fa-message';
  const colorClass = isBuiltin ? (c.color || 'blue') : 'purple';
  const editId = isBuiltin ? `builtin:${c.name}` : c.id;

  const badges = [];
  if (c.cooldownSeconds > 0) {
    badges.push(`<span class="cmd-badge"><i class="fa-solid fa-clock"></i> ${c.cooldownSeconds} сек</span>`);
  }
  if (c.channelsMode === 'whitelist' && c.channels?.length) {
    badges.push(`<span class="cmd-badge"><i class="fa-solid fa-hashtag"></i> ${c.channels.length} ${channelWord(c.channels.length)}</span>`);
  }
  if (c.channelsMode === 'blacklist' && c.channels?.length) {
    badges.push(`<span class="cmd-badge warn"><i class="fa-solid fa-ban"></i> кроме ${c.channels.length}</span>`);
  }
  if (c.requireRoles?.length) {
    badges.push(`<span class="cmd-badge"><i class="fa-solid fa-shield-halved"></i> ${c.requireRoles.length} ${roleWord(c.requireRoles.length)}</span>`);
  }
  if (c.excludeRoles?.length) {
    badges.push(`<span class="cmd-badge warn"><i class="fa-solid fa-user-slash"></i> ${c.excludeRoles.length} ${roleWord(c.excludeRoles.length)}</span>`);
  }
  if (c.ephemeral) {
    badges.push(`<span class="cmd-badge"><i class="fa-solid fa-eye-slash"></i> Только вызывающему</span>`);
  }

  return `
    <div class="command-card ${c.enabled ? '' : 'is-disabled'}"
         data-edit-id="${escapeHtml(editId)}"
         role="button"
         tabindex="0">
      <div class="command-card-head">
        <div class="command-icon ${colorClass}">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <div class="command-main">
          <div class="command-name">
            <span class="command-slash">/</span>${escapeHtml(c.name)}
            ${isBuiltin ? '<span class="badge-main" style="margin-left:8px;">BUILT-IN</span>' : ''}
          </div>
          <div class="command-desc">${escapeHtml(c.description || '—')}</div>
        </div>
        <button class="toggle ${c.enabled ? 'on' : ''}"
                type="button"
                data-toggle="${isBuiltin ? 'builtin' : 'custom'}"
                data-toggle-id="${escapeHtml(isBuiltin ? c.name : c.id)}"
                role="switch"
                aria-checked="${c.enabled}"
                aria-label="${c.enabled ? 'Выключить' : 'Включить'}"></button>
      </div>

      ${badges.length ? `<div class="command-badges">${badges.join('')}</div>` : ''}

      <div class="command-card-foot">
        <span class="command-type ${isBuiltin ? 'builtin' : 'custom'}">
          ${isBuiltin ? 'Встроенная' : 'Пользовательская'}
        </span>
        <div class="command-actions">
          ${!isBuiltin ? `
            <button class="btn btn-icon btn-ghost danger" type="button"
                    data-delete="${escapeHtml(c.id)}"
                    title="Удалить"
                    aria-label="Удалить">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" type="button"
                  data-edit="${isBuiltin ? 'builtin' : 'custom'}"
                  data-edit-id="${escapeHtml(editId)}">
            <i class="fa-solid fa-sliders"></i> Настроить
          </button>
        </div>
      </div>
    </div>
  `;
}

async function toggleCommand(view, kind, id, btn) {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  const enabled = btn.classList.toggle('on');
  btn.setAttribute('aria-checked', String(enabled));

  const card = btn.closest('.command-card');
  card?.classList.toggle('is-disabled', !enabled);

  try {
    if (kind === 'builtin') {
      await api.put(`/api/commands/builtin/${encodeURIComponent(id)}`, {
        botId, guildId, enabled,
      });
    } else {
      await api.post(`/api/commands/${id}/toggle`, {
        botId, guildId, enabled,
      });
    }
    const arr = kind === 'builtin' ? view.state.builtin : view.state.custom;
    const item = arr.find((x) => (kind === 'builtin' ? x.name : x.id) === id);
    if (item) item.enabled = enabled;
    toast(enabled ? 'Команда включена' : 'Команда выключена', 'success');
  } catch (err) {
    btn.classList.toggle('on');
    btn.setAttribute('aria-checked', String(!enabled));
    card?.classList.toggle('is-disabled', enabled);
    toast('Ошибка: ' + (err.data?.error || err.message), 'error');
  }
}

async function deleteCommand(view, id) {
  if (!confirm('Удалить эту команду? Действие необратимо.')) return;
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  try {
    await api.del(`/api/commands/${id}?botId=${botId}&guildId=${guildId}`);
    toast('Команда удалена', 'success');
    view.state.custom = view.state.custom.filter((c) => c.id !== id);
    view._renderCards();
  } catch (err) {
    toast('Ошибка: ' + (err.data?.error || err.message), 'error');
  }
}