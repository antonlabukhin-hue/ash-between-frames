// Инструменты HD-маляров (32-битные кадры). Форма рисуется векторно в плотной сетке —
// многоугольники, эллипсы, градиенты объёма, — а затем «пикселизуется» (crispen):
// альфа без полутонов (чёткий край пиксель-арта) и 15-битный цвет с упорядоченным
// дизерингом, как у консолей 32-битной эпохи. Получается пиксель-арт с мягкой светотенью.

export function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function oval(ctx, cx, cy, rx, ry, fill, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function path(ctx, pts, color, width = 0.5, cap = 'round') {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function rect(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

// Линейный градиент по стопам [[t, цвет], …].
export function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

export function rad(ctx, cx, cy, r0, r1, stops) {
  const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  for (const [t, c] of stops) g.addColorStop(t, c);
  return g;
}

// Рисовать только поверх уже нарисованного (тени и блики внутри силуэта).
export function inside(ctx, fn) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  fn();
  ctx.restore();
}

// ── пикселизация ─────────────────────────────────────────────────────────
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Альфа: порог (полутона края → 0 или 255). Цвет: 5 бит на канал с дизерингом Байера 4×4.
// keepSoft — альфа ниже порога, но выше soft, сохраняется (дымка, свечение), иначе обрезается.
export function crispenData(d, w, h, { cut = 110, bits = 5, soft = 0 } = {}) {
  const step = 256 >> bits;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const a = d[o + 3];
      if (a < cut) {
        if (!soft || a < soft) {
          d[o + 3] = 0;
          continue;
        }
      } else d[o + 3] = 255;
      const b = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * step;
      for (let c = 0; c < 3; c++) {
        const v = d[o + c] + b;
        d[o + c] = Math.max(0, Math.min(255, Math.round(v / step) * step));
      }
    }
  }
  return d;
}

export function crispen(ctx, w, h, opts) {
  const img = ctx.getImageData(0, 0, w, h);
  crispenData(img.data, w, h, opts);
  ctx.putImageData(img, 0, 0);
}
