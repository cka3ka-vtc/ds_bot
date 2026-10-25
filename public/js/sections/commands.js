/* ============================================================
   Управление slash-командами.

   Позволяет для каждой команды:
   - включить/выключить
   - задать cooldown (сек)
   - ограничить доступ по ролям
   ============================================================ */

import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';
import { toast, emptyState } from '../ui.js';
import { rolePickerHTML, bindRolePicker } from '../pickers.js';

/* Подкоманды для отображения в раскрытой карточке */
const SUBCOMMANDS = {
  hb: [
    { name: 'set',     description: 'Установить дату рождения' },
    { name: 'info',    description: 'Показать мою дату рождения' },
    { name: 'enable',  description: 'Включить поздравления' },
    { name: 'disable', description: 'Отключить поздравления' },
    { name: 'list',    description: 'Список дней рождения сервера' }
  ]
};

let draft = null;
const expanded = new Set();

/* ============================================================
   Рендер
   ============================================================ */

export async function renderCommandsView() {
  const root = document.getElementById('view-commands');
  if (!root) return;

  root.innerHTML = `
    <div class="section-intro">
      <h2><i class="fa-solid fa-terminal"></i> Команды</h2>
      <p>Настройте доступность каждой slash-команды и её подкоманд. Отключённые команды исчезают из списка Discord.</p>
      <ul>
        <li><strong>Отключение</strong> — команда скрывается из Discord</li>
        <li><strong>Задержка</strong> — защита от спама (cooldown)</li>
        <li><strong>Роли</strong> — доступ только участникам с одной из ролей</li>
      </ul>
    </div>
    <div class="card">
      <div class="card-body">
        <div id="commandsList">
          <div class="empty-state">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <p class="empty-state-text">Загрузка…</p>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const list = await api.commands(state.guildId);
    draft = list.map(c => ({ ...c, config: { ...c.config } }));
    renderList();
  } catch (e) {
    document.getElementById('commandsList').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3 class="empty-state-title">Ошибка загрузки</h3>
        <p class="empty-state-text">${escapeHtml(e.message)}</p>
      </div>
    `;
  }
}

function renderList() {
  const container = document.getElementById('commandsList');
  if (!container) return;

  if (!draft.length) {
    container.innerHTML = emptyState({
      icon: 'fa-terminal',
      title: 'Нет команд',
      text: 'Доступные команды появятся здесь.'
    });
    return;
  }

  container.innerHTML = draft.map(cmd => renderCommandCard(cmd)).join('');
  bindHandlers();
}

