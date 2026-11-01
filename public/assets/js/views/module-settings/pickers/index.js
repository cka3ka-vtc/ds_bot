// public/assets/js/views/module-settings/pickers/index.js
// Агрегатор пикеров: popup-хелперы + channel/role/emoji.
// Потребители могут импортировать как из './pickers/index.js',
// так и из './pickers.js' (ре-экспорт).

export { positionPopup, openPickerPopup } from './popup.js';
export { channelIcon, channelPickerHTML, bindChannelPicker } from './channel.js';
export { rolePickerHTML, bindRolePicker } from './role.js';
export { emojiPickerHTML, bindEmojiPicker } from './emoji.js';