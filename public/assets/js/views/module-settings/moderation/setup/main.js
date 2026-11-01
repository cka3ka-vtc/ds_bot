// public/assets/js/views/module-settings/moderation/setup/main.js
// Канал логов + общие уведомления (модалки шаблонов) + тумблеры.

import { bindChannelPicker, bindRolePicker } from '../../pickers.js';
import { MessageEditor, emptyMessageConfig } from '../../message-editor.js';
import { openModal } from '../../../../core/modal.js';
import { bindSteppers } from '../helpers.js';

export function setupMain(ctx) {
  const { root, cfg, channels, roles, S, bot, botId, guildId, toast } = ctx;

  /* ═════════ Канал логов ═════════ */
  const statusEl = root.querySelector('[data-channel-status]');
  function setStatus(ok, tooltip) {
    if (!statusEl) return;
    statusEl.className = 'channel-status ' + (ok ? 'ok' : 'empty');
    statusEl.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-minus'}"></i>`;
    if (tooltip) statusEl.setAttribute('data-tooltip', tooltip);
    else statusEl.removeAttribute('data-tooltip');
  }

  const picker = bindChannelPicker(root, {
    id: 'mod_log_channel',
    channels,
    onSelect: (ch) => {
      cfg.logChannelId = ch?.id || '';
      setStatus(!!ch, ch ? S.channelStatusOk : S.channelStatusEmpty);
    },
  });
  if (cfg.logChannelId) {
    const ch = channels.find((c) => c.id === cfg.logChannelId);
    if (ch && picker) picker.setValue?.(ch);
  }

  /* ═════════ Модалки шаблонов ═════════ */
  root.querySelectorAll('[data-edit-template]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.editTemplate; // 'dm' | 'log'
      openTemplateModal(ctx, kind);
    });
  });

  /* ═════════ Тумблеры ═════════ */
  root.querySelector('[data-notify-author]')?.addEventListener('click', function () {
    this.classList.toggle('on');
    cfg.notifyAuthor = this.classList.contains('on');
    this.setAttribute('aria-checked', String(cfg.notifyAuthor));
  });

  const pingToggle = root.querySelector('[data-ping-mods]');
  const roleField = root.querySelector('[data-moderator-role-field]');
  pingToggle?.addEventListener('click', () => {
    pingToggle.classList.toggle('on');
    cfg.pingModerators = pingToggle.classList.contains('on');
    pingToggle.setAttribute('aria-checked', String(cfg.pingModerators));
    if (roleField) roleField.hidden = !cfg.pingModerators;
  });

  /* ═════════ Роль для пинга ═════════ */
  bindRolePicker(root, {
    id: 'mod_ping_role',
    roles,
    onSelect: (r) => { cfg.moderatorRoleId = r?.id || ''; },
  });

  bindSteppers(root);
}

/* ═════════ Модалка шаблона ═════════ */

function openTemplateModal(ctx, kind) {
  const { cfg, bot, roles, guildId, botId, S, root } = ctx;
  const isDm = kind === 'dm';
  const key = isDm ? 'templateDm' : 'templateLog';
  const context = isDm ? 'moderation.dm' : 'moderation.log';
  const title = isDm ? S.templateModalTitleDm : S.templateModalTitleLog;
  const subtitle = isDm ? S.templateModalSubtitleDm : S.templateModalSubtitleLog;

  openModal({
    title,
    subtitle,
    ctaLabel: S.save,
    fullscreen: true,
    body: `<div class="template-modal-body" data-template-modal></div>`,
    onOpen: (modal) => {
      const mount = modal.querySelector('[data-template-modal]');
      const editor = new MessageEditor(mount, cfg[key] || emptyMessageConfig(), {
        bot: bot || { name: 'Bot', avatarUrl: null },
        roles: roles || [],
        context,
        presetKey: null,
        guildId,
        botId,
      });
      editor.mount();
      modal._editor = editor;
    },
    onSubmit: (modal) => {
      cfg[key] = modal._editor?.getConfig?.() || cfg[key];
      updateTemplatePreview(root, kind, cfg[key], S);
    },
  });
}

/* ═════════ Обновление превью в строке ═════════ */

function updateTemplatePreview(root, kind, cfg, S) {
  const row = root.querySelector(`[data-template-row="${kind}"]`);
  const previewEl = row?.querySelector('.template-row-preview');
  if (!previewEl) return;

  let text = cfg?.title || cfg?.subtitle || '';
  if (!text && Array.isArray(cfg?.blocks)) {
    const first = cfg.blocks.find((b) => b.content || b.title);
    text = first?.content || first?.title || '';
  }
  text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 110);
  previewEl.textContent = text || S.templateEmpty;
}