import { describe, it, expect } from 'vitest';
import { parseManifest, heroOverrideKey, enemyOverrideKey } from '../../src/art/overrides.js';

describe('Ручные PNG-спрайты', () => {
  it('манифест разбирается, битые кадры отбрасываются', () => {
    const m = parseManifest({
      version: 1,
      sheets: [
        { image: 'a.png', outline: true, frames: { 'hero/down/walk0': [0, 0, 44, 44, 22, 38], bad: [0, 0, 0, 10, 0, 0], worse: ['x'] } },
        { frames: { lost: [0, 0, 4, 4, 2, 2] } },
      ],
    });
    expect([...m.keys()]).toEqual(['hero/down/walk0']);
    expect(m.get('hero/down/walk0')).toMatchObject({ image: 'a.png', w: 44, ax: 22, outline: true });
    expect(parseManifest(null).size).toBe(0);
    expect(parseManifest({ sheets: 'нет' }).size).toBe(0);
  });
  it('смысловые ключи кадров', () => {
    expect(heroOverrideKey({ dir: 'side' }, { swing: -1, walk: 3 })).toBe('hero/side/walk3');
    expect(heroOverrideKey({ dir: 'up', swingStep: 2 }, { swing: 4, walk: 0 })).toBe('hero/up/swing2_4');
    expect(enemyOverrideKey('hollow', 'past', 'windup')).toBe('hollow/past/windup');
  });
});
