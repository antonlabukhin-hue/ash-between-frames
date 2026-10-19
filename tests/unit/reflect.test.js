import { describe, it, expect } from 'vitest';
import { spawnRing, updateProjectiles } from '../../src/combat/projectiles.js';
import { PAST } from '../../src/timeline/timeline.js';

describe('отражённый звон', () => {
  it('сжимается и догоняет хозяина, даже если тот отошёл', () => {
    let hit = 0;
    const owner = { x: 100, y: 100, hitY: 8, dead: false, onReflect: () => hit++ };
    const g = { projectiles: [], player: null, particles: null, fx: [], texts: [] };
    const pr = spawnRing(g, owner, 100, 96, { speed: 70, max: 120 });
    pr.rad = 80;
    pr.tl.phase = PAST; // герой отправил волну назад
    owner.x = 200; // а босс отошёл
    for (let i = 0; i < 120 && !hit; i++) updateProjectiles(g, 1 / 60);
    expect(hit).toBe(1);
  });
});
