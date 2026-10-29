// public/assets/js/views/settings/index.js
import { UI } from '/shared/ui-strings.js';

export default {
  async render(container) {
    container.innerHTML = `
      <div class="view-head">
        <div class="view-title">
          <h1>${UI.pages.settings.title}</h1>
          <p>${UI.pages.settings.subtitle}</p>
        </div>
      </div>
      <div class="empty-state" style="padding:64px 24px;">
        <i class="fa-solid fa-screwdriver-wrench"></i>
        <strong>${UI.settingsStub.title}</strong>
        <span>${UI.settingsStub.hint}</span>
      </div>
    `;
  },
};