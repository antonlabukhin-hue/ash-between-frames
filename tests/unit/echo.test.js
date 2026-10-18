import { describe, it, expect } from 'vitest';
import { createRecorder, recordFrame, recordEvent, recordFull, createShade, stepShade, poseAt, hitShade, ECHO_TIME, ECHO_LINGER, ECHO_HP } from '../../src/player/echo.js';

const walk = (rec, secs, fn) => {
  for (let i = 0; i < Math.round(secs * 10); i++) recordFrame(rec, 0.1, fn(rec.t + 0.1));
};

describe('Эхо', () => {
  it('запись длится не дольше ECHO_TIME', () => {
    const rec = createRecorder(0, 0);
    walk(rec, 8, (t) => ({ x: t * 10, y: 0 }));
    expect(recordFull(rec)).toBe(true);
    expect(rec.t).toBe(ECHO_TIME);
    expect(recordFrame(rec, 0.1, { x: 0, y: 0 })).toBe(false);
  });
  it('тень проходит путь, повторяет события по времени и замирает в конце', () => {
    const rec = createRecorder(0, 0);
    walk(rec, 2, (t) => ({ x: t * 10, y: 0 }));
    recordEvent(rec, { type: 'attack', aim: 1 });
    walk(rec, 1, (t) => ({ x: t * 10, y: 0 }));
    const sh = createShade(rec);
    expect(stepShade(sh, 1)).toEqual([]);
    expect(sh.x).toBeCloseTo(10, 0);
    const ev = stepShade(sh, 1.2);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'attack', aim: 1 });
    stepShade(sh, 1);
    expect(sh.linger).toBe(true);
    expect(sh.x).toBeCloseTo(30, 0);
    stepShade(sh, ECHO_LINGER);
    expect(sh.done).toBe(true);
  });
  it('поза между кадрами — по прямой', () => {
    const rec = { frames: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 10, y: 20 }], start: { x: 0, y: 0 } };
    expect(poseAt(rec, 0.5)).toMatchObject({ x: 5, y: 10 });
  });
  it('тень рассыпается от ударов', () => {
    const sh = createShade(createRecorder(0, 0));
    for (let i = 1; i < ECHO_HP; i++) expect(hitShade(sh)).toBe(false);
    expect(hitShade(sh)).toBe(true);
    expect(stepShade(sh, 1)).toEqual([]);
  });
});
