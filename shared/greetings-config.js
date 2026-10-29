// shared/greetings-config.js
// Единый источник дефолтов и нормализации конфига модуля «Приветствия».

export function defaultMessageConfig() {
  return {
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: [],
  };
}

export function defaultGreetingsConfig() {
  return {
    channelId: '',
    events: { join: true, leave: false },
    messages: {
      join: defaultMessageConfig(),
      leave: defaultMessageConfig(),
    },
  };
}

function uid() {
  return 'blk_' + Math.random().toString(36).slice(2, 10);
}

export function mergeGreetingsConfig(raw) {
  const cfg = defaultGreetingsConfig();
  if (!raw || typeof raw !== 'object') return cfg;

  if (raw.channelId) cfg.channelId = String(raw.channelId);

  // Миграция старого формата: { message, sendEmbed }
  if (raw.message && !raw.messages) {
    cfg.messages.join.blocks = [{ id: uid(), type: 'text', content: String(raw.message) }];
    if (raw.sendEmbed) cfg.messages.join.displayMode = 'embed-color';
  }

  if (raw.events && typeof raw.events === 'object') {
    cfg.events = { ...cfg.events, ...raw.events };
  }
  if (raw.messages && typeof raw.messages === 'object') {
    if (raw.messages.join) cfg.messages.join = { ...cfg.messages.join, ...raw.messages.join };
    if (raw.messages.leave) cfg.messages.leave = { ...cfg.messages.leave, ...raw.messages.leave };
  }

  for (const key of ['join', 'leave']) {
    if (!Array.isArray(cfg.messages[key].blocks)) cfg.messages[key].blocks = [];
  }
  return cfg;
}