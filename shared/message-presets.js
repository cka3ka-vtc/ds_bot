// shared/message-presets.js
import { UI } from './ui-strings.js';

function uid() {
  return 'blk_' + Math.random().toString(36).slice(2, 10);
}

function baseConfig() {
  return {
    displayMode: 'embed-color',
    accentColor: '#5865F2',
    title: '',
    subtitle: '',
    thumbnail: '',
    blocks: [],
  };
}

export function hasMessageContent(cfg) {
  if (!cfg) return false;
  if (cfg.title || cfg.subtitle || cfg.thumbnail) return true;
  if (Array.isArray(cfg.blocks) && cfg.blocks.length) {
    return cfg.blocks.some((b) => {
      if (!b) return false;
      if (b.content) return true;
      if (b.title) return true;
      if (b.url) return true;
      if (Array.isArray(b.urls) && b.urls.length) return true;
      if (Array.isArray(b.items) && b.items.some((x) => x)) return true;
      if (Array.isArray(b.buttons) && b.buttons.length) return true;
      return false;
    });
  }
  return false;
}

const P = UI.msgEditor.presets;

/* ─────── greetings.join ─────── */
const presetsGreetingsJoin = [
  { key: 'classic', icon: 'fa-align-left', label: P.classic, description: P.classicDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '👋 Привет, {user}! Добро пожаловать на **{guild}**!\nТы наш **{count}-й** участник.' }],
    }) },
  { key: 'welcome-card', icon: 'fa-id-card', label: P.welcomeCard, description: P.welcomeCardDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#5865F2',
      title: 'Добро пожаловать!', subtitle: '{user}, мы рады тебя видеть 🎉',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'sections', title: 'Что дальше?', listStyle: 'numeric',
          items: ['Прочитай правила в **#rules**', 'Загляни в **#announcements**', 'Задай вопрос в **#support**'] },
        { id: uid(), type: 'footer', content: 'Ты — {count}-й участник {guild}' },
      ],
    }) },
  { key: 'server', icon: 'fa-server', label: P.serverCard, description: P.serverCardDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#16a34a',
      title: '{guild}', subtitle: 'Привет, {user}! Рады тебя видеть.',
      thumbnail: '{guildIconUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 2 },
        { id: uid(), type: 'text', content: '📊 Нас уже **{count}** — присоединяйся к общению!' },
        { id: uid(), type: 'footer', content: '{guild} · добро пожаловать' },
      ],
    }) },
  { key: 'minimal', icon: 'fa-minus', label: P.minimal, description: P.minimalDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '**{displayName}** присоединился к серверу ✨' }],
    }) },
];

/* ─────── greetings.leave ─────── */
const presetsGreetingsLeave = [
  { key: 'classic', icon: 'fa-align-left', label: P.classic, description: P.leaveClassicDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '😢 **{displayName}** покинул сервер. Будем скучать!' }],
    }) },
  { key: 'farewell', icon: 'fa-hand', label: P.farewell, description: P.farewellDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#dc2626',
      title: 'До встречи, {displayName}', subtitle: 'Нас покинул {username}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: 'На сервере осталось **{count}** участников. Возвращайся скорее! 👋' },
      ],
    }) },
];

/* ─────── levels.levelUp ─────── */
const presetsLevelsLevelUp = [
  { key: 'classic', icon: 'fa-align-left', label: P.classic, description: P.levelClassicDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '🎉 Поздравляем, {user}!\nТы достиг **{level}** уровня!' }],
    }) },
  { key: 'progress', icon: 'fa-chart-simple', label: P.progress, description: P.progressDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#f59e0b',
      title: 'Новый уровень: {level}', subtitle: 'Продолжай в том же духе, {displayName}!',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'sections', title: 'Прогресс', listStyle: 'dot',
          items: ['Текущий XP: **{xp}**', 'До следующего: **{xpToNext}**', 'Прогресс: **{progressPercent}%**'] },
        { id: uid(), type: 'footer', content: 'Ты на **{position}** месте в топе' },
      ],
    }) },
  { key: 'reward', icon: 'fa-award', label: P.reward, description: P.rewardDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#8b5cf6',
      title: '🏆 {level} уровень!', subtitle: '{user}, ты получил звание **{title}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: '🎁 Награда: {rewardRole}\nПродолжай общаться, чтобы получить ещё!' },
        { id: uid(), type: 'footer', content: 'Твоя позиция: **{position}**' },
      ],
    }) },
  { key: 'hero', icon: 'fa-id-card', label: P.hero, description: P.heroDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#5865F2',
      title: '⭐ Уровень {level}', subtitle: 'Так держать, {displayName}!',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 2 },
        { id: uid(), type: 'sections', title: 'Статистика', listStyle: 'numeric',
          items: ['Звание: **{title}**', 'Всего XP: **{xp}**',
                  'До следующего: **{xpToNext}** XP', 'Место в топе: **#{position}**'] },
        { id: uid(), type: 'footer', content: 'Продолжай общаться на {guild} 💪' },
      ],
    }) },
  { key: 'minimal', icon: 'fa-minus', label: P.minimal, description: P.levelMinimalDesc,
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '⬆️ **{user}** — **{level}** уровень!' }],
    }) },
];

