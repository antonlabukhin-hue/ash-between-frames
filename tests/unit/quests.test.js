import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/save/save.js';
import { addMemory, spendMemory } from '../../src/story/memories.js';
import { questBoard } from '../../src/story/quests.js';

const board = (s) => Object.fromEntries(questBoard(s).map((q) => [q.id, q]));

describe('доска воспоминаний', () => {
  it('квест появляется, когда найден первый кусочек, и подсказывает следующий', () => {
    const s = defaultSave();
    expect(board(s).dog).toBeUndefined();
    addMemory(s, 'dogTag');
    const q = board(s).dog;
    expect(q.steps.map((x) => x.have)).toEqual([true, false, false]);
    expect(q.next.where).toMatch(/руины/i);
  });
  it('выполненный квест — с итогом и без подсказки', () => {
    const s = defaultSave();
    addMemory(s, 'dogTag');
    addMemory(s, 'dogBowl');
    s.flags.dogNamed = true;
    const q = board(s).dog;
    expect(q.done).toBe(true);
    expect(q.next).toBeNull();
    expect(q.result).toMatch(/Гром/);
  });
  it('итог привала зависит от выбора', () => {
    const s = defaultSave();
    s.flags.visited = { camp: true };
    s.flags.camp = 'fixed';
    expect(board(s).camp.result).toMatch(/чужими/);
  });
  it('«Последний звон» потерян, если «Праздник фонарей» отдан печи', () => {
    const s = defaultSave();
    addMemory(s, 'ringerSong');
    addMemory(s, 'lanternFeast');
    expect(board(s).song.lost).toBe(false);
    spendMemory(s, 'lanternFeast');
    expect(board(s).song.lost).toBe(true);
    expect(board(s).song.next).toBeNull();
  });
});
