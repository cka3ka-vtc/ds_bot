// public/assets/js/views/module-settings/message-editor/presets-ui.js
import { hasMessageContent } from '/shared/message-presets.js';
import { UI } from '/shared/ui-strings.js';
import { emptyMessageConfig } from './helpers.js';

/**
 * Применение пресета и очистка сообщения.
 *
 * Оба действия — полная замена конфига (не инкрементальная правка),
 * поэтому onChange пробрасывается СИНХРОННО, а не через _markDirty
 * (debounce 150 мс). Иначе при клике «Применить пресет» → «Сохранить»
 * на родительской странице состояние ещё не успело обновиться и
 * сохранение уходит со старым конфигом.
 */
export function mountPresetsMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

    /**
     * Синхронно уведомляет родителя о смене конфига. Используется в
     * местах, где нельзя ждать debounce (пресет, очистка, загрузка).
     */
    _notifyChangeSync() {
      try {
        this.onChange?.(this.getConfig());
      } catch {
        // родитель мог уже размонтироваться
      }
    },

    async _applyPreset(preset) {
      const P = UI.msgEditor.presets;
      if (hasMessageContent(this.config)) {
        const ok = await this._confirm({
          title: P.confirmReplaceTitle,
          text: P.confirmReplace,
          ctaLabel: UI.common.confirm,
        });
        if (!ok) return;
      }
      this.config = structuredClone(preset.build());
      this._rerenderAndRebind();
      // Полная замена — уведомляем синхронно, без debounce.
      this._notifyChangeSync();
    },

    async _clearConfig() {
      const P = UI.msgEditor.presets;
      if (hasMessageContent(this.config)) {
        const ok = await this._confirm({
          title: P.confirmClearTitle,
          text: P.confirmClear,
          ctaLabel: P.clear,
        });
        if (!ok) return;
      }
      this.config = emptyMessageConfig();
      this._rerenderAndRebind();
      this._notifyChangeSync();
    },

  });
}