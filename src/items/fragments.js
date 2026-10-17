// Временные фрагменты: действуют одну вылазку, теряются при смерти или возвращении.
import { P } from '../art/palette.js';

export const FRAGMENTS = {
  backHeat: { name: 'Обратный жар', desc: 'Смена состояния поджигает врага.', color: P.amber },
  firstStep: { name: 'Первый шаг', desc: 'После уклонения следующий удар — критический.', color: P.teal },
  quietFrame: { name: 'Тихий кадр', desc: 'Раз в 20 секунд снаряды рядом с тобой замирают на секунду.', color: P.milk },
  bellShard: { name: 'Трещина колокола', desc: 'Осколок старого звона. Им можно расколоть то, что не должно звучать.', color: P.brassHi },
};

export const hasFragment = (save, id) => save.fragments.includes(id);

export function addFragment(save, id) {
  if (!FRAGMENTS[id] || save.fragments.includes(id)) return false;
  save.fragments.push(id);
  return true;
}

// Сюжетные фрагменты не сгорают при смерти.
export const KEEP_ON_DEATH = new Set(['bellShard']);

export function loseFragments(save) {
  save.fragments = save.fragments.filter((id) => KEEP_ON_DEATH.has(id));
}
