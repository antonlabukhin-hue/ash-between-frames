import { describe, it, expect } from 'vitest';
import { frameSize, RS, LIMITS } from '../../src/core/frame.js';
import { createShelfPacker, packRect, packerFill } from '../../src/art/packer.js';
import { createParticlePool, spawnParticle, updateParticles, resizePool } from '../../src/world/particles.js';
import { PROFILES, detectProfile, resolveProfile, createAutoTuner, tuneStep } from '../../src/core/quality.js';

describe('Подбор кадра: 32-битная сетка', () => {
  const cases = [
    [1920, 1080], [2532, 1170], [2340, 1080], [1334, 750], [1152, 648], [2560, 1440], [844, 390], [1366, 768], [1280, 720], [3840, 2160],
  ];
  it.each(cases)('%i×%i', (w, h) => {
    const f = frameSize(w, h);
    expect(f.rs).toBe(RS);
    expect(f.h).toBeGreaterThanOrEqual(LIMITS.minH);
    expect(f.h).toBeLessThanOrEqual(LIMITS.maxH);
    expect(f.w).toBeGreaterThanOrEqual(LIMITS.minW);
    expect(f.w).toBeLessThanOrEqual(LIMITS.maxW);
    expect(f.w % 2).toBe(0);
    expect(f.h % 2).toBe(0);
    // кадр помещается на экран и почти не оставляет полей
    const cw = f.w * f.rs * f.scale;
    const ch = f.h * f.rs * f.scale;
    expect(cw).toBeLessThanOrEqual(w + 0.01);
    expect(ch).toBeLessThanOrEqual(h + 0.01);
    expect((cw * ch) / (w * h)).toBeGreaterThan(0.85);
    if (f.exact) expect(Number.isInteger(f.scale)).toBe(true);
  });
  it('1080p — целый ×2 при кадре 480×270', () => {
    expect(frameSize(1920, 1080)).toMatchObject({ scale: 2, w: 480, h: 270, exact: true });
  });
  it('телефон 844×390 @3 заполняется целым ×3', () => {
    expect(frameSize(2532, 1170)).toMatchObject({ scale: 3, w: 422, exact: true });
  });
  it('неудобный размер — дробный масштаб без полей', () => {
    const f = frameSize(1152, 648);
    expect(f.exact).toBe(false);
    expect(1152 - f.w * f.rs * f.scale).toBeLessThan(4);
  });
});

describe('Укладка атласа полками', () => {
  it('не пересекает прямоугольники и отказывает при переполнении', () => {
    const pk = createShelfPacker(64, 64, 1);
    const rs = [];
    for (let i = 0; i < 40; i++) {
      const r = packRect(pk, 8 + (i % 3) * 4, 10);
      if (r) rs.push(r);
    }
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i];
        const b = rs[j];
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    }
    expect(rs.length).toBeLessThan(40);
    expect(packRect(pk, 100, 10)).toBeNull();
    expect(packerFill(pk)).toBeGreaterThan(0.4);
  });
});

describe('Пул частиц', () => {
  it('не превышает ёмкость, удаляет отжившие без дыр', () => {
    const pool = createParticlePool(10);
    for (let i = 0; i < 15; i++) spawnParticle(pool, i, 0, 0, 0, i < 5 ? 0.1 : 1, '#fff');
    expect(pool.n).toBe(10);
    expect(pool.dropped).toBe(5);
    updateParticles(pool, 0.2);
    expect(pool.n).toBe(5);
    for (let i = 0; i < pool.n; i++) expect(pool.life[i]).toBeGreaterThan(0);
    const small = resizePool(pool, 3);
    expect(small.cap).toBe(3);
    expect(small.n).toBe(3);
  });
});

describe('Профили качества', () => {
  it('лимиты растут от Low к High, читаемость не зависит', () => {
    expect(PROFILES.low.particles).toBeLessThan(PROFILES.medium.particles);
    expect(PROFILES.medium.lights).toBeLessThan(PROFILES.high.lights);
    expect(PROFILES.low.parallax).toBe(1);
    expect(PROFILES.high.parallax).toBe(3);
  });
  it('авто: телефоны — Medium, слабые — Low, ПК — High', () => {
    expect(detectProfile({ cores: 8, touch: true })).toBe('medium');
    expect(detectProfile({ cores: 2 })).toBe('low');
    expect(detectProfile({ cores: 12, memory: 16 })).toBe('high');
    expect(resolveProfile('low', {}).id).toBe('low');
  });
  it('автопонижение после 3 секунд тяжёлых кадров', () => {
    const t = createAutoTuner({ limitMs: 14, holdS: 3 });
    let out = null;
    for (let i = 0; i < 200 && !out; i++) out = tuneStep(t, 'high', 20, 1 / 60);
    expect(out).toBe('medium');
    expect(tuneStep(t, 'medium', 20, 1 / 60)).toBeNull();
    const t2 = createAutoTuner();
    for (let i = 0; i < 400; i++) expect(tuneStep(t2, 'low', 30, 1 / 60)).toBeNull();
  });
});

describe('Scale2x', () => {
  it('скругляет диагональ и не вносит новых цветов', async () => {
    const { scale2xWords } = await import('../../src/art/upscale.js');
    // 3×3: диагональ из «1» на фоне «0»
    const src = new Uint32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const dst = new Uint32Array(36);
    scale2xWords(src, 3, 3, dst);
    expect(new Set(dst)).toEqual(new Set([0, 1]));
    // ровная заливка остаётся ровной
    const flat = scale2xWords(new Uint32Array(9).fill(7), 3, 3, new Uint32Array(36));
    expect(flat.every((v) => v === 7)).toBe(true);
    // ступенька диагонали заполняется с обеих сторон — линия становится сплошной
    expect(dst[2 * 6 + 1]).toBe(1);
    expect(dst[1 * 6 + 2]).toBe(1);
  });
});

describe('Пикселизация HD-кадров', () => {
  it('убирает полутона края и сводит цвет к 15 битам', async () => {
    const { crispenData } = await import('../../src/art/hd.js');
    const d = new Uint8ClampedArray([
      200, 100, 50, 255, // непрозрачный
      10, 20, 30, 60, // полупрозрачный край — исчезает
      13, 77, 141, 200, // почти непрозрачный — становится сплошным
      0, 0, 0, 0,
    ]);
    crispenData(d, 4, 1);
    expect(d[3]).toBe(255);
    expect(d[7]).toBe(0);
    expect(d[11]).toBe(255);
    for (const i of [0, 1, 2, 8, 9, 10]) expect(d[i] % 8).toBe(0);
  });
});
