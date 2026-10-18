import { describe, it, expect } from 'vitest';
import { frameSize } from '../../src/core/frame.js';
import { createShelfPacker, packRect, packerFill } from '../../src/art/packer.js';
import { createParticlePool, spawnParticle, updateParticles, resizePool } from '../../src/world/particles.js';
import { PROFILES, detectProfile, resolveProfile, createAutoTuner, tuneStep } from '../../src/core/quality.js';

describe('Подбор кадра: только целый масштаб', () => {
  const cases = [
    [1920, 1080], [2532, 1170], [2340, 1080], [1334, 750], [1152, 648], [2560, 1440], [844, 390],
  ];
  it.each(cases)('%i×%i', (w, h) => {
    const f = frameSize(w, h);
    expect(Number.isInteger(f.scale)).toBe(true);
    expect(f.h).toBeGreaterThanOrEqual(180);
    expect(f.h).toBeLessThanOrEqual(248);
    expect(f.w).toBeGreaterThanOrEqual(320);
    expect(f.w).toBeLessThanOrEqual(448);
    expect(f.w * f.scale).toBeLessThanOrEqual(Math.max(w, 320 * f.scale));
    expect(f.h * f.scale).toBeLessThanOrEqual(h);
    expect(f.w % 2).toBe(0);
  });
  it('1080p даёт ×5 при высоте 216', () => {
    expect(frameSize(1920, 1080)).toMatchObject({ scale: 5, h: 216 });
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
