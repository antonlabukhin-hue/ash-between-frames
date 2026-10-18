// «Острова памяти»: в свете зажжённого фонаря и вокруг ожившей статуи сквозь Шрам
// проступает Отпечаток комнаты. Остров раскрывается и гаснет плавно. Чистая логика.

// sources: [{id, x, y, rx, ry, on}] — источники и их целевой размер.
export function updateIslands(state, sources, dt, speed = 2.6) {
  const seen = new Set();
  for (const s of sources) {
    seen.add(s.id);
    let isl = state.get(s.id);
    if (!isl) {
      isl = { id: s.id, x: s.x, y: s.y, rx: s.rx, ry: s.ry, k: 0 };
      state.set(s.id, isl);
    }
    isl.x = s.x;
    isl.y = s.y;
    isl.rx = s.rx;
    isl.ry = s.ry;
    const target = s.on ? 1 : 0;
    isl.k = target > isl.k ? Math.min(target, isl.k + dt * speed) : Math.max(target, isl.k - dt * speed);
  }
  for (const id of [...state.keys()]) if (!seen.has(id)) state.delete(id);
  return [...state.values()].filter((i) => i.k > 0);
}

// Плавное раскрытие: быстрый старт, мягкий конец.
export const islandScale = (k) => 1 - (1 - k) * (1 - k);

export function inIslands(list, x, y) {
  for (const i of list) {
    const s = islandScale(i.k);
    const dx = (x - i.x) / (i.rx * s);
    const dy = (y - i.y) / (i.ry * s);
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

// Ступенчатый эллипс построчно (шаг 2 px) — для обрезки и маски.
export function islandRows(isl, step = 2) {
  const s = islandScale(isl.k);
  const rx = isl.rx * s;
  const ry = isl.ry * s;
  const rows = [];
  for (let y = -ry; y <= ry; y += step) {
    const yy = Math.round(y);
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))) / 2) * 2;
    if (w > 0) rows.push([Math.round(isl.x - w), Math.round(isl.y + yy), w * 2, step]);
  }
  return rows;
}
