// tests/unit/componentsBuilder.test.js
import { describe, it, expect } from 'vitest';
import {
  buildComponentsFromConfig,
  FLAG_COMPONENTS_V2,
} from '../../server/core/componentsBuilder.js';

describe('componentsBuilder', () => {
  it('FLAG_COMPONENTS_V2 = 32768', () => {
    expect(FLAG_COMPONENTS_V2).toBe(32768);
  });

  it('пустой конфиг → пустой массив', () => {
    const r = buildComponentsFromConfig({ displayMode: 'flat', blocks: [] }, {});
    expect(r).toEqual([]);
  });

  it('text-блок → V2 Text Display (type 10)', () => {
    const r = buildComponentsFromConfig(
      { displayMode: 'flat', blocks: [{ id: 'b1', type: 'text', content: 'hello' }] },
      {},
    );
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe(10);
    expect(r[0].content).toBe('hello');
  });

  it('резолвит {user} и {guild}', () => {
    const r = buildComponentsFromConfig(
      { displayMode: 'flat', blocks: [{ id: 'b1', type: 'text', content: 'hi {user} on {guild}' }] },
      { user: '@ivan', guild: 'MyServer' },
    );
    expect(r[0].content).toBe('hi @ivan on MyServer');
  });

  it('embed-color → контейнер type 17 с accent_color', () => {
    const r = buildComponentsFromConfig(
      {
        displayMode: 'embed-color',
        accentColor: '#5865F2',
        blocks: [{ id: 'b1', type: 'text', content: 'x' }],
      },
      {},
    );
    expect(r).toHaveLength(1);
    expect(r[0].type).toBe(17);
    expect(r[0].accent_color).toBe(0x5865F2);
  });

  it('не превышает 40 top-level компонентов', () => {
    const blocks = Array.from({ length: 100 }, (_, i) => ({
      id: `b${i}`, type: 'text', content: `msg ${i}`,
    }));
    const r = buildComponentsFromConfig({ displayMode: 'flat', blocks }, {});
    expect(r.length).toBeLessThanOrEqual(40);
  });

  it('кнопка с label > 80 — обрезается', () => {
    const cfg = {
      displayMode: 'flat',
      blocks: [{
        id: 'b1', type: 'buttons',
        buttons: [{ id: 'btn1', label: 'x'.repeat(200), url: 'https://a.com' }],
      }],
    };
    const r = buildComponentsFromConfig(cfg, {});
    const row = r.find((c) => c.type === 1);
    expect(row.components[0].label.length).toBeLessThanOrEqual(80);
  });

  it('кнопка с битым URL → fallback на discord.com', () => {
    const cfg = {
      displayMode: 'flat',
      blocks: [{
        id: 'b1', type: 'buttons',
        buttons: [{ id: 'btn1', label: 'Click', url: 'javascript:alert(1)' }],
      }],
    };
    const r = buildComponentsFromConfig(cfg, {});
    const row = r.find((c) => c.type === 1);
    expect(row.components[0].url).toBe('https://discord.com');
  });

  it('максимум 5 кнопок в ActionRow', () => {
    const cfg = {
      displayMode: 'flat',
      blocks: [{
        id: 'b1', type: 'buttons',
        buttons: Array.from({ length: 10 }, (_, i) => ({
          id: `btn${i}`, label: `Button ${i}`, url: 'https://a.com',
        })),
      }],
    };
    const r = buildComponentsFromConfig(cfg, {});
    const row = r.find((c) => c.type === 1);
    expect(row.components).toHaveLength(5);
  });
});