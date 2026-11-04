// tests/unit/validators.test.js
import { describe, it, expect } from 'vitest';
import {
  addBotBody,
  commandCreateBody,
  modActionCreateBody,
  membersListQuery,
} from '../../server/validators/schemas.js';

describe('validators', () => {
  describe('addBotBody', () => {
    it('токен < 20 символов — ошибка', () => {
      const r = addBotBody.safeParse({ token: 'short' });
      expect(r.success).toBe(false);
    });

    it('токен ≥ 20 символов — успех', () => {
      const r = addBotBody.safeParse({ token: 'a'.repeat(30) });
      expect(r.success).toBe(true);
    });
  });

  describe('commandCreateBody', () => {
    it('минимальные валидные поля', () => {
      const r = commandCreateBody.safeParse({
        botId: '12345678',
        guildId: '87654321',
        name: 'test',
      });
      expect(r.success).toBe(true);
    });

    it('name < 2 символов — ошибка', () => {
      const r = commandCreateBody.safeParse({
        botId: '12345678',
        guildId: '87654321',
        name: 'a',
      });
      expect(r.success).toBe(false);
    });

    it('name > 32 символов — ошибка', () => {
      const r = commandCreateBody.safeParse({
        botId: '12345678',
        guildId: '87654321',
        name: 'a'.repeat(40),
      });
      expect(r.success).toBe(false);
    });
  });

  describe('modActionCreateBody', () => {
    it('kind=warn — успех', () => {
      const r = modActionCreateBody.safeParse({
        botId: '12345678',
        guildId: '87654321',
        userId: '11111111',
        kind: 'warn',
      });
      expect(r.success).toBe(true);
    });

    it('kind=kick — ошибка (кик не в enum)', () => {
      const r = modActionCreateBody.safeParse({
        botId: '12345678',
        guildId: '87654321',
        userId: '11111111',
        kind: 'kick',
      });
      expect(r.success).toBe(false);
    });
  });

  describe('membersListQuery', () => {
    it('пустой roleId — успех', () => {
      const r = membersListQuery.safeParse({
        botId: '12345678',
        guildId: '87654321',
      });
      expect(r.success).toBe(true);
    });

    it('status не в enum — ошибка', () => {
      const r = membersListQuery.safeParse({
        botId: '12345678',
        guildId: '87654321',
        status: 'banned',
      });
      expect(r.success).toBe(false);
    });
  });
});