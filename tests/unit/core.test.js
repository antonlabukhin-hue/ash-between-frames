import { describe, it, expect } from 'vitest';
import { createTimeline, shiftTimeline, tickTimeline, isShifted, PAST, PRESENT, shiftCost, channelTime, setPhase, isFading, createChannel, tickChannel } from '../../src/timeline/timeline.js';
import { createCharges, spend, tickCharges, hasten, gain, canSpend } from '../../src/timeline/charges.js';
import { createCombo, pressAttack, tickCombo, COMBO, inPerfectWindow } from '../../src/combat/combo.js';
import { heroHitDamage, applyHeroDamage } from '../../src/combat/damage.js';
import { parseSave, defaultSave, serializeSave, freshSave } from '../../src/save/save.js';
import { parseRoom, moveBox, tileAt, lineOfSight } from '../../src/world/room.js';
import { T } from '../../src/art/tiles.js';

const run = (fn, c, seconds, dt = 1 / 60) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) {
    const r = fn(c, dt);
    if (r) out.push(r);
  }
  return out;
};

describe('Двойной отпечаток', () => {
  it('сдвиг временный и возвращается к базе', () => {
    const tl = createTimeline({ base: PRESENT, hold: 2 });
    expect(shiftTimeline(tl)).toBe(PAST);
    expect(isShifted(tl)).toBe(true);
    const ev = run(tickTimeline, tl, 2.1);
    expect(ev).toEqual(['reverted']);
    expect(tl.phase).toBe(PRESENT);
  });
  it('повторный сдвиг возвращает досрочно и бесплатно', () => {
    const tl = createTimeline({ hold: 5, cost: 1 });
    shiftTimeline(tl);
    expect(shiftCost(tl)).toBe(0);
    shiftTimeline(tl);
    expect(tl.phase).toBe(PRESENT);
    expect(shiftCost(tl)).toBe(1);
    expect(shiftCost(tl, { free: true })).toBe(0);
  });
  it('переключатель с hold=Infinity не возвращается', () => {
    const tl = createTimeline({ hold: Infinity });
    shiftTimeline(tl);
    run(tickTimeline, tl, 30, 0.5);
    expect(tl.phase).toBe(PAST);
    expect(isFading(tl)).toBe(false);
  });
  it('время импульса не меньше 0.3 и мгновенно для отмены', () => {
    const tl = createTimeline({ switchTime: 0.7 });
    expect(channelTime(tl)).toBeCloseTo(0.7);
    expect(channelTime(tl, { speed: 0.2 })).toBeCloseTo(0.3);
    expect(channelTime(tl, { instant: true })).toBe(0);
    shiftTimeline(tl);
    expect(channelTime(tl)).toBe(0);
  });
  it('setPhase ставит фазу и мигает', () => {
    const tl = createTimeline({ base: PAST });
    expect(setPhase(tl, PRESENT, 3)).toBe(true);
    expect(tl.left).toBe(3);
    expect(setPhase(tl, PRESENT)).toBe(false);
  });
  it('канал завершается за своё время', () => {
    const ch = createChannel({}, 0.5);
    expect(run(tickChannel, ch, 0.52)).toContain('done');
  });
});

describe('Заряды браслета', () => {
  it('тратятся и восстанавливаются', () => {
    const c = createCharges(3, 10);
    expect(spend(c, 2)).toBe(true);
    expect(spend(c, 2)).toBe(false);
    expect(canSpend(c, 1)).toBe(true);
    tickCharges(c, 9.9);
    expect(c.n).toBe(1);
    tickCharges(c, 0.2);
    expect(c.n).toBe(2);
    expect(hasten(c, 10)).toBe(true);
    expect(c.n).toBe(3);
    gain(c, 5);
    expect(c.n).toBe(3);
  });
});

