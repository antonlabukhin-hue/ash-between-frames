// Раскладка подписей без наложений (аудит: «overlay-элементы складываются в одной точке»).
// Подписи важнее ставятся первыми; следующая, если пересекается с уже поставленной или с
// запретной зоной (герой, HUD, подсказка), пробует сдвинуться выше, ниже, ещё выше; не нашлось
// места — прячется. Модуль чистый: прямоугольники в пикселях экрана.

const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// items: [{ id, x0, y0, x1, y1, priority }]; blockers: [{ x0, y0, x1, y1 }]; bounds — экран.
// Возвращает Map id → { dy, hidden }.
export function resolveLabels(items, blockers = [], bounds = null, gap = 2) {
  const placed = [];
  const out = new Map();
  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  for (const it of sorted) {
    const h = it.y1 - it.y0 + gap;
    let done = false;
    for (const dy of [0, -h, h, -2 * h, 2 * h]) {
      const r = { x0: it.x0, x1: it.x1, y0: it.y0 + dy, y1: it.y1 + dy };
      if (bounds && (r.y0 < bounds.y0 || r.y1 > bounds.y1)) continue;
      if (placed.some((p) => hit(p, r)) || blockers.some((b) => hit(b, r))) continue;
      placed.push(r);
      out.set(it.id, { dy, hidden: false });
      done = true;
      break;
    }
    if (!done) out.set(it.id, { dy: 0, hidden: true });
  }
  return out;
}
