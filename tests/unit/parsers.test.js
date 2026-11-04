// tests/unit/parsers.test.js
import { describe, it, expect } from 'vitest';
import { parsePatternsFile } from '../../shared/patterns-parser.js';

describe('patterns-parser', () => {
  it('пустой ввод → пустой массив', () => {
    expect(parsePatternsFile('')).toEqual([]);
    expect(parsePatternsFile(null)).toEqual([]);
  });

  it('простой mask + whitelist', () => {
    const rules = parsePatternsFile('f[u]+ck:tebya,hebu');
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('f[u]+ck');
    expect(rules[0].whitelist.length).toBeGreaterThanOrEqual(2);
  });

  it('комментарии и пустые строки игнорируются', () => {
    const rules = parsePatternsFile('# comment\n\nfuck:\n');
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe('fuck');
    expect(rules[0].whitelist).toEqual([]);
  });

  it('строки, начинающиеся с "-", игнорируются', () => {
    const rules = parsePatternsFile('- ignore\nfuck');
    expect(rules).toHaveLength(1);
  });

  it('не падает на битых регулярках', () => {
    const rules = parsePatternsFile('[broken(');
    expect(rules).toEqual([]);
  });

  it('несколько правил с whitelist', () => {
    const rules = parsePatternsFile('fuck:tebya\nshit:hebu\nbitch');
    expect(rules).toHaveLength(3);
    expect(rules[0].pattern).toBe('fuck');
    expect(rules[1].pattern).toBe('shit');
    expect(rules[2].pattern).toBe('bitch');
    expect(rules[2].whitelist).toEqual([]);
  });
});