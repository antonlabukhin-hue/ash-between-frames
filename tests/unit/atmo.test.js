import { describe, it, expect } from 'vitest';
import { rainDrop, splashAt, wetRuns, lightRGB, LIGHT_RGB } from '../../src/art/glow.js';
import { PROFILES } from '../../src/core/quality.js';

describe('Атмосфера 32-бит: чистые помощники', () => {
  it('капли дождя остаются в окне экрана с запасом и падают вниз', () => {
    for (let i = 0; i < 200; i++) {
      const a = rainDrop(i, 1.0, 480, 270);
      expect(a.x).toBeGreaterThanOrEqual(-20);
      expect(a.x).toBeLessThan(480 + 20);
      expect(a.y).toBeGreaterThanOrEqual(-20);
      expect(a.y).toBeLessThan(270 + 20);
      expect(a.len).toBeGreaterThan(4);
    }
    // за малый шаг времени капля сдвигается вниз (если не перескочила через край)
    const a = rainDrop(3, 1.0, 480, 270);
    const b = rainDrop(3, 1.01, 480, 270);
    if (b.y > a.y) expect(b.y - a.y).toBeLessThan(10);
  });
  it('всплески — в пределах экрана, фаза 0..1', () => {
    for (let i = 0; i < 50; i++) {
      const s = splashAt(i, 7.3, 400, 200);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(400);
      expect(s.k).toBeGreaterThanOrEqual(0);
      expect(s.k).toBeLessThan(1);
    }
  });
  it('мокрые участки сливаются в отрезки по строкам', () => {
    const wet = (x, y) => (y === 1 ? x >= 2 && x <= 5 : x === 0);
    expect(wetRuns(wet, 0, 0, 6, 1)).toEqual([[0, 0, 1], [2, 1, 4]]);
    expect(wetRuns(() => false, 0, 0, 3, 3)).toEqual([]);
  });
  it('цвет света: имя, массив и запасной холодный', () => {
    expect(lightRGB('amber')).toBe(LIGHT_RGB.amber);
    expect(lightRGB([1, 2, 3])).toEqual([1, 2, 3]);
    expect(lightRGB('нет такого')).toBe(LIGHT_RGB.cold);
  });
  it('профили: Low без отражений и ореолов, High — с отражением персонажей', () => {
    expect(PROFILES.low.reflect).toBe(0);
    expect(PROFILES.low.bloom).toBe(false);
    expect(PROFILES.high.reflect).toBe(2);
    expect(PROFILES.high.rain).toBeGreaterThan(PROFILES.medium.rain);
  });
});
