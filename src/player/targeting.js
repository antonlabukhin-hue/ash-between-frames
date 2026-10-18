// Выбор цели для смены состояния (Q). Чистая логика: кандидаты → упорядоченный список.
// Правило из UX-аудита: враг в конусе прицела важнее объекта окружения рядом.
//  0 — объект, на котором герой стоит и который просит этого (знак арены);
//  1 — снаряд в конусе ±55° ближе 80 px (летящая опасность);
//  2 — враг в конусе ±35°;
//  3 — объект окружения в конусе ±55°;
//  4 — всё остальное в радиусе: ближе и ровнее по прицелу — раньше.
const DEG = Math.PI / 180;
export const CONE_ENEMY = 35 * DEG;
export const CONE_PROP = 55 * DEG;

export function tierOf(c) {
  if (c.pinned) return 0;
  if (c.type === 'projectile' && c.off <= CONE_PROP && c.d <= 80) return 1;
  if (c.type === 'enemy' && c.off <= CONE_ENEMY) return 2;
  if (c.type === 'prop' && c.off <= CONE_PROP) return 3;
  return 4;
}

// c: { obj, type, x, y, d, off, pinned? } — d и off уже посчитаны относительно героя и прицела.
export function rankTargets(cands) {
  return cands
    .map((c) => ({ ...c, tier: tierOf(c), score: c.d + c.off * 26 }))
    .sort((a, b) => a.tier - b.tier || a.score - b.score);
}

// Следующая цель после текущей — для переключения повторным Q.
export function nextTarget(list, current) {
  if (!list.length) return null;
  const i = list.findIndex((c) => c.obj === current);
  return list[(i + 1) % list.length];
}