describe('Ритм ударов', () => {
  it('нажатие в окне — точный удар, вне окна — обычный', () => {
    const c = createCombo();
    const first = pressAttack(c);
    expect(first).toMatchObject({ step: 1, perfect: false });
    run(tickCombo, c, (COMBO.windowStart + COMBO.windowEnd) / 2);
    expect(inPerfectWindow(c)).toBe(true);
    const second = pressAttack(c);
    expect(second).toMatchObject({ step: 2, perfect: true });
  });
  it('три точных подряд открывают разлом, вторая точность — эффект школы', () => {
    const c = createCombo();
    pressAttack(c);
    const hits = [];
    for (let i = 0; i < 3; i++) {
      run(tickCombo, c, 0.36);
      hits.push(pressAttack(c));
    }
    expect(hits.map((h) => h.effect)).toEqual([null, 'school', 'rift']);
    expect(hits[1].step).toBe(3);
  });
  it('удар во время взмаха запоминается и выходит сам', () => {
    const c = createCombo();
    pressAttack(c);
    run(tickCombo, c, 0.05);
    expect(pressAttack(c)).toBeNull();
    const ev = run(tickCombo, c, 0.3);
    expect(ev[0]).toMatchObject({ step: 2, perfect: false });
  });
  it('после паузы серия начинается сначала', () => {
    const c = createCombo();
    pressAttack(c);
    run(tickCombo, c, 1.2);
    expect(pressAttack(c)).toMatchObject({ step: 1, perfect: false });
  });
});

describe('Урон', () => {
  it('базовый 12, точный 18, щит режет', () => {
    expect(heroHitDamage({ perfect: false, step: 1 })).toBe(12);
    expect(heroHitDamage({ perfect: true, step: 2 })).toBe(18);
    expect(heroHitDamage({ perfect: true, step: 2 }, { comboMul: 1.5 })).toBe(27);
    expect(heroHitDamage({ perfect: false, step: 1 }, { shield: 0.85 })).toBe(2);
  });
  it('неуязвимость гасит урон', () => {
    const hero = { hp: 100, invuln: 0 };
    expect(applyHeroDamage(hero, 10, { iframes: 0.5 })).toBe(10);
    expect(applyHeroDamage(hero, 10)).toBe(0);
    expect(hero.hp).toBe(90);
  });
});

describe('Сохранение', () => {
  it('битая строка даёт сохранение по умолчанию', () => {
    expect(parseSave('{oops')).toEqual(defaultSave());
    expect(parseSave('[1,2]')).toEqual(defaultSave());
  });
  it('поля проверяются по типу и дополняются', () => {
    const s = parseSave(JSON.stringify({ ash: 12.7, room: 5, flags: { a: 1 }, settings: { music: 0.1 } }));
    expect(s.ash).toBe(12);
    expect(s.room).toBe('road');
    expect(s.flags).toEqual({ a: 1 });
    expect(s.settings.music).toBe(0.1);
    expect(s.settings.sfx).toBe(0.8);
  });
  it('круговой путь и новая игра сохраняет настройки', () => {
    const s = defaultSave();
    s.started = true;
    s.settings.music = 0.3;
    const back = parseSave(serializeSave(s));
    expect(back).toEqual(s);
    const f = freshSave(back);
    expect(f.started).toBe(false);
    expect(f.settings.music).toBe(0.3);
  });
});

describe('Комната', () => {
  const room = parseRoom({ id: 't', map: ['#####', '#.@ #', '#...#', '#####'] });
  it('тайлы и маркеры', () => {
    expect(room.w).toBe(5);
    expect(tileAt(room, 3, 1)).toBe(T.VOID);
    expect(tileAt(room, 2, 1)).toBe(T.FLOOR);
    expect(room.markers['@'][0]).toMatchObject({ tx: 2, ty: 1, x: 40, y: 24 });
    expect(tileAt(room, -1, 0)).toBe(T.WALL);
  });
  it('скольжение вдоль стены', () => {
    const blocked = (x, y) => tileAt(room, Math.floor(x / 16), Math.floor(y / 16)) === T.WALL;
    const r = moveBox(24, 36, 4, 3, -20, 5, blocked);
    expect(r.hitX).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(20);
    expect(r.y).toBeCloseTo(41);
  });
  it('видимость через стены', () => {
    expect(lineOfSight(room, 24, 40, 56, 40)).toBe(true);
    expect(lineOfSight(room, 24, 40, 24, 80)).toBe(false);
  });
});
