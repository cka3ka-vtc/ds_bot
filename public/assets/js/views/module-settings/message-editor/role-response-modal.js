// public/assets/js/views/module-settings/message-editor/role-response-modal.js
//
// Модалка настройки ответов на клик по кнопке-роли.
// Три таба: «Роль выдана», «Роль снята», «Ошибка».
// В каждом — MessageEditor с hideBlockTypes:['role-buttons'] (нет рекурсии).

import { openModal } from '../../../core/modal.js';
import { MessageEditor } from './index.js';
import {
  defaultRoleSuccessAddResponse,
  defaultRoleSuccessRemoveResponse,
  defaultRoleErrorResponse,
} from '/shared/role-button-responses.js';
import { UI } from '/shared/ui-strings.js';

const TABS = ['successAdd', 'successRemove', 'error'];

export function openRoleResponseModal({ btn, bot, roles, guildId, botId }) {
  let currentTab = 'successAdd';

  let successAddCfg = structuredClone(btn.successAddResponse || defaultRoleSuccessAddResponse());
  let successRemoveCfg = structuredClone(btn.successRemoveResponse || defaultRoleSuccessRemoveResponse());
  let errorCfg = structuredClone(btn.errorResponse || defaultRoleErrorResponse());

  const R = UI.msgEditor.roleResponseModal;

  const tabLabel = (t) => ({
    successAdd: R.tabSuccessAdd,
    successRemove: R.tabSuccessRemove,
    error: R.tabError,
  }[t]);

  const cfgForTab = (t) => ({
    successAdd: successAddCfg,
    successRemove: successRemoveCfg,
    error: errorCfg,
  }[t]);

  return openModal({
    title: R.title,
    subtitle: R.subtitle(btn.label || 'Роль'),
    wide: true,
    ctaLabel: R.save,
    body: `
      <div class="gr-tabs" data-tabs style="margin-bottom:12px;">
        ${TABS.map((t) => `
          <button type="button" class="gr-tab ${t === currentTab ? 'active' : ''}" data-tab="${t}">
            ${tabLabel(t)}
          </button>
        `).join('')}
      </div>
      <p class="hint" style="margin:0 0 12px; font-size:12px; color:var(--muted); line-height:1.4;">${R.hint}</p>
      <div data-editor-container></div>
    `,
    onOpen: (modal) => {
      const container = modal.querySelector('[data-editor-container]');
      let editor = null;

      const saveCurrent = () => {
        if (!editor) return;
        const val = editor.getConfig();
        if (currentTab === 'successAdd') successAddCfg = val;
        else if (currentTab === 'successRemove') successRemoveCfg = val;
        else errorCfg = val;
      };

      const mountEditor = (cfg) => {
        if (editor) { try { editor.destroy(); } catch {} }
        container.innerHTML = '';
        editor = new MessageEditor(container, cfg, {
          bot,
          roles: roles || [],
          context: 'role-button-response',
          presetKey: null,
          hideBlockTypes: ['role-buttons'],
          guildId,
          botId,
        });
        editor.mount();
      };

      mountEditor(cfgForTab(currentTab));

      modal.querySelectorAll('[data-tab]').forEach((t) => {
        t.addEventListener('click', () => {
          saveCurrent();
          currentTab = t.dataset.tab;
          modal.querySelectorAll('[data-tab]').forEach((x) =>
            x.classList.toggle('active', x === t));
          mountEditor(cfgForTab(currentTab));
        });
      });

      modal._saveCurrent = saveCurrent;
    },
    onSubmit: (modal) => {
      modal._saveCurrent?.();
      return {
        successAddResponse: successAddCfg,
        successRemoveResponse: successRemoveCfg,
        errorResponse: errorCfg,
      };
    },
  });
}