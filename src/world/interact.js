// Поиск объекта для взаимодействия и подписи подсказок. Чистая логика.
export const INTERACT_RANGE = 36; // было 26 — при естественном подходе к указателю E не срабатывала
export const NEAR_RANGE = 64; // ближе этого, но вне радиуса — «Подойди ближе»

// items: [{ obj, x, y, range?, reach? }] — точки взаимодействия.
// Возвращает { target, near }: target — в радиусе, near — рядом, но ещё вне радиуса.
export function findInteractable(items, px, py) {
  let target = null;
  let near = null;
  let bt = Infinity;
  let bn = Infinity;
  for (const it of items) {
    const d = Math.hypot(px - it.x, py - it.y) - (it.reach ?? 0);
    const range = it.range ?? INTERACT_RANGE;
    if (d < range && d < bt) {
      bt = d;
      target = it.obj;
    } else if (d < NEAR_RANGE && d < bn) {
      bn = d;
      near = it.obj;
    }
  }
  return { target, near: target ? null : near };
}

// Подпись цели сдвига: «в прошлое: Пустокожий», «в настоящее: Фонарь».
export function shiftLabel(name, nextPhase) {
  return `${nextPhase === 'past' ? 'в прошлое' : 'в настоящее'}: ${name}`;
}
