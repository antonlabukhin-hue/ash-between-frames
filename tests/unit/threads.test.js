import { describe, it, expect } from 'vitest';
import { createTimeline, PAST, PRESENT } from '../../src/timeline/timeline.js';
import { link, resolveThreads, threadList, chainOf } from '../../src/timeline/threads.js';

const prop = (id) => ({ id, tl: createTimeline({ hold: 6, cost: 1 }) });

describe('нити причин', () => {
  it('следствие идёт за причиной и само не сдвигается', () => {
    const fire = prop(1);
    const kettle = link(fire, prop(2));
    expect(kettle.tl.switchable).toBe(false);
    expect(resolveThreads([fire, kettle])).toEqual([]);
    fire.tl.phase = PAST;
    expect(resolveThreads([fire, kettle])).toEqual([kettle]);
    expect(kettle.tl.phase).toBe(PAST);
    expect(kettle.tl.left).toBe(Infinity);
    fire.tl.phase = PRESENT;
    resolveThreads([fire, kettle]);
    expect(kettle.tl.phase).toBe(PRESENT);
  });
  it('цепочка из трёх звеньев срабатывает за один вызов, порядок объектов не важен', () => {
    const [a, b, c] = [prop(1), prop(2), prop(3)];
    link(a, b);
    link(b, c);
    a.tl.phase = PAST;
    const changed = resolveThreads([c, b, a]);
    expect(changed).toHaveLength(2);
    expect(c.tl.phase).toBe(PAST);
  });
  it('нить может тянуть из настоящего', () => {
    const a = prop(1);
    const b = link(a, prop(2), { when: PRESENT });
    resolveThreads([a, b]);
    expect(b.tl.phase).toBe(PAST);
  });
  it('список нитей и цепочка объекта', () => {
    const [a, b, c, d] = [prop(1), prop(2), prop(3), prop(4)];
    link(a, b);
    link(b, c);
    link(d, prop(5));
    const all = [a, b, c, d];
    expect(threadList(all).length).toBe(2);
    expect(chainOf(all, c).map((t) => t.to.id)).toEqual([2, 3]);
  });
});

describe('нить с условием', () => {
  it('котёл тянет заслонку, только если горит костёр', () => {
    const [fire, kettle, hatch] = [prop(1), prop(2), prop(3)];
    link(kettle, hatch, { need: [fire] });
    expect(kettle.tl.switchable).toBe(true);
    kettle.tl.phase = PAST;
    resolveThreads([fire, kettle, hatch]);
    expect(hatch.tl.phase).toBe(PRESENT);
    fire.tl.phase = PAST;
    resolveThreads([fire, kettle, hatch]);
    expect(hatch.tl.phase).toBe(PAST);
    const ts = threadList([fire, kettle, hatch]);
    expect(ts).toHaveLength(2);
    expect(ts.find((t) => t.need)).toMatchObject({ from: fire, to: kettle, on: true });
  });
});
