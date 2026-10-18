// Попиксельный «маляр» для запекания комнат: всё рисуется в один ImageData и
// кладётся на холст комнаты одним putImageData. Быстро при загрузке, ноль затрат в кадре.

const rgbCache = new Map();
export function rgb(c) {
  let v = rgbCache.get(c);
  if (!v) {
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    rgbCache.set(c, v);
  }
  return v;
}

export function createPainter(w, h) {
  const img = new ImageData(w, h);
  const d = img.data;
  const p = { w, h, img };
  p.set = (x, y, c, a = 255) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const [r, g, b] = rgb(c);
    const o = (y * w + x) * 4;
    if (a >= 255) {
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    } else {
      const k = a / 255;
      d[o] = d[o] * (1 - k) + r * k;
      d[o + 1] = d[o + 1] * (1 - k) + g * k;
      d[o + 2] = d[o + 2] * (1 - k) + b * k;
      d[o + 3] = Math.max(d[o + 3], a);
    }
  };
  // сделать пиксель прозрачным (дыры пустоты, небо)
  p.clear = (x, y) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    d[(y * w + x) * 4 + 3] = 0;
  };
  p.rect = (x, y, rw, rh, c, a) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) p.set(x + i, y + j, c, a);
  };
  // затемнение уже нарисованного (тени от стен): k — доля оставшейся яркости
  p.shade = (x, y, k) => {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const o = (y * w + x) * 4;
    d[o] *= k;
    d[o + 1] *= k;
    d[o + 2] *= k * 1.04;
  };
  p.alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[((y | 0) * w + (x | 0)) * 4 + 3]);
  p.line = (x0, y0, x1, y1, c) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) p.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  };
  return p;
}
