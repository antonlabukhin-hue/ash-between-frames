// Узлы памяти (docs/TIME_DESIGN.md, П6). Обычный сдвиг всегда временный; навсегда прошлое
// остаётся только в Узлах — каменных кругах с янтарными рунами под особыми объектами. Цена —
// воспоминание: отданное исчезает из дневника и из мира. Модуль чистый: состояние — в save.fixed.
import { MEMORIES, hasMemory, spendMemory } from './memories.js';

// accepts — какие воспоминания принимает Узел (null — любое); loss — что уйдёт из мира.
export const NODES = {
  bridge: {
    name: 'Мост тракта',
    gain: 'Мост будет цел навсегда — без заряда и без спешки.',
    accepts: null,
  },
  campfire: {
    name: 'Костёр привала',
    gain: 'Костёр будет гореть всегда. Арно и Сена останутся оба — но перестанут узнавать друг друга.',
    accepts: ['campfire'],
  },
  oven: {
    name: 'Печь Мары',
    gain: 'Хлеб Мары будет тёплым всегда: каждая новая комната немного лечит.',
    accepts: ['lanternFeast'],
  },
};

// Что именно исчезнет из мира вместе с воспоминанием.
export const LOSS = {
  fair: 'Торговцы на тракте больше не появятся в прошлом.',
  nameScrap: 'Записка Сены сотрётся — Сена не узнает брата по почерку.',
  campfire: 'Вечер у костра забудется: Арно и Сена не вспомнят, кем были друг другу.',
  lanternFeast: 'Праздник фонарей больше не проиграется. Латунный Мальчик и Мара не узнают себя на нём.',
};

export const isNode = (id) => !!NODES[id];
export const isFixed = (save, id) => !!save.fixed?.[id];
export const fixedWith = (save, id) => save.fixed?.[id]?.memory ?? null;

// Чем можно заплатить в Узле: воспоминания героя, которые Узел принимает.
export function nodePrices(save, id) {
  const n = NODES[id];
  if (!n || isFixed(save, id)) return [];
  return (save.memories || []).filter((m) => MEMORIES[m] && (!n.accepts || n.accepts.includes(m)));
}

// Закрепить: отдать воспоминание. false — нельзя (не Узел, уже закреплён, нет такого воспоминания
// или Узел его не принимает).
export function fixNode(save, id, memory) {
  if (!nodePrices(save, id).includes(memory) || !hasMemory(save, memory)) return false;
  spendMemory(save, memory);
  (save.fixed ||= {})[id] = { memory };
  return true;
}