/* ─────── levels.rank ─────── */
const presetsLevelsRank = [
  { key: 'classic', icon: 'fa-align-left', label: 'Карточка текстом',
    description: 'Простая текстовая карточка участника',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content:
          '⭐ **{displayName}** — уровень **{level}**\n' +
          'Звание: **{title}**\n' +
          'XP: **{xp}** / {nextLevelXp}\n' +
          'До следующего: **{xpToNext}** XP\n' +
          'Место в топе: **#{position}**' }],
    }) },
  { key: 'hero-card', icon: 'fa-id-card', label: 'Карточка героя',
    description: 'Embed с аватаром, званием и полной статистикой',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#5865F2',
      title: '{displayName}', subtitle: 'Звание: **{title}**',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'sections', title: 'Статистика', listStyle: 'dot',
          items: ['Уровень: **{level}**', 'Всего XP: **{xp}** / {nextLevelXp}',
                  'До следующего: **{xpToNext}** XP', 'Место в топе: **#{position}**'] },
        { id: uid(), type: 'footer', content: 'Прогресс уровня: **{progressPercent}%**' },
      ],
    }) },
  { key: 'compact', icon: 'fa-minus', label: 'Компактная',
    description: 'Одна строка с уровнем и местом',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '**{displayName}** · Ур. **{level}** · #{position} в топе' }],
    }) },
];

/* ─────── levels.leaderboard ─────── */
const presetsLevelsLeaderboard = [
  { key: 'classic', icon: 'fa-align-left', label: 'Топ с медалями',
    description: 'Embed со списком и заголовком',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#f59e0b',
      title: '🏆 Топ по уровням', subtitle: 'Лучшие участники **{guild}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: '{topUsers}' },
        { id: uid(), type: 'footer', content: 'Всего в топе: **{topCount}**' },
      ],
    }) },
  { key: 'minimal', icon: 'fa-minus', label: 'Минимализм',
    description: 'Просто список без обвязки',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '**Топ {guild}**\n\n{topUsers}' }],
    }) },
];

/* ─────── levels.daily ─────── */
const presetsLevelsDaily = [
  { key: 'classic', icon: 'fa-align-left', label: 'Классика',
    description: 'Короткое сообщение о награде',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '🎁 {user} получил **{xpGained} XP**!\nТеперь у него **{newXp} XP** (уровень {newLevel})' }],
    }) },
  { key: 'progress', icon: 'fa-chart-simple', label: 'С прогрессом',
    description: 'Embed с подробностями и таймером',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#16a34a',
      title: '🎁 Ежедневная награда', subtitle: '{displayName}, ты получил **{xpGained} XP**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'sections', title: 'Итого', listStyle: 'dot',
          items: ['Всего XP: **{newXp}**', 'Уровень: **{newLevel}**'] },
        { id: uid(), type: 'footer', content: 'Следующая награда {nextDailyAt}' },
      ],
    }) },
];

/* ═══════════════════ Birthdays ═══════════════════ */

