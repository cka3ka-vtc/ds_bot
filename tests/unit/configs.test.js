// tests/unit/configs.test.js
//
// Проверяем что merge*Config корректно нормализует «мусорный» вход
// и не теряет валидные поля. Регрессия: если схема поменяется —
// старые настройки не должны ломаться (не падать, не терять значения).

import { describe, it, expect } from 'vitest';
import { mergeModerationConfig } from '../../shared/moderation-config.js';
import { mergeLevelsConfig } from '../../shared/levels-config.js';
import { mergeGreetingsConfig } from '../../shared/greetings-config.js';
import { mergeBirthdaysConfig } from '../../shared/birthdays-config.js';

describe('mergeModerationConfig', () => {
  it('пустой вход → конфиг по умолчанию', () => {
    const c = mergeModerationConfig(null);
    expect(c.enabled).toBe(false);
    expect(c.filters).toBeDefined();
    expect(Object.keys(c.filters).length).toBe(10);
  });

  it('невалидный action заменяется на warn', () => {
    const c = mergeModerationConfig({
      filters: { spam: { enabled: true, action: 'kick', durationMin: 10 } },
    });
    expect(c.filters.spam.action).toBe('warn');
  });

  it('невалидный kind в escalation заменяется', () => {
    const c = mergeModerationConfig({
      filters: {
        caps: {
          escalation: { enabled: true, rows: [{ action: 'bogus', durationMin: 5 }] },
        },
      },
    });
    expect(c.filters.caps.escalation.rows[0].action).toBe('warn');
  });

  it('сохраняет валидные значения', () => {
    const c = mergeModerationConfig({
      enabled: true,
      filters: { profanity: { enabled: true, action: 'mute', durationMin: 20 } },
    });
    expect(c.enabled).toBe(true);
    expect(c.filters.profanity.enabled).toBe(true);
    expect(c.filters.profanity.action).toBe('mute');
    expect(c.filters.profanity.durationMin).toBe(20);
  });
});

describe('mergeLevelsConfig', () => {
  it('пустой вход → дефолты', () => {
    const c = mergeLevelsConfig(null);
    expect(c.formula).toBe('classic');
    expect(c.maxLevel).toBe(100);
    expect(c.dailyEnabled).toBe(true);
    expect(c.events.message.xp).toBe(15);
  });

  it('dailyEnabled=false сохраняется', () => {
    const c = mergeLevelsConfig({ dailyEnabled: false });
    expect(c.dailyEnabled).toBe(false);
  });

  it('dailyXp < 1 → дефолт 150', () => {
    const c = mergeLevelsConfig({ dailyXp: 0 });
    expect(c.dailyXp).toBe(150);
  });

  it('legacy cooldownSec конвертируется в cooldownMin', () => {
    const c = mergeLevelsConfig({
      events: { message: { xp: 20, cooldownSec: 120 } },
    });
    expect(c.events.message.cooldownMin).toBe(2);
    expect(c.events.message.xp).toBe(20);
  });
});

describe('mergeGreetingsConfig', () => {
  it('пустой вход → join включён, leave выключен', () => {
    const c = mergeGreetingsConfig(null);
    expect(c.events.join).toBe(true);
    expect(c.events.leave).toBe(false);
  });

  it('legacy message → blocks[0].content', () => {
    const c = mergeGreetingsConfig({ message: 'Welcome {user}!' });
    expect(c.messages.join.blocks).toHaveLength(1);
    expect(c.messages.join.blocks[0].content).toBe('Welcome {user}!');
  });
});

describe('mergeBirthdaysConfig', () => {
  it('пустой вход → пустые поля', () => {
    const c = mergeBirthdaysConfig(null);
    expect(c.announceChannelId).toBe('');
    expect(c.birthdayRoleId).toBe('');
    expect(c.sendTime).toBe('09:00');
    expect(c.deleteOldAnnouncements).toBe(true);
  });

  it('sendTime невалидный формат → дефолт', () => {
    const c = mergeBirthdaysConfig({ sendTime: '25:99' });
    expect(c.sendTime).toBe('09:00');
  });

  it('sendTime валидный сохраняется', () => {
    const c = mergeBirthdaysConfig({ sendTime: '18:30' });
    expect(c.sendTime).toBe('18:30');
  });

  it('requiredRoles фильтрует невалидные элементы', () => {
    const c = mergeBirthdaysConfig({
      requiredRoles: ['123', null, 456, '', '789'],
    });
    expect(c.requiredRoles).toEqual(['123', '789']);
  });
});