function renderCommandCard(cmd) {
  const isEnabled = cmd.config.enabled !== false;
  const cooldown = cmd.config.cooldownSec || 0;
  const roles = cmd.config.allowedRoleIds || [];
  const subs = SUBCOMMANDS[cmd.name] || [];
  const isExpanded = expanded.has(cmd.name);

  /* Список ролей с именами */
  const roleChips = roles.length
    ? roles.map(rid => {
      const r = state.roles.find(x => x.id === rid);
      return `<span class="bd-role-chip">
        <span>${escapeHtml(r?.name || rid)}</span>
        <button type="button" data-cmd-rmrole="${cmd.name}" data-rid="${rid}" aria-label="Удалить">✕</button>
      </span>`;
    }).join('')
    : '<span class="bd-role-empty">Без ограничений — доступно всем</span>';

  return `
    <div class="cmd-row ${isEnabled ? '' : 'is-disabled'}">
      <div class="cmd-row-head" data-cmd-expand="${cmd.name}">
        <div class="cmd-row-icon"><i class="fa-solid fa-terminal"></i></div>
        <div class="cmd-row-title">
          <div class="cmd-name">/${escapeHtml(cmd.name)}</div>
          <div class="cmd-desc">${escapeHtml(cmd.description)}</div>
        </div>
        <button type="button" class="cmd-expand-btn ${isExpanded ? 'open' : ''}" aria-label="Развернуть">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <label class="switch ${isEnabled ? 'on' : ''}" data-cmd-toggle="${cmd.name}" title="Вкл / выкл" onclick="event.stopPropagation()"></label>
      </div>
      ${isExpanded ? `
        <div class="cmd-row-body">
          ${subs.length ? `
            <div class="cmd-subs">
              <label style="font-size:12px;font-weight:600;color:var(--text-dim);display:block;margin-bottom:6px;">Подкоманды</label>
              ${subs.map(sub => `
                <div class="cmd-sub">
                  <span class="cmd-sub-name">/${cmd.name} ${sub.name}</span>
                  <span class="cmd-sub-desc">${escapeHtml(sub.description)}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          <div class="form-group" style="max-width:200px;">
            <label>Задержка, сек</label>
            <input type="number" class="input" min="0" max="3600" value="${cooldown}" data-cmd-cooldown="${cmd.name}">
            <span class="hint">0 — без ограничений</span>
          </div>
          <div class="form-group" style="flex:1;">
            <label>Доступ по ролям</label>
            <div class="bd-role-chips" data-cmd-chips="${cmd.name}">${roleChips}</div>
            ${rolePickerHTML({ id: `cmd_role_${cmd.name}`, placeholder: 'Добавить роль…' })}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/* ============================================================
   Обработчики
   ============================================================ */

function bindHandlers() {
  const container = document.getElementById('commandsList');

  /* Раскрытие */
  container.querySelectorAll('[data-cmd-expand]').forEach(head => {
    head.addEventListener('click', (e) => {
      if (e.target.closest('.switch') || e.target.closest('[data-cmd-toggle]')) return;
      const name = head.dataset.cmdExpand;
      if (expanded.has(name)) expanded.delete(name);
      else expanded.add(name);
      renderList();
    });
  });

  /* Включение */
  container.querySelectorAll('[data-cmd-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const cmd = draft.find(c => c.name === el.dataset.cmdToggle);
      if (!cmd) return;
      cmd.config.enabled = cmd.config.enabled === false ? true : false;
      renderList();
    });
  });

  /* Cooldown */
  container.querySelectorAll('[data-cmd-cooldown]').forEach(input => {
    input.addEventListener('input', () => {
      const cmd = draft.find(c => c.name === input.dataset.cmdCooldown);
      if (!cmd) return;
      cmd.config.cooldownSec = Math.max(0, Math.min(3600, parseInt(input.value, 10) || 0));
    });
  });

  /* Удаление роли из чипсов */
  container.querySelectorAll('[data-cmd-rmrole]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = draft.find(c => c.name === btn.dataset.cmdRmrole);
      if (!cmd) return;
      cmd.config.allowedRoleIds = (cmd.config.allowedRoleIds || []).filter(x => x !== btn.dataset.rid);
      renderList();
    });
  });

  /* Роль-пикер */
  draft.forEach(cmd => {
    if (!expanded.has(cmd.name)) return;
    bindRolePicker(container, {
      id: `cmd_role_${cmd.name}`,
      onSelect: (role) => {
        if (!role) return;
        const ids = new Set(cmd.config.allowedRoleIds || []);
        ids.add(role.id);
        cmd.config.allowedRoleIds = [...ids];
        renderList();
      }
    });
  });
}

/* ============================================================
   Сохранение
   ============================================================ */

export async function saveCommands() {
  if (!draft) return toast('Нет данных', { type: 'error' });

  try {
    await Promise.all(draft.map(c =>
      api.updateCommand(state.guildId, c.name, {
        enabled: c.config.enabled !== false,
        cooldownSec: c.config.cooldownSec || 0,
        allowedRoleIds: c.config.allowedRoleIds || []
      })
    ));
    toast('Настройки команд сохранены');
  } catch (e) {
    toast('Ошибка: ' + e.message, { type: 'error' });
  }
}