// tests/unit/formulas.test.js
import { describe, it, expect } from 'vitest';
import {
  xpForLevel,
  getLevelFromXp,
  progressOf,
} from '../../server/core/formulas.js';

describe('formulas', () => {
  describe('classic', () => {
    it('XP(0) = 0', () => {
      expect(xpForLevel(0, 'classic')).toBe(0);
    });

    it('XP(1) = 155', () => {
      // 5*1 + 50*1 + 100 = 155
      expect(xpForLevel(1, 'classic')).toBe(155);
    });

    it('XP(10) = 1100', () => {
      // 5*100 + 50*10 + 100 = 1100
      expect(xpForLevel(10, 'classic')).toBe(1100);
    });

    it('XP(50) = 15000', () => {
      // 5*2500 + 50*50 + 100 = 15000
      expect(xpForLevel(50, 'classic')).toBe(15000);
    });

    it('roundtrip: getLevelFromXp(xpForLevel(N)) === N', () => {
      for (const n of [0, 1, 5, 10, 50, 100]) {
        const xp = xpForLevel(n, 'classic');
        expect(getLevelFromXp(xp, 'classic')).toBe(n);
      }
    });

    it('getLevelFromXp(maxLevel + 1000) не превышает maxLevel', () => {
      const xp = xpForLevel(1000, 'classic');
      expect(getLevelFromXp(xp, 'classic', {}, 100)).toBe(100);
    });
  });

  describe('linear', () => {
    it('XP(1) = 100 (base=100)', () => {
      expect(xpForLevel(1, 'linear', { linearBase: 100 })).toBe(100);
    });

    it('XP(10) = 1000 (base=100)', () => {
      expect(xpForLevel(10, 'linear', { linearBase: 100 })).toBe(1000);
    });

    it('XP(10) = 500 (base=50)', () => {
      expect(xpForLevel(10, 'linear', { linearBase: 50 })).toBe(500);
    });
  });

  describe('progressOf', () => {
    it('процент в [0, 100]', () => {
      const p = progressOf(600, 10, 'classic');
      expect(p.percent).toBeGreaterThanOrEqual(0);
      expect(p.percent).toBeLessThanOrEqual(100);
    });

    it('current + toNext === total', () => {
      const p = progressOf(600, 10, 'classic');
      expect(p.current + p.toNext).toBe(p.total);
    });

    it('на границе уровня current = 0, percent = 0', () => {
      const xp = xpForLevel(10, 'classic');
      const p = progressOf(xp, 10, 'classic');
      expect(p.current).toBe(0);
      expect(p.percent).toBe(0);
    });
  });
});