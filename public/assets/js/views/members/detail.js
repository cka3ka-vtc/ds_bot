// public/assets/js/views/members/detail.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, fmtDate, timeAgo } from '../../core/utils.js';

export async function openMemberDetail(view, userId) {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  if (!botId || !guildId) return;

  const m = view.state.members.find((x) => x.id === userId);
  if (!m) return;

  openModal({
    title: m.displayName || m.username || 'Участник',
    subtitle: `@${m.username || 'unknown'} · ID: ${userId}${m.left ? ' · покинул сервер' : ''}`,
    wide: true,
    body: '<div class="boot-screen" style="padding:32px;"><i class="fa-solid fa-circle-notch fa-spin"></i><span>Загрузка...</span></div>',
    ctaLabel: 'Сохранить',
    onOpen: async (modal) => {
      const body = modal.querySelector('.modal-body');
      try {
        const detail = await api.get(`/api/members/${userId}?botId=${botId}&guildId=${guildId}`);
        body.innerHTML = renderDetail(view, detail);
        bindDetail(modal);
      } catch (err) {
        body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><strong>Ошибка</strong><span>${escapeHtml(err.message)}</span></div>`;
      }
    },
    onSubmit: async (modal) => {
      const nicknameEl = modal.querySelector('#mNickname');
      const levelEl = modal.querySelector('#mLevel');
      const warningsEl = modal.querySelector('#mWarnings');
      if (!levelEl || !warningsEl) return true;

      const level = parseInt(levelEl.value, 10) || 0;
      const warnings = parseInt(warningsEl.value, 10) || 0;
      const nickname = nicknameEl ? nicknameEl.value.trim() : '';

      const roleIds = [...modal.querySelectorAll('[data-role-cb]:checked')].map((cb) => cb.value);

      try {
        const res = await api.put(`/api/members/${userId}`, {
          botId, guildId,
          level, warnings,
          nickname: m.left ? undefined : nickname,
          roles: m.left ? undefined : roleIds,
        });
        if (res.warning) {
          toast(res.message || 'Сохранено с предупреждением', 'warn');
        } else {
          toast('Сохранено', 'success');
        }
        await view.render(view.container);
      } catch (err) {
        const map = {
          no_permission: err.data?.details || 'У бота нет прав',
          nickname_failed: 'Не удалось изменить никнейм',
          roles_failed: 'Не удалось изменить роли',
        };
        toast(map[err.data?.error] || ('Ошибка: ' + (err.data?.details || err.message)), 'error');
        throw err;
      }
    },
  });
}

function renderDetail(view, d) {
  const stats = d.stats || { messages: 0, commands: 0, voice: 0, lastEventAt: null };
  const totalEvents = (stats.messages || 0) + (stats.commands || 0) + (stats.voice || 0);
  const percent = Math.max(0, Math.min(100, d.progress?.percent || 0));
  const progressCurrent = d.progress?.current || 0;
  const progressTotal = d.progress?.total || 0;
  const toNext = d.progress?.toNext || 0;

  const memberRoleIds = new Set((d.roles || []).map((r) => r.id));
  const editableRoles = view.state.roles.filter((r) => r.assignable !== false);
  const initial = (d.displayName || '?').trim()[0]?.toUpperCase() || '?';

  return `
    <div class="member-detail">
      <div class="member-detail-head">
        <div class="member-detail-avatar">
          ${d.avatarUrl
            ? `<img src="${escapeHtml(d.avatarUrl)}" alt="" referrerpolicy="no-referrer">`
            : `<span>${escapeHtml(initial)}</span>`}
        </div>
        <div class="member-detail-main">
          <div class="member-detail-name">${escapeHtml(d.displayName || 'Участник')}</div>
          <div class="member-detail-id">
            @${escapeHtml(d.username || 'unknown')}
            <span class="member-detail-sep">·</span>
            <code>${escapeHtml(d.userId)}</code>
          </div>
          <div class="member-detail-badges">
            ${d.left ? `<span class="member-left-chip"><i class="fa-solid fa-right-from-bracket"></i> Покинул${d.leftAt ? ' · ' + fmtDate(d.leftAt / 1000) : ''}</span>` : ''}
            ${d.title ? `<span class="member-title-badge">${escapeHtml(d.title)}</span>` : ''}
            ${d.rank ? `<span class="member-rank-badge">#${d.rank} в топе</span>` : ''}
          </div>
        </div>
      </div>

      <div class="member-detail-level-block">
        <div class="member-detail-level-num">
          <span class="member-detail-level-caption">Уровень</span>
          <span class="member-detail-level-value">${d.level}</span>
        </div>
        <div class="member-detail-level-progress">
          <div class="member-detail-progress-head">
            <span>${progressCurrent.toLocaleString('ru-RU')} / ${progressTotal.toLocaleString('ru-RU')} XP</span>
            <span>${percent}%</span>
          </div>
          <div class="member-detail-progress-bar">
            <div class="member-detail-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="member-detail-progress-note">
            ${toNext > 0 ? `До следующего уровня: <b>${toNext.toLocaleString('ru-RU')} XP</b>` : '<b>Максимальный уровень</b>'}
          </div>
        </div>
      </div>

      <div class="member-detail-activity">
        <div class="member-detail-stat">
          <i class="fa-solid fa-message"></i>
          <div>
            <strong>${(stats.messages || 0).toLocaleString('ru-RU')}</strong>
            <span>сообщений</span>
          </div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-volume-high"></i>
          <div>
            <strong>${(stats.voice || 0).toLocaleString('ru-RU')}</strong>
            <span>войсов</span>
          </div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-terminal"></i>
          <div>
            <strong>${(stats.commands || 0).toLocaleString('ru-RU')}</strong>
            <span>команд</span>
          </div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-bolt"></i>
          <div>
            <strong>${totalEvents.toLocaleString('ru-RU')}</strong>
            <span>всего событий</span>
          </div>
        </div>
      </div>

      ${stats.lastEventAt ? `
        <div class="member-detail-row">
          <span class="member-detail-label">Последняя активность</span>
          <span class="member-detail-value">${timeAgo(stats.lastEventAt)}</span>
        </div>
      ` : ''}

      <div class="member-detail-row">
        <span class="member-detail-label">День рождения</span>
        <span class="member-detail-value">
          ${d.birthday
            ? `${escapeHtml(d.birthday)} <span class="hint">${d.birthdayPublic ? '· публичное' : '· скрытое'}</span>`
            : '<span class="hint">Не указан (команда /birthday)</span>'}
        </span>
      </div>

      <hr class="member-detail-divider">

      <div class="member-detail-edit">
        <div class="member-detail-edit-title">
          <i class="fa-solid fa-sliders"></i> Редактирование
        </div>

        ${!d.left ? `
          <div class="form-field">
            <label>Никнейм на сервере</label>
            <input type="text" id="mNickname" maxlength="32"
                   placeholder="${escapeHtml(d.username || '')}"
                   value="${escapeHtml(d.serverNickname || '')}">
            <span class="hint">Пусто — сброс к стандартному имени пользователя. Требуется право «Управление никнеймами».</span>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>Уровень</label>
              <input type="number" id="mLevel" min="0" max="500" value="${d.level}">
            </div>
            <div class="form-field">
              <label>Предупреждения</label>
              <input type="number" id="mWarnings" min="0" value="${d.warnings}">
            </div>
          </div>

          <div class="form-field">
            <label>Роли (${editableRoles.length} доступно)</label>
            <div class="member-roles-edit">
              ${editableRoles.map((r) => {
                const checked = memberRoleIds.has(r.id);
                const color = r.color && r.color !== '#000000' ? r.color : 'var(--border-strong)';
                return `
                  <label class="member-role-toggle ${checked ? 'is-on' : ''}">
                    <input type="checkbox" data-role-cb value="${escapeHtml(r.id)}" ${checked ? 'checked' : ''}>
                    <span class="member-role-dot" style="background:${escapeHtml(color)};"></span>
                    <span class="member-role-name">${escapeHtml(r.name)}</span>
                  </label>
                `;
              }).join('') || '<span class="hint">Нет доступных ролей (бот не имеет прав или все роли выше его).</span>'}
            </div>
            <span class="hint">Отмеченные роли будут у участника. Роли выше бота не показываются — их он выдать не может.</span>
          </div>
        ` : `
          <div class="gr-perm-status warn" style="margin:0;">
            <i class="fa-solid fa-right-from-bracket"></i>
            <div>
              <strong>Пользователь покинул сервер</strong>
              <span>Можно менять только уровень и предупреждения. Никнейм и роли недоступны — участника нет на сервере.</span>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Уровень</label>
              <input type="number" id="mLevel" min="0" max="500" value="${d.level}">
            </div>
            <div class="form-field">
              <label>Предупреждения</label>
              <input type="number" id="mWarnings" min="0" value="${d.warnings}">
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function bindDetail(modal) {
  modal.querySelectorAll('[data-role-cb]').forEach((cb) => {
    cb.addEventListener('change', () => {
      cb.closest('.member-role-toggle').classList.toggle('is-on', cb.checked);
    });
  });
}