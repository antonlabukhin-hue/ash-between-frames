import { describe, it, expect } from 'vitest';
import { updateIslands, inIslands, islandRows, auraSources, auraDamageMul, carryPos, dropPos } from '../../src/world/memory.js';
import { inFissure } from '../../src/art/square16.js';

describe('Острова памяти', () => {
  it('раскрываются и гаснут плавно, исчезают без источника', () => {
    const st = new Map();
    let list = updateIslands(st, [{ id: 1, x: 100, y: 100, rx: 80, ry: 60, on: true }], 0.1);
    expect(list[0].k).toBeGreaterThan(0);
    expect(list[0].k).toBeLessThan(1);
    for (let i = 0; i < 10; i++) list = updateIslands(st, [{ id: 1, x: 100, y: 100, rx: 80, ry: 60, on: true }], 0.1);
    expect(list[0].k).toBe(1);
    expect(inIslands(list, 170, 100)).toBe(true);
    expect(inIslands(list, 100, 170)).toBe(false);
    for (let i = 0; i < 10; i++) list = updateIslands(st, [{ id: 1, x: 100, y: 100, rx: 80, ry: 60, on: false }], 0.1);
    expect(list.length).toBe(0);
    updateIslands(st, [], 0.1);
    expect(st.size).toBe(0);
  });
  it('ступенчатые строки покрывают эллипс', () => {
    const rows = islandRows({ x: 0, y: 0, rx: 20, ry: 10, k: 1 });
    expect(rows.length).toBeGreaterThan(8);
    expect(Math.max(...rows.map((r) => r[2]))).toBeLessThanOrEqual(40);
  });
});

describe('Провал площади', () => {
  it('поперёк площади перед аркой, не у стен', () => {
    expect(inFissure(240, 128)).toBe(true);
    expect(inFissure(240, 170)).toBe(false);
    expect(inFissure(20, 128)).toBe(false);
  });
});

describe('ореолы объектов', () => {
  const prop = (phase, aura, extra = {}) => ({ id: 1, x: 100, y: 50, tl: { phase }, def: { aura, auraY: 4 }, ...extra });
  it('объект в прошлом даёт включённый источник, в Шраме — гаснущий того же размера', () => {
    const a = { past: [60, 40], present: 0 };
    expect(auraSources([prop('past', a)])).toEqual([{ id: 1, x: 100, y: 46, rx: 60, ry: 40, on: true, rim: true }]);
    expect(auraSources([prop('present', a)])[0]).toMatchObject({ rx: 60, on: false });
  });
  it('скрытые и объекты без ореола не светят', () => {
    expect(auraSources([prop('past', { past: [60, 40] }, { hidden: true }), { id: 2, tl: { phase: 'past' }, def: {} }])).toEqual([]);
  });
  it('в острове Шрам получает больше урона, Отпечаток — меньше', () => {
    expect(auraDamageMul('present')).toBeGreaterThan(1);
    expect(auraDamageMul('past')).toBeLessThan(1);
  });
  it('фонарь держат и ставят со стороны взгляда', () => {
    expect(carryPos(10, 10, false).x).toBeGreaterThan(10);
    expect(dropPos(10, 10, true).x).toBeLessThan(10);
  });
});
