import { describe, it, expect } from 'vitest';
import { findNearest } from '../../src/world/safe.js';

describe('точка возврата после падения', () => {
  it('если стоять можно — та же точка', () => {
    expect(findNearest(() => true, 10, 20)).toEqual({ x: 10, y: 20 });
  });
  it('ищет ближайшую твёрдую землю', () => {
    const ok = (x) => x <= 100; // берег слева, справа провал
    const r = findNearest(ok, 140, 50);
    expect(r.x).toBeLessThanOrEqual(100);
    expect(Math.hypot(r.x - 140, r.y - 50)).toBeLessThanOrEqual(48);
  });
  it('нет земли в радиусе — null', () => {
    expect(findNearest(() => false, 0, 0, { max: 32 })).toBeNull();
  });
});
