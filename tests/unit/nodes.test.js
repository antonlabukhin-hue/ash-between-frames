import { describe, it, expect } from 'vitest';
import { defaultSave } from '../../src/save/save.js';
import { addMemory, hasMemory, wasSpent } from '../../src/story/memories.js';
import { nodePrices, fixNode, isFixed, fixedWith, NODES, LOSS } from '../../src/story/nodes.js';

describe('Узлы памяти', () => {
  it('закрепление стоит воспоминания, и оно больше не возвращается', () => {
    const s = defaultSave();
    addMemory(s, 'fair');
    expect(nodePrices(s, 'bridge')).toEqual(['fair']);
    expect(fixNode(s, 'bridge', 'fair')).toBe(true);
    expect(isFixed(s, 'bridge')).toBe(true);
    expect(fixedWith(s, 'bridge')).toBe('fair');
    expect(hasMemory(s, 'fair')).toBe(false);
    expect(wasSpent(s, 'fair')).toBe(true);
    expect(addMemory(s, 'fair')).toBe(false);
    expect(nodePrices(s, 'bridge')).toEqual([]);
  });
  it('Узел принимает только свои воспоминания', () => {
    const s = defaultSave();
    addMemory(s, 'fair');
    addMemory(s, 'lanternFeast');
    expect(nodePrices(s, 'oven')).toEqual(['lanternFeast']);
    expect(fixNode(s, 'oven', 'fair')).toBe(false);
    expect(fixNode(s, 'nope', 'fair')).toBe(false);
    expect(fixNode(s, 'bridge', 'campfire')).toBe(false);
  });
  it('у каждого воспоминания описана потеря', () => {
    for (const n of Object.values(NODES)) for (const m of n.accepts || []) expect(LOSS[m]).toBeTruthy();
  });
});
