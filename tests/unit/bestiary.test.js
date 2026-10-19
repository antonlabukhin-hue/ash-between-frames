import { describe, it, expect } from 'vitest';
import { BESTIARY, unseenKinds, shiftNote } from '../../src/combat/bestiary.js';
import { ENEMY_DEFS } from '../../src/enemies/enemies.js';

describe('бестиарий', () => {
  it('описаны все настоящие враги, имена совпадают', () => {
    for (const k of Object.keys(ENEMY_DEFS).filter((k) => k !== 'echo')) {
      expect(BESTIARY[k], k).toBeTruthy();
      expect(BESTIARY[k].name).toBe(ENEMY_DEFS[k].name);
    }
  });
  it('новые виды — по одному разу', () => {
    expect(unseenKinds(['hollow', 'hollow', 'framer', 'echo'], { framer: true })).toEqual(['hollow']);
  });
  it('строка при сдвиге зависит от фазы', () => {
    expect(shiftNote('framer', 'past')).toMatch(/бей/);
    expect(shiftNote('framer', 'present')).toMatch(/кадры/);
    expect(shiftNote('nobody', 'past')).toBe('');
  });
});
