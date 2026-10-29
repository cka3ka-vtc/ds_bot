// public/assets/js/views/members/detail.js
import { api } from '../../core/api.js';
import { store } from '../../core/store.js';
import { toast } from '../../core/toast.js';
import { openModal } from '../../core/modal.js';
import { escapeHtml, fmtDate, timeAgo } from '../../core/utils.js';
import { UI } from '/shared/ui-strings.js';

const D = UI.members.detail;

export async function openMemberDetail(view, userId) {
  const botId = store.get('activeBotId');
  const guildId = store.get('activeGuildId');
  if (!botId || !guildId) return;

  openModal({
    title: D.modalTitle,
    subtitle: `ID: ${userId}`,
    wide: true,
    body: `<div class="boot-screen" style="padding:32px;"><i class="fa-solid fa-circle-notch fa-spin"></i><span>${D.loading}</span></div>`,
    ctaLabel: UI.common.save,
    onOpen: async (modal) => {
      const body = modal.querySelector('.modal-body');
      try {
        const detail = await api.get(`/api/members/${userId}?botId=${botId}&guildId=${guildId}`);

        modal.querySelector('h3').textContent = detail.displayName || detail.username || D.userFallback;
        modal.querySelector('p').textContent = D.subtitle(detail.username, userId, detail.left);

        body.innerHTML = renderDetail(view, detail);
        bindDetail(modal);
      } catch (err) {
        body.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <strong>${D.errorTitle}</strong>
            <span>${escapeHtml(err.message)}</span>
          </div>`;
      }
    },
    onSubmit: async (modal) => {
      const nicknameEl = modal.querySelector('#mNickname');
      const levelEl = modal.querySelector('#mLevel');
      const warningsEl = modal.querySelector('#mWarnings');
      if (!levelEl || !warningsEl) return true;

      const initialLevel = parseInt(levelEl.dataset.initialLevel, 10);
      const currentLevel = parseInt(levelEl.value, 10) || 0;
      const initialWarnings = parseInt(warningsEl.dataset.initialWarnings, 10);
      const currentWarnings = parseInt(warningsEl.value, 10) || 0;

      const levelChanged = currentLevel !== initialLevel;
      const warningsChanged = currentWarnings !== initialWarnings;

      const nickname = nicknameEl ? nicknameEl.value.trim() : '';
      const roleCheckboxes = modal.querySelectorAll('[data-role-cb]');
      const roles = roleCheckboxes.length > 0
        ? [...modal.querySelectorAll('[data-role-cb]:checked')].map((cb) => cb.value)
        : undefined;

      const memberLeft = isMemberLeft(modal);
      const payload = { botId, guildId };

      if (levelChanged) {
        payload.level = currentLevel;
        payload.warnings = currentWarnings;
      } else if (warningsChanged) {
        payload.warnings = currentWarnings;
      }

      if (!memberLeft && nicknameEl) payload.nickname = nickname;
      if (!memberLeft && roles !== undefined) payload.roles = roles;

      const hasChanges =
        payload.level !== undefined ||
        payload.warnings !== undefined ||
        (!memberLeft && nicknameEl && nickname !== (nicknameEl.dataset.initialNickname || '')) ||
        (!memberLeft && roles !== undefined);

      if (!hasChanges) {
        toast(D.noChanges, 'info');
        return true;
      }

      try {
        const res = await api.put(`/api/members/${userId}`, payload);
        if (res.warning) toast(res.message || D.savedWarning, 'warn');
        else toast(D.saved, 'success');
        await view._reload(view.state.page);
      } catch (err) {
        const code = err.data?.error;
        const mapped = UI.errors[code] || err.data?.details || err.message;
        toast((code === 'no_permission' ? mapped : (UI.common.error + ': ' + mapped)), 'error');
        throw err;
      }
    },
  });
}

function isMemberLeft(modal) {
  return modal.querySelector('.member-detail')?.dataset.memberLeft === '1';
}

function renderDetail(view, d) {
  const stats = d.stats || { messages: 0, commands: 0, voice: 0, lastEventAt: null };
  const totalEvents = (stats.messages || 0) + (stats.commands || 0) + (stats.voice || 0);
  const percent = Math.max(0, Math.min(100, d.progress?.percent || 0));
  const progressCurrent = d.progress?.current || 0;
  const progressTotal = d.progress?.total || 0;
  const toNext = d.progress?.toNext || 0;

  const memberRoleIds = new Set((d.roles || []).map((r) => r.id));
  const editableRoles = (view.state.roles || []).filter((r) => r.assignable === true);
  const initial = (d.displayName || '?').trim()[0]?.toUpperCase() || '?';

  return `
    <div class="member-detail" data-member-left="${d.left ? '1' : '0'}">
      <div class="member-detail-head">
        <div class="member-detail-avatar">
          ${d.avatarUrl
            ? `<img src="${escapeHtml(d.avatarUrl)}" alt="" referrerpolicy="no-referrer">`
            : `<span>${escapeHtml(initial)}</span>`}
        </div>
        <div class="member-detail-main">
          <div class="member-detail-name">${escapeHtml(d.displayName || D.userFallback)}</div>
          <div class="member-detail-id">
            @${escapeHtml(d.username || 'unknown')}
            <span class="member-detail-sep">·</span>
            <code>${escapeHtml(d.userId)}</code>
          </div>
          <div class="member-detail-badges">
            ${d.left ? `<span class="member-left-chip"><i class="fa-solid fa-right-from-bracket"></i> ${UI.members.card.leftLabel}${d.leftAt ? ' · ' + fmtDate(d.leftAt / 1000) : ''}</span>` : ''}
            ${d.title ? `<span class="member-title-badge">${escapeHtml(d.title)}</span>` : ''}
            ${d.rank ? `<span class="member-rank-badge">#${d.rank} в топе</span>` : ''}
          </div>
        </div>
      </div>

      <div class="member-detail-level-block">
        <div class="member-detail-level-num">
          <span class="member-detail-level-caption">${D.levelCaption}</span>
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
            ${toNext > 0 ? `${D.untilNext}: <b>${toNext.toLocaleString('ru-RU')} XP</b>` : `<b>${D.maxLevel}</b>`}
          </div>
        </div>
      </div>

      <div class="member-detail-activity">
        <div class="member-detail-stat">
          <i class="fa-solid fa-message"></i>
          <div><strong>${(stats.messages || 0).toLocaleString('ru-RU')}</strong><span>${D.statMessages}</span></div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-volume-high"></i>
          <div><strong>${(stats.voice || 0).toLocaleString('ru-RU')}</strong><span>${D.statVoice}</span></div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-terminal"></i>
          <div><strong>${(stats.commands || 0).toLocaleString('ru-RU')}</strong><span>${D.statCommands}</span></div>
        </div>
        <div class="member-detail-stat">
          <i class="fa-solid fa-bolt"></i>
          <div><strong>${totalEvents.toLocaleString('ru-RU')}</strong><span>${D.statTotal}</span></div>
        </div>
      </div>

      ${stats.lastEventAt ? `
        <div class="member-detail-row">
          <span class="member-detail-label">${D.lastActiveLabel}</span>
          <span class="member-detail-value">${timeAgo(stats.lastEventAt)}</span>
        </div>
      ` : ''}

      <div class="member-detail-row">
        <span class="member-detail-label">${D.birthdayLabel}</span>
        <span class="member-detail-value">
          ${d.birthday
            ? `${escapeHtml(d.birthday)} <span class="hint">· ${d.birthdayPublic ? D.birthdayPublic : D.birthdayHidden}</span>`
            : `<span class="hint">${D.birthdayNotSet}</span>`}
        </span>
      </div>

      <hr class="member-detail-divider">

      <div class="member-detail-edit">
        <div class="member-detail-edit-title">
          <i class="fa-solid fa-sliders"></i> ${D.editTitle}
        </div>

        ${!d.left ? `
          <div class="form-field">
            <label>${D.nicknameLabel}</label>
            <input type="text" id="mNickname" maxlength="32"
                   data-initial-nickname="${escapeHtml(d.serverNickname || '')}"
                   placeholder="${escapeHtml(d.username || '')}"
                   value="${escapeHtml(d.serverNickname || '')}">
            <span class="hint">${D.nicknameHint}</span>
          </div>

          <div class="form-grid-2">
            <div class="form-field">
              <label>${D.levelLabel}</label>
              <input type="number" id="mLevel" min="0" max="500"
                     data-initial-level="${d.level}"
                     value="${d.level}">
              <span class="hint">${D.levelHint}</span>
            </div>
            <div class="form-field">
              <label>${D.warningsLabel}</label>
              <input type="number" id="mWarnings" min="0"
                     data-initial-warnings="${d.warnings}"
                     value="${d.warnings}">
            </div>
          </div>

          <div class="form-field">
            <label>${D.rolesLabel(editableRoles.length)}</label>
            ${editableRoles.length > 0 ? `
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
                }).join('')}
              </div>
              <span class="hint">${D.rolesHint}</span>
            ` : `
              <div class="gr-perm-status warn">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <div>
                  <strong>${D.noRolesTitle}</strong>
                  <span>${D.noRolesHint}</span>
                </div>
              </div>
            `}
          </div>
        ` : `
          <div class="gr-perm-status warn" style="margin:0;">
            <i class="fa-solid fa-right-from-bracket"></i>
            <div>
              <strong>${D.memberLeftTitle}</strong>
              <span>${D.memberLeftHint}</span>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>${D.levelLabel}</label>
              <input type="number" id="mLevel" min="0" max="500"
                     data-initial-level="${d.level}"
                     value="${d.level}">
            </div>
            <div class="form-field">
              <label>${D.warningsLabel}</label>
              <input type="number" id="mWarnings" min="0"
                     data-initial-warnings="${d.warnings}"
                     value="${d.warnings}">
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