// Ступенчатые пиксельные маски света: несколько колец с постоянной прозрачностью,
// без мягких градиентов. Маска печатается один раз на (радиус, число колец, цвет).
const cache = new Map();

export function lightMask(r, rings, color = '0,0,0', strength = 1) {
  r = Math.max(2, Math.round(r));
  const key = `${r}|${rings}|${color}|${strength}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const size = r * 2 + 1;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  // радиусы колец изнутри наружу и их сила
  const bands = [];
  for (let i = 0; i < rings; i++) {
    bands.push({ r: Math.round(r * ((i + 1) / rings)), a: strength * (1 - i / rings) });
  }
  for (let y = -r; y <= r; y++) {
    let inner = -1;
    for (const b of bands) {
      const w = b.r * b.r - y * y >= 0 ? Math.floor(Math.sqrt(b.r * b.r - y * y)) : -1;
      if (w < 0) continue;
      ctx.fillStyle = `rgba(${color},${b.a.toFixed(3)})`;
      if (inner < 0) ctx.fillRect(r - w, r + y, w * 2 + 1, 1);
      else {
        ctx.fillRect(r - w, r + y, w - inner, 1);
        ctx.fillRect(r + inner + 1, r + y, w - inner, 1);
      }
      inner = w;
    }
  }
  cache.set(key, c);
  if (cache.size > 48) cache.delete(cache.keys().next().value);
  return c;
}

export const lightCacheSize = () => cache.size;
export const lightCacheBytes = () => [...cache.values()].reduce((s, c) => s + c.width * c.height * 4, 0);
