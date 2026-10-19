import { describe, it, expect } from 'vitest';
import { resolveLabels } from '../../src/ui/layout.js';

const r = (id, x, y, priority, w = 40, h = 10) => ({ id, x0: x, y0: y, x1: x + w, y1: y + h, priority });

describe('раскладка подписей', () => {
  it('без пересечений — на месте', () => {
    const m = resolveLabels([r('a', 0, 0, 1), r('b', 100, 0, 1)]);
    expect(m.get('a')).toEqual({ dy: 0, hidden: false });
    expect(m.get('b')).toEqual({ dy: 0, hidden: false });
  });
  it('важная остаётся на месте, второстепенная уходит выше', () => {
    const m = resolveLabels([r('low', 10, 50, 1), r('high', 0, 50, 3)]);
    expect(m.get('high').dy).toBe(0);
    expect(m.get('low').dy).toBeLessThan(0);
  });
  it('на героя и HUD не налезает', () => {
    const m = resolveLabels([r('a', 0, 50, 1)], [{ x0: 0, y0: 45, x1: 50, y1: 70 }]);
    expect(m.get('a').dy).not.toBe(0);
  });
  it('места нет — второстепенная прячется', () => {
    const items = [r('a', 0, 20, 3), r('b', 0, 20, 2), r('c', 0, 20, 1)];
    const m = resolveLabels(items, [], { y0: 10, y1: 45 });
    expect(m.get('a').hidden).toBe(false);
    expect(m.get('c').hidden).toBe(true);
  });
});
