// shared/message-templates-config.js
export function defaultTemplateMessageConfig() {
  return {
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: [],
  };
}

export function mergeTemplateMessageConfig(raw) {
  const d = defaultTemplateMessageConfig();
  if (!raw || typeof raw !== 'object') return d;
  return {
    displayMode: ['context', 'flat', 'embed', 'embed-color'].includes(raw.displayMode)
      ? raw.displayMode
      : d.displayMode,
    accentColor: typeof raw.accentColor === 'string' ? raw.accentColor : d.accentColor,
    title:     typeof raw.title === 'string' ? raw.title : '',
    subtitle:  typeof raw.subtitle === 'string' ? raw.subtitle : '',
    thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : '',
    blocks:    Array.isArray(raw.blocks) ? raw.blocks : [],
  };
}