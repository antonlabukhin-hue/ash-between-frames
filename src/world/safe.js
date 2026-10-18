// Куда вернуть героя после падения. Чистая логика: ok(x, y) — можно ли там стоять.
// Ищем по расширяющимся кольцам вокруг точки — ближайшее надёжное место.
export function findNearest(ok, x, y, { step = 8, max = 240 } = {}) {
  if (ok(x, y)) return { x, y };
  for (let r = step; r <= max; r += step) {
    const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const px = Math.round(x + Math.cos(a) * r);
      const py = Math.round(y + Math.sin(a) * r);
      if (ok(px, py)) return { x: px, y: py };
    }
  }
  return null;
}
