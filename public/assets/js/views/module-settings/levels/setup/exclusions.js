// public/assets/js/views/module-settings/levels/setup/exclusions.js
import { escapeHtml } from '../../../../core/utils.js';
import { bindChannelPicker, bindRolePicker, rolePickerHTML } from '../../pickers.js';

/**
 * Секция «Исключения»:
 *   - исключённые каналы (chips сверху, picker снизу) — включая голосовые;
 *   - исключённые роли (chips сверху, picker снизу).
 *
 * «Исключённые каналы» принимают голосовые и stage-каналы (type 2/13),
 * чтобы за них не начислялся voice-XP.
 */
export function setupExclusions(ctx) {
  const { page, cfg, channels, roles, L } = ctx;

  /* ── Исключённые каналы ── */
  const chChips = page.querySelector('[data-excl-channels]');

  const renderChChips = () => {
    if (!cfg.excludedChannels.length) {
      chChips.innerHTML = `<div class="chip-empty">${L.exclChannelsEmpty}</div>`;
      return;
    }

    chChips.innerHTML = cfg.excludedChannels.map((id) => {
      const ch = channels.find((c) => c.id === id);
      const iconType = ch?.type === 2 || ch?.type === 13 ? 'fa-volume-high' : 'fa-hashtag';
      return `
        <div class="chip">
          <i class="fa-solid ${iconType}"></i>
          ${escapeHtml(ch?.name || id)}
          <button type="button" data-remove-excl-channel="${escapeHtml(id)}" aria-label="Удалить">×</button>
        </div>
      `;
    }).join('');

    chChips.querySelectorAll('[data-remove-excl-channel]').forEach((b) => {
      b.addEventListener('click', () => {
        cfg.excludedChannels = cfg.excludedChannels.filter((id) => id !== b.dataset.removeExclChannel);
        renderChChips();
      });
    });
  };

  renderChChips();

  bindChannelPicker(page, {
    id: 'excl_channel_picker',
    channels,
    multiSelect: true,
    filterList: (all) => all.filter((c) => !cfg.excludedChannels.includes(c.id)),
    onSelect: (ch) => {
      if (!ch) return;
      if (!cfg.excludedChannels.includes(ch.id)) {
        cfg.excludedChannels.push(ch.id);
        renderChChips();
      }
    },
  });

  /* ── Исключённые роли ── */
  const roleChips = page.querySelector('[data-excl-roles]');

  const renderRoleChips = () => {
    if (!cfg.excludedRoles.length) {
      roleChips.innerHTML = `<div class="chip-empty">${L.exclRolesEmpty}</div>`;
      return;
    }

    roleChips.innerHTML = cfg.excludedRoles.map((id) => {
      const r = roles.find((x) => x.id === id);
      const color = r?.color || 'var(--muted)';
      return `
        <div class="chip">
          <span class="chip-dot" style="background:${escapeHtml(color)};"></span>
          ${escapeHtml(r?.name || id)}
          <button type="button" data-remove-excl-role="${escapeHtml(id)}" aria-label="Удалить">×</button>
        </div>
      `;
    }).join('');

    roleChips.querySelectorAll('[data-remove-excl-role]').forEach((b) => {
      b.addEventListener('click', () => {
        cfg.excludedRoles = cfg.excludedRoles.filter((id) => id !== b.dataset.removeExclRole);
        renderRoleChips();
      });
    });
  };

  renderRoleChips();

  bindRolePicker(page, {
    id: 'excl_role_picker',
    roles,
    multiSelect: true,
    filterList: (all) => all.filter((r) => !cfg.excludedRoles.includes(r.id)),
    onSelect: (role) => {
      if (!role) return;
      if (!cfg.excludedRoles.includes(role.id)) {
        cfg.excludedRoles.push(role.id);
        renderRoleChips();
      }
    },
  });
}