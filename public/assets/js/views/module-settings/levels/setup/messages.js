// public/assets/js/views/module-settings/levels/setup/messages.js
//
// Настройка «Сообщения»:
//   - 4 таба: levelUp / rank / leaderboard / daily;
//   - каждый таб → свой MessageEditor;
//   - кнопка «Тест» → POST /api/modules/levels/test.

import { MessageEditor, emptyMessageConfig } from '../../message-editor.js';

const MSG_TABS = ['levelUp', 'rank', 'leaderboard', 'daily'];

export function setupMessages(ctx) {
  const { page, cfg, roles, bot, botId, guildId, state, api, toast, UI, M } = ctx;

  const editorContainer = page.querySelector('[data-editor-container]');
  const tabHint = page.querySelector('[data-msg-tab-hint]');

  const mountEditor = (tabKey) => {
    const prev = state.editors[tabKey];
    if (prev) { try { prev.destroy(); } catch {} }

    editorContainer.innerHTML = '';
    const initial = cfg.messages[tabKey] || emptyMessageConfig();
    const presetKey = `levels.${tabKey}`;

    const editor = new MessageEditor(editorContainer, initial, {
      bot,
      roles,
      context: `levels.${tabKey}`,
      presetKey,
      guildId,
      botId,
    });
    editor.onChange = (m) => { cfg.messages[tabKey] = m; };
    editor.mount();
    state.editors[tabKey] = editor;
  };

  const switchMsgTab = (tabKey) => {
    if (!MSG_TABS.includes(tabKey)) return;
    if (state.activeMsgTab === tabKey) return;

    const cur = state.editors[state.activeMsgTab];
    if (cur) cfg.messages[state.activeMsgTab] = cur.getConfig();

    state.activeMsgTab = tabKey;
    page.querySelectorAll('[data-msg-tab]').forEach((b) =>
      b.classList.toggle('active', b.dataset.msgTab === tabKey));
    if (tabHint) tabHint.textContent = M.tabs[tabKey]?.hint || '';
    mountEditor(tabKey);
  };

  page.querySelectorAll('[data-msg-tab]').forEach((btn) => {
    btn.addEventListener('click', () => switchMsgTab(btn.dataset.msgTab));
  });

  mountEditor(state.activeMsgTab);

  page.querySelector('[data-test-message]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!cfg.announceChannelId) return toast(M.testNeedChannel, 'warn');

    const tab = state.activeMsgTab;
    const editorForTest = state.editors[tab];
    const cfgForTest = editorForTest
      ? editorForTest.getConfig()
      : (cfg.messages[tab] || emptyMessageConfig());

    const orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${UI.common.sending}`;
    try {
      // ФИКС: /api/modules/levels/test вместо /api/levels/test.
      // Старый URL работал через deprecated-alias — убираем зависимость.
      await api.post('/api/modules/levels/test', {
        botId,
        guildId,
        channelId: cfg.announceChannelId,
        messageConfig: cfgForTest,
        which: tab,
      });
      toast(M.testSent, 'success');
    } catch (err) {
      const map = { ...UI.errors };
      toast(
        map[err.data?.error] || (UI.common.error + ': ' + (err.data?.details || err.message)),
        'error',
      );
    } finally {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  });
}