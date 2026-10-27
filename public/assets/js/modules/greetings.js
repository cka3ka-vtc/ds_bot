export default {
  key: 'greetings',

  renderSettings(container, config) {
    container.innerHTML = `
      <div class="form-row">
        <div class="form-field">
          <label>ID канала приветствий</label>
          <input type="text" name="channelId" value="${config.channelId || ''}" placeholder="123456789">
        </div>
        <div class="form-field">
          <label>ID роли при входе</label>
          <input type="text" name="autoRoleId" value="${config.autoRoleId || ''}" placeholder="987654321">
        </div>
      </div>
      <div class="form-row single">
        <div class="form-field">
          <label>Текст приветствия</label>
          <textarea name="message" rows="3">${config.message || 'Привет, {user}! 👋'}</textarea>
          <span class="hint">Доступны переменные: {user}, {count}, {guild}</span>
        </div>
      </div>
      <div class="form-toggle-row">
        <div class="form-toggle-label">
          <strong>Отправлять Embed</strong>
          <span>Красивая карточка с аватаркой</span>
        </div>
        <button type="button" class="toggle ${config.sendEmbed ? 'on' : ''}"
                data-toggle="sendEmbed" role="switch"
                aria-checked="${config.sendEmbed}"></button>
      </div>
    `;
    container.querySelectorAll('.toggle').forEach(t => {
      t.addEventListener('click', () => {
        const on = t.classList.toggle('on');
        t.setAttribute('aria-checked', String(on));
      });
    });
  },

  collectSettings(container) {
    return {
      channelId: container.querySelector('[name="channelId"]').value.trim(),
      autoRoleId: container.querySelector('[name="autoRoleId"]').value.trim(),
      message: container.querySelector('[name="message"]').value,
      sendEmbed: container.querySelector('[data-toggle="sendEmbed"]').classList.contains('on'),
    };
  },
};