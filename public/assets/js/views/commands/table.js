// public/assets/js/views/commands/table.js
import { escapeHtml, WORD } from '../../core/utils.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { store } from '../../core/store.js';
import { openModal } from '../../core/modal.js';
import { UI } from '/shared/ui-strings.js';
import { CMD_EDITOR } from '/shared/command-editor-strings.js';
import { openEditor } from './editor.js';

const T = CMD_EDITOR.table;

export function renderTable(view) {
  const { container, state } = view;
  const body = container.querySelector('#cmdBody');
  const empty = container.querySelector('#cmdEmpty');
  const count = container.querySelector('#cmdCount');
  if (!body) return;

  const list = [];
  if (state.filter !== 'custom') state.builtin.forEach((c) => list.push({ ...c, _src: 'builtin' }));
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
    body.innerHTML = '';
    empty.hidden = false;
    count.textContent = `0 ${WORD.command(0)}`;
    return;
  }
  empty.hidden = true;
  count.textContent = `${filtered.length} ${WORD.command(filtered.length)}`;

  body.innerHTML = filtered.map((c) => renderRow(c)).join('');

  body.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openEditor(view, b.dataset.edit)));
  body.querySelectorAll('[data-delete]').forEach((b) =>
    b.addEventListener('click', () => removeCommand(view, b.dataset.delete)));
  body.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => toggleCommand(view, b.dataset.toggle, b)));
  body.querySelectorAll('[data-test]').forEach((b) =>
    b.addEventListener('click', () => openTestDialog(view, b.dataset.test)));
}

function renderRow(c) {
  const isCustom = c._src === 'custom';
  const badges = isCustom ? renderCustomBadges(c) : '';
  const usage = isCustom ? renderUsageBadge(c) : '';

  return `
    <tr data-id="${c.id}" data-source="${c._src}">
      <td>
        <div class="cmd-cell">
          <span class="cmd-icon ${isCustom ? 'custom' : ''}">
            <i class="fa-solid ${isCustom ? 'fa-message' : 'fa-bolt'}"></i>
          </span>
          <div>
            <div class="cmd-name">/${escapeHtml(c.name)}</div>
            <div class="cmd-desc">${escapeHtml(c.description || '—')}</div>
            ${badges}
          </div>
        </div>
      </td>
      <td>
        ${isCustom
          ? `<span class="cat-pill custom">Custom</span>`
          : `<span class="cat-pill util">${escapeHtml(c.category || 'Utility')}</span>`}
      </td>
      <td>
        <span class="type-badge ${isCustom ? 'custom' : 'functional'}">
          ${isCustom ? UI.commands.typeCustom : UI.commands.typeBuiltin}
        </span>
      </td>
      <td>
        <div class="row-actions">
          ${isCustom
            ? `${usage}
               <button class="btn btn-icon btn-ghost" data-test="${c.id}" title="${T.test}" aria-label="${T.test}"><i class="fa-solid fa-paper-plane"></i></button>
               <button class="btn btn-icon btn-ghost" data-edit="${c.id}" title="${UI.common.edit}" aria-label="${UI.common.edit}"><i class="fa-solid fa-gear"></i></button>
               <button class="btn btn-icon btn-ghost" data-delete="${c.id}" title="${UI.common.delete}" aria-label="${UI.common.delete}"><i class="fa-solid fa-trash"></i></button>
               <button class="toggle ${c.enabled ? 'on' : ''}" data-toggle="${c.id}" role="switch" aria-checked="${c.enabled}" aria-label="/${escapeHtml(c.name)}"></button>`
            : `<span class="badge online">${UI.commands.badgeBuiltin}</span>`}
        </div>
      </td>
    </tr>
  `;
}

