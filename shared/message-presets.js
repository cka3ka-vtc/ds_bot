// shared/message-presets.js
// Готовые шаблоны сообщений для редактора модулей.
// Возвращает массив { key, icon, label, description, build() }.
// build() при каждом вызове создаёт НОВЫЙ объект (свежие id) — не мутируйте.

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

/** Проверяет, содержит ли конфиг осмысленные данные. */
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

// ═══════════ Приветствия: вступление ═══════════
const presetsGreetingsJoin = [
  {
    key: 'classic',
    icon: 'fa-align-left',
    label: P.classic,
    description: P.classicDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'flat',
      blocks: [
        { id: uid(), type: 'text', content: '👋 Привет, {user}! Добро пожаловать на **{guild}**!\nТы наш **{count}-й** участник.' },
      ],
    }),
  },
  {
    key: 'welcome-card',
    icon: 'fa-id-card',
    label: P.welcomeCard,
    description: P.welcomeCardDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: 'Добро пожаловать!',
      subtitle: '{user}, мы рады тебя видеть 🎉',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        {
          id: uid(), type: 'sections', title: 'Что дальше?', listStyle: 'numeric',
          items: [
            'Прочитай правила в **#rules**',
            'Загляни в **#announcements**',
            'Задай вопрос в **#support**',
          ],
        },
        { id: uid(), type: 'footer', content: 'Ты — {count}-й участник {guild}' },
      ],
    }),
  },
  {
    key: 'server',
    icon: 'fa-server',
    label: P.serverCard,
    description: P.serverCardDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#16a34a',
      title: '{guild}',
      subtitle: 'Привет, {user}! Рады тебя видеть.',
      thumbnail: '{guildIconUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 2 },
        { id: uid(), type: 'text', content: '📊 Нас уже **{count}** — присоединяйся к общению!' },
        { id: uid(), type: 'footer', content: '{guild} · добро пожаловать' },
      ],
    }),
  },
  {
    key: 'minimal',
    icon: 'fa-minus',
    label: P.minimal,
    description: P.minimalDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'flat',
      blocks: [
        { id: uid(), type: 'text', content: '**{displayName}** присоединился к серверу ✨' },
      ],
    }),
  },
];

// ═══════════ Приветствия: выход ═══════════
const presetsGreetingsLeave = [
  {
    key: 'classic',
    icon: 'fa-align-left',
    label: P.classic,
    description: P.leaveClassicDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'flat',
      blocks: [
        { id: uid(), type: 'text', content: '😢 **{displayName}** покинул сервер. Будем скучать!' },
      ],
    }),
  },
  {
    key: 'farewell',
    icon: 'fa-hand',
    label: P.farewell,
    description: P.farewellDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#dc2626',
      title: 'До встречи, {displayName}',
      subtitle: 'Нас покинул {username}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: 'На сервере осталось **{count}** участников. Возвращайся скорее! 👋' },
      ],
    }),
  },
];

// ═══════════ Уровни: повышение ═══════════
const presetsLevelsLevelUp = [
  {
    key: 'classic',
    icon: 'fa-align-left',
    label: P.classic,
    description: P.levelClassicDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'flat',
      blocks: [
        { id: uid(), type: 'text', content: '🎉 Поздравляем, {user}!\nТы достиг **{level}** уровня!' },
      ],
    }),
  },
  {
    key: 'progress',
    icon: 'fa-chart-simple',
    label: P.progress,
    description: P.progressDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#f59e0b',
      title: 'Новый уровень: {level}',
      subtitle: 'Продолжай в том же духе, {displayName}!',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        {
          id: uid(), type: 'sections', title: 'Прогресс', listStyle: 'dot',
          items: [
            'Текущий XP: **{xp}**',
            'До следующего: **{xpToNext}**',
            'Прогресс: **{progressPercent}%**',
          ],
        },
        { id: uid(), type: 'footer', content: 'Ты на **{position}** месте в топе' },
      ],
    }),
  },
  {
    key: 'reward',
    icon: 'fa-award',
    label: P.reward,
    description: P.rewardDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#8b5cf6',
      title: '🏆 {level} уровень!',
      subtitle: '{user}, ты получил звание **{title}**',
      blocks: [
        { id: uid(), type: 'separator', spacing: 1 },
        { id: uid(), type: 'text', content: '🎁 Награда: {rewardRole}\nПродолжай общаться, чтобы получить ещё!' },
        { id: uid(), type: 'footer', content: 'Твоя позиция: **{position}**' },
      ],
    }),
  },
  {
    key: 'hero',
    icon: 'fa-id-card',
    label: P.hero,
    description: P.heroDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'embed-color',
      accentColor: '#5865F2',
      title: '⭐ Уровень {level}',
      subtitle: 'Так держать, {displayName}!',
      thumbnail: '{avatarUrl}',
      blocks: [
        { id: uid(), type: 'separator', spacing: 2 },
        {
          id: uid(), type: 'sections', title: 'Статистика', listStyle: 'numeric',
          items: [
            'Звание: **{title}**',
            'Всего XP: **{xp}**',
            'До следующего: **{xpToNext}** XP',
            'Место в топе: **#{position}**',
          ],
        },
        { id: uid(), type: 'footer', content: 'Продолжай общаться на {guild} 💪' },
      ],
    }),
  },
  {
    key: 'minimal',
    icon: 'fa-minus',
    label: P.minimal,
    description: P.levelMinimalDesc,
    build: () => ({
      ...baseConfig(),
      displayMode: 'flat',
      blocks: [
        { id: uid(), type: 'text', content: '⬆️ **{user}** — **{level}** уровень!' },
      ],
    }),
  },
];

export const MESSAGE_PRESETS = {
  'greetings.join': presetsGreetingsJoin,
  'greetings.leave': presetsGreetingsLeave,
  'levels.levelUp': presetsLevelsLevelUp,
};

export function getPresetsFor(presetKey) {
  return MESSAGE_PRESETS[presetKey] || [];
}