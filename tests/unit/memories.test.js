import { describe, it, expect } from 'vitest';
import { addMemory, hasMemory, spendMemory, wasSpent, memoryList, createScene, stepScene, MEMORIES } from '../../src/story/memories.js';
import { parseSave, defaultSave } from '../../src/save/save.js';

describe('Воспоминания', () => {
  it('добавляются один раз, неизвестные — нет', () => {
    const s = defaultSave();
    expect(addMemory(s, 'fair')).toBe(true);
    expect(addMemory(s, 'fair')).toBe(false);
    expect(addMemory(s, 'нет-такого')).toBe(false);
    expect(hasMemory(s, 'fair')).toBe(true);
    expect(memoryList(s).map((m) => m.name)).toEqual([MEMORIES.fair.name]);
  });
  it('отданное исчезает и не возвращается', () => {
    const s = defaultSave();
    addMemory(s, 'campfire');
    expect(spendMemory(s, 'campfire')).toBe(true);
    expect(hasMemory(s, 'campfire')).toBe(false);
    expect(wasSpent(s, 'campfire')).toBe(true);
    expect(addMemory(s, 'campfire')).toBe(false);
    expect(spendMemory(s, 'campfire')).toBe(false);
  });
  it('переживают сохранение и старые сохранения без поля', () => {
    const s = defaultSave();
    addMemory(s, 'lanternFeast');
    expect(parseSave(JSON.stringify(s)).memories).toEqual(['lanternFeast']);
    expect(parseSave(JSON.stringify({ started: true })).memories).toEqual([]);
  });
});

describe('Сцена прошлого', () => {
  const lines = [{ who: 'А', text: '1', dur: 1 }, { who: 'Б', text: '2', dur: 1 }];
  it('досмотренная до конца — done', () => {
    const sc = createScene(lines);
    expect(stepScene(sc, true, 0)).toBe('line');
    expect(stepScene(sc, true, 1.01)).toBe('line');
    expect(sc.i).toBe(1);
    expect(stepScene(sc, true, 1.01)).toBe('done');
    expect(stepScene(sc, true, 1)).toBe(null);
  });
  it('прерванная начинается заново', () => {
    const sc = createScene(lines);
    stepScene(sc, true, 0);
    stepScene(sc, true, 1.01);
    expect(stepScene(sc, false, 0.1)).toBe('reset');
    expect(sc.i).toBe(-1);
    expect(stepScene(sc, false, 0.1)).toBe(null);
    expect(stepScene(sc, true, 0)).toBe('line');
    expect(sc.i).toBe(0);
  });
});
