// shared/role-button-responses.js
//
// Готовые шаблоны ответов для кнопок-ролей.
// Три независимых ответа:
//   - successAddResponse    — когда роль выдана
//   - successRemoveResponse — когда роль снята
//   - errorResponse         — когда операция не удалась
//
// Используются как дефолт при создании кнопки и как fallback на сервере,
// если в БД нет сохранённого ответа.

const SUCCESS_ADD = {
  displayMode: 'embed-color',
  accentColor: '#16a34a',
  title: '',
  subtitle: '',
  thumbnail: '',
  blocks: [{
    id: 'role_success_add_default',
    type: 'text',
    content: '✅ Роль **{roleName}** выдана!\n-# Нажмите кнопку ещё раз, чтобы снять её.',
  }],
};

const SUCCESS_REMOVE = {
  displayMode: 'embed-color',
  accentColor: '#3b82f6',
  title: '',
  subtitle: '',
  thumbnail: '',
  blocks: [{
    id: 'role_success_remove_default',
    type: 'text',
    content: '↪️ Роль **{roleName}** снята.\n-# Нажмите кнопку ещё раз, чтобы вернуть её.',
  }],
};

const ERROR = {
  displayMode: 'embed-color',
  accentColor: '#dc2626',
  title: '',
  subtitle: '',
  thumbnail: '',
  blocks: [{
    id: 'role_error_default',
    type: 'text',
    content: '❌ Не удалось изменить роль **{roleName}**.\n-# Попробуйте позже или обратитесь к администрации.',
  }],
};

export function defaultRoleSuccessAddResponse() {
  return structuredClone(SUCCESS_ADD);
}

export function defaultRoleSuccessRemoveResponse() {
  return structuredClone(SUCCESS_REMOVE);
}

export function defaultRoleErrorResponse() {
  return structuredClone(ERROR);
}