/* ─────── birthdays.announce ─────── */
const presetsBirthdaysAnnounce = [
  { key: 'classic', icon: 'fa-align-left', label: 'Классика',
    description: 'Тёплое поздравление с упоминанием',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '🎂 С днём рождения, {user}!\n\nОт всей команды **{guild}** желаем тебе счастья, удачи и море позитива! 🎉' }],
    }) },
  { key: 'card', icon: 'fa-id-card', label: 'Карточка',
    description: 'Embed с аватаром, возрастом и пожеланиями',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#ec4899',
      title: '🎉 С днём рождения, {displayName}!',
      subtitle: 'Сегодня особенный день для всего сервера **{guild}**',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text',
          content: 'Дата: **{birthdayFull}**{age}\n\n' +
                   '🎁 Роль именинника выдана на 24 часа.' },
        { id: uid(), type: 'sections', title: 'Пожелания', listStyle: 'dot',
          items: ['Крепкого здоровья!', 'Море позитива и улыбок 😊',
                  'Исполнения всех желаний ✨', 'Классных друзей рядом'] },
        { id: uid(), type: 'footer', content: 'С любовью, коллектив {guild} 💖 · ДР отмечают {birthdaysCount} участников' },
      ],
    }) },
  { key: 'minimal', icon: 'fa-minus', label: 'Минимализм',
    description: 'Одна строка с упоминанием',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '🎂 **{user}** — с днём рождения! 🎉' }],
    }) },
];

/* ─────── birthdays.cmdSet ─────── */
const presetsBirthdaysCmdSet = [
  { key: 'classic', icon: 'fa-align-left', label: 'Классика',
    description: 'Стандартный ответ при установке ДР',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '✅ Твой день рождения сохранён: **{birthdayFull}**.\nЯ поздравлю тебя в этот день! 🎂' }],
    }) },
  { key: 'card', icon: 'fa-id-card', label: 'Карточка',
    description: 'Embed с подтверждением и возрастом',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#ec4899',
      title: '🎂 День рождения сохранён!',
      subtitle: 'Дата: **{birthdayFull}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text',
          content: 'Я поздравлю тебя **{birthday}** и выдам роль именинника на 24 часа. 🎁' },
        { id: uid(), type: 'footer', content: 'Управлять поздравлениями: /birthday_toggle' },
      ],
    }) },
];

/* ─────── birthdays.cmdToggle ─────── */
const presetsBirthdaysCmdToggle = [
  { key: 'classic', icon: 'fa-align-left', label: 'Классика',
    description: 'Стандартный ответ при переключении',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text',
        content: '🎂 Статус поздравлений: **{state}**.\nДата: **{birthdayFull}**' }],
    }) },
  { key: 'card', icon: 'fa-id-card', label: 'Карточка',
    description: 'Embed с состоянием',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#ec4899',
      title: 'Настройки поздравлений',
      subtitle: 'Поздравления: **{state}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text',
          content: 'Твоя дата рождения: **{birthdayFull}**\n\n' +
                   'Если поздравления включены — я пришлю поздравление и выдам роль.\n' +
                   'Если выключены — поздравлений не будет.' },
      ],
    }) },
];

/* ─────── birthdays.cmdList ─────── */
const presetsBirthdaysCmdList = [
  { key: 'classic', icon: 'fa-align-left', label: 'Классика',
    description: 'Список ближайших ДР',
    build: () => ({
      ...baseConfig(), displayMode: 'embed-color', accentColor: '#ec4899',
      title: '📅 Ближайшие дни рождения',
      subtitle: '10 ближайших на сервере **{guild}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: '{topUsers}' },
        { id: uid(), type: 'footer', content: 'Всего с указанным ДР: **{birthdaysCount}** · В топе: **{count}**' },
      ],
    }) },
  { key: 'minimal', icon: 'fa-minus', label: 'Минимализм',
    description: 'Просто список без обвязки',
    build: () => ({
      ...baseConfig(), displayMode: 'flat',
      blocks: [{ id: uid(), type: 'text', content: '**Дни рождения {guild}**\n\n{topUsers}' }],
    }) },
];

export const MESSAGE_PRESETS = {
  'greetings.join': presetsGreetingsJoin,
  'greetings.leave': presetsGreetingsLeave,
  'levels.levelUp': presetsLevelsLevelUp,
  'levels.rank': presetsLevelsRank,
  'levels.leaderboard': presetsLevelsLeaderboard,
  'levels.daily': presetsLevelsDaily,
  'birthdays.announce': presetsBirthdaysAnnounce,
  'birthdays.cmdSet': presetsBirthdaysCmdSet,
  'birthdays.cmdToggle': presetsBirthdaysCmdToggle,
  'birthdays.cmdList': presetsBirthdaysCmdList,
};

export function getPresetsFor(presetKey) {
  return MESSAGE_PRESETS[presetKey] || [];
}