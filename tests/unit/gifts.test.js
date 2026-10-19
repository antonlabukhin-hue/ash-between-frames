import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/save/save.js';
import { giftsFrom, takeGift, bonusCharges, holdMul } from '../../src/items/gifts.js';

describe('дары спасённых', () => {
  it('дарит только тот, кто на Кухне', () => {
    const s = defaultSave();
    s.flags.camp = 'sena';
    expect(giftsFrom(s, 'Арно')).toEqual([]);
    expect(giftsFrom(s, 'Сена')).toEqual(['lens']);
    expect(takeGift(s, 'wick')).toBe(false);
  });
  it('дар берётся один раз и меняет правила', () => {
    const s = defaultSave();
    s.flags.camp = 'both';
    expect(takeGift(s, 'wick')).toBe(true);
    expect(takeGift(s, 'wick')).toBe(false);
    expect(bonusCharges(s)).toBe(1);
    expect(holdMul(s)).toBe(1);
    takeGift(s, 'lens');
    expect(holdMul(s)).toBe(1.25);
    expect(giftsFrom(s, 'Арно')).toEqual([]);
  });
  it('кузнец — только если жители спасены', () => {
    const s = defaultSave();
    s.flags.bellChoice = 'bell';
    expect(giftsFrom(s, 'Житель-кузнец')).toEqual([]);
    s.flags.bellChoice = 'lastRing';
    expect(giftsFrom(s, 'Житель-кузнец')).toEqual(['steel']);
  });
});
