// public/assets/js/views/module-settings/message-editor/presets-ui.js
import { hasMessageContent } from '/shared/message-presets.js';
import { UI } from '/shared/ui-strings.js';
import { emptyMessageConfig } from './helpers.js';

/**
 * Применение пресета, сброс к стандартному и очистка сообщения.
 *
 * Все три действия — полная замена конфига, поэтому onChange пробрасывается
 * СИНХРОННО (_notifyChangeSync), а не через debounce _markDirty.
 */
export function mountPresetsMethods(MessageEditor) {
  Object.assign(MessageEditor.prototype, {

    /**
     * Синхронно уведомляет родителя о смене конфига.
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

    /**
     * Сброс к стандартному шаблону. Стандарт определяется через
     * opts.resetFactory, переданный в конструктор. Для фильтров
     * автомодерации это filterLogDefault(key) / filterDmDefault(key)
     * (см. shared/moderation-config.js).
     *
     * Если resetFactory не задан — метод ничего не делает
     * (и кнопка «Сбросить» в UI не рендерится).
     */
    async _resetConfig() {
      if (!this._resetFactory) return;
      const P = UI.msgEditor.presets;
      if (hasMessageContent(this.config)) {
        const ok = await this._confirm({
          title: P.confirmResetTitle,
          text: P.confirmReset,
          ctaLabel: P.reset,
        });
        if (!ok) return;
      }
      this.config = structuredClone(this._resetFactory());
      this._rerenderAndRebind();
      this._notifyChangeSync();
    },

  });
}