function renderCustomBadges(c) {
  const parts = [];

  if (c.channelsMode === 'whitelist' && c.channels.length) {
    parts.push(`<span class="cmd-badge"><i class="fa-solid fa-hashtag"></i> ${T.channelsLimited(c.channels.length)}</span>`);
  } else if (c.channelsMode === 'blacklist' && c.channels.length) {
    parts.push(`<span class="cmd-badge warn"><i class="fa-solid fa-ban"></i> кроме ${T.channelsLimited(c.channels.length)}</span>`);
  }

  if (c.requireRoles?.length) {
    parts.push(`<span class="cmd-badge"><i class="fa-solid fa-shield-halved"></i> ${c.requireRoles.length}</span>`);
  }
  if (c.excludeRoles?.length) {
    parts.push(`<span class="cmd-badge warn"><i class="fa-solid fa-user-slash"></i> ${c.excludeRoles.length}</span>`);
  }
  if (c.cooldownSeconds > 0) {
    parts.push(`<span class="cmd-badge"><i class="fa-solid fa-clock"></i> ${T.cooldownShort(c.cooldownSeconds)}</span>`);
  }
  if (c.ephemeral) {
    parts.push(`<span class="cmd-badge"><i class="fa-solid fa-eye-slash"></i> ${T.ephemeral}</span>`);
  }
  if (c.responseMode === 'embed') {
    parts.push(`<span class="cmd-badge"><i class="fa-solid fa-square"></i> ${T.embed}</span>`);
  }
  if (!c.enabled) {
    parts.push(`<span class="cmd-badge off"><i class="fa-solid fa-power-off"></i> ${T.disabled}</span>`);
  }

  if (!parts.length) return '';
  return `<div class="cmd-badges">${parts.join('')}</div>`;
}

function renderUsageBadge(c) {
  if (!c.usageCount) {
    return `<span class="cmd-usage muted" title="${T.neverUsed}"><i class="fa-solid fa-chart-simple"></i> 0</span>`;
  }
  return `<span class="cmd-usage" title="${T.usage}"><i class="fa-solid fa-chart-simple"></i> ${c.usageCount}</span>`;
}

async function removeCommand(view, id) {
  if (!confirm(UI.commands.confirmDelete)) return;
  try {
    await api.del(`/api/commands/${id}?botId=${store.get('activeBotId')}&guildId=${store.get('activeGuildId')}`);
    toast(UI.toast.deleted, 'success');
    await view.render(view.container);
  } catch (err) {
    toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
  }
}

async function toggleCommand(view, id, btn) {
  const enabled = btn.classList.toggle('on');
  btn.setAttribute('aria-checked', String(enabled));
  try {
    await api.post(`/api/commands/${id}/toggle`, {
      botId: store.get('activeBotId'),
      guildId: store.get('activeGuildId'),
      enabled,
    });
    // Обновляем локальный state, чтобы бейджи в строке актуализировались.
    const cmd = view.state.custom.find((c) => c.id === id);
    if (cmd) cmd.enabled = enabled;
    renderTable(view);
  } catch (err) {
    btn.classList.toggle('on');
    btn.setAttribute('aria-checked', String(!enabled));
    toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
  }
}

function openTestDialog(view, id) {
  const channels = view.state.channels || [];
  if (!channels.length) {
    toast(T.testNeedChannel, 'warn');
    return;
  }

  const options = channels.map((c) =>
    `<option value="${escapeHtml(c.id)}">#${escapeHtml(c.name)}${c.parentName ? ` (${escapeHtml(c.parentName)})` : ''}</option>`
  ).join('');

  openModal({
    title: T.test,
    subtitle: T.testPickChannel,
    body: `
      <div class="form-field">
        <label>Канал</label>
        <select id="testChannel">
          ${options}
        </select>
      </div>
    `,
    ctaLabel: 'Отправить',
    onSubmit: async (modal) => {
      const channelId = modal.querySelector('#testChannel').value;
      try {
        await api.post(`/api/commands/${id}/test`, {
          botId: store.get('activeBotId'),
          guildId: store.get('activeGuildId'),
          channelId,
        });
        toast(T.testSent, 'success');
        return true;
      } catch (err) {
        toast(UI.common.error + ': ' + (err.data?.error || err.message), 'error');
        throw err;
      }
    },
  });
}