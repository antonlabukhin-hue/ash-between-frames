// Свет 32-битной эпохи: мягкие радиальные маски тьмы, цветные ореолы (сложение цветов),
// отражения огней в мокром камне, туман и виньетка. Всё печатается один раз в кэш
// по (размер, цвет), в кадре — только drawImage. Чистые помощники (цвета, капли дождя,
// мокрые участки) проверяются тестами.
import { hash2 } from '../core/math.js';
import { RS } from '../core/frame.js';

// Цвет света по смыслу: янтарь — прошлое и живой огонь, малиновый — Стирание,
// бирюза — магия браслета, холодный — луна и Шрам.
export const LIGHT_RGB = {
  amber: [255, 168, 70],
  fire: [255, 120, 40],
  cold: [110, 140, 215],
  moon: [150, 170, 230],
  crimson: [235, 48, 88],
  teal: [64, 220, 200],
  milk: [240, 230, 205],
};
export const lightRGB = (c) => (Array.isArray(c) ? c : LIGHT_RGB[c] || LIGHT_RGB.cold);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

const cache = new Map();
function remember(key, make) {
  let v = cache.get(key);
  if (!v) {
    v = make();
    cache.set(key, v);
    if (cache.size > 120) cache.delete(cache.keys().next().value);
  }
  return v;
}
export const glowCacheBytes = () => [...cache.values()].reduce((s, c) => s + c.width * c.height * 4, 0);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Маска для вырезания тьмы (destination-out): плотная середина, мягкий спад к краю.
export function softMask(r, strength = 1) {
  r = Math.max(2, Math.round(r));
  return remember(`m|${r}|${strength}`, () => {
    const c = canvas(r * 2, r * 2);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(r, r, 0, r, r, r);
    const s = strength;
    gr.addColorStop(0, `rgba(0,0,0,${s})`);
    gr.addColorStop(0.3, `rgba(0,0,0,${s * 0.9})`);
    gr.addColorStop(0.55, `rgba(0,0,0,${s * 0.55})`);
    gr.addColorStop(0.8, `rgba(0,0,0,${s * 0.18})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, r * 2, r * 2);
    return c;
  });
}

// Цветной ореол для режима 'lighter': яркое ядро и долгий хвост.
// squash < 1 — эллипс (свет, лежащий на земле в перспективе 3/4).
export function glow(r, c, a = 1, squash = 1) {
  r = Math.max(2, Math.round(r));
  const rgb = lightRGB(c);
  return remember(`g|${r}|${rgb}|${a}|${squash}`, () => {
    const h = Math.max(2, Math.round(r * 2 * squash));
    const cv = canvas(r * 2, h);
    const x = cv.getContext('2d');
    x.setTransform(1, 0, 0, squash, 0, 0);
    const gr = x.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, rgba(rgb, a));
    gr.addColorStop(0.15, rgba(rgb, a * 0.7));
    gr.addColorStop(0.4, rgba(rgb, a * 0.28));
    gr.addColorStop(0.7, rgba(rgb, a * 0.08));
    gr.addColorStop(1, rgba(rgb, 0));
    x.fillStyle = gr;
    x.fillRect(0, 0, r * 2, r * 2);
    return cv;
  });
}

// Отражение огня в мокрой мостовой: вертикальная полоса, разорванная рябью.
// Печатается в плотной сетке (w×h — в пикселях мира), выводится drawImage(…, w, h).
export function streak(w, h, c, a = 1, seed = 0) {
  w = Math.max(2, Math.round(w));
  h = Math.max(4, Math.round(h));
  const rgb = lightRGB(c);
  return remember(`s|${w}|${h}|${rgb}|${a}|${seed}`, () => {
    const pw = w * RS;
    const ph = h * RS;
    const cv = canvas(pw, ph);
    const x = cv.getContext('2d');
    for (let j = 0; j < ph; j++) {
      const t = j / ph;
      const ripple = 0.55 + 0.45 * Math.sin(j * 0.9 + seed) * Math.sin(j * 0.23 + seed * 2);
      const gap = hash2(j, seed, 17) < 0.18 ? 0.25 : 1;
      const k = Math.pow(1 - t, 1.4) * gap;
      const ww = Math.max(1, Math.round(pw * (0.35 + 0.65 * (1 - t)) * (0.6 + 0.4 * ripple)));
      const off = Math.round(Math.sin(j * 0.31 + seed) * RS * (0.5 + t));
      x.fillStyle = rgba(rgb, a * k * 0.55);
      x.fillRect(Math.round((pw - ww) / 2) + off, j, ww, 1);
      const core = Math.max(1, Math.round(ww * 0.35));
      x.fillStyle = rgba(rgb, a * k);
      x.fillRect(Math.round((pw - core) / 2) + off, j, core, 1);
    }
    return cv;
  });
}

// Виньетка: прозрачная середина, тёмные углы. Маленький холст, растягивается сглаженно.
export function vignette(w, h, a = 0.6) {
  const vw = Math.max(8, Math.round(w / 4));
  const vh = Math.max(8, Math.round(h / 4));
  return remember(`v|${vw}|${vh}|${a}`, () => {
    const cv = canvas(vw, vh);
    const x = cv.getContext('2d');
    const r = Math.hypot(vw, vh) / 2;
    x.setTransform(1, 0, 0, vh / vw, 0, 0);
    const gr = x.createRadialGradient(vw / 2, vw / 2, r * 0.35, vw / 2, vw / 2, r * 1.05);
    gr.addColorStop(0, 'rgba(2,3,10,0)');
    gr.addColorStop(0.6, `rgba(2,3,10,${a * 0.45})`);
    gr.addColorStop(1, `rgba(2,3,10,${a})`);
    x.fillStyle = gr;
    x.fillRect(0, 0, vw, vw);
    return cv;
  });
}

// Туман: бесшовная по горизонтали полоса мягких клубов (256×96 мира).
export const FOG_W = 256;
export const FOG_H = 96;
export function fogTexture(c, seed = 1) {
  const rgb = lightRGB(c);
  return remember(`f|${rgb}|${seed}`, () => {
    const cv = canvas(FOG_W, FOG_H);
    const x = cv.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const bx = hash2(i, seed, 1) * FOG_W;
      const by = FOG_H * (0.25 + hash2(i, seed, 2) * 0.5);
      const r = 18 + hash2(i, seed, 3) * 34;
      for (const dx of [-FOG_W, 0, FOG_W]) {
        const gr = x.createRadialGradient(bx + dx, by, 0, bx + dx, by, r);
        gr.addColorStop(0, rgba(rgb, 0.32));
        gr.addColorStop(0.6, rgba(rgb, 0.12));
        gr.addColorStop(1, rgba(rgb, 0));
        x.fillStyle = gr;
        x.fillRect(bx + dx - r, by - r, r * 2, r * 2);
      }
    }
    return cv;
  });
}

// ── чистые помощники ────────────────────────────────────────────────────

// Капля дождя i в момент t на экране w×h: начало отрезка, длина, наклон от ветра.
export function rainDrop(i, t, w, h, wind = 0.25) {
  const r1 = hash2(i, 1, 23);
  const r2 = hash2(i, 2, 23);
  const r3 = hash2(i, 3, 23);
  const speed = 300 + r1 * 160;
  const span = h + 40;
  const y = ((t * speed + r2 * span) % span) - 20;
  const wx = w + 40;
  const x = ((((r3 * wx + y * wind) % wx) + wx) % wx) - 20;
  const len = 5 + r1 * 7;
  return { x, y, len, dx: wind * len, near: r1 > 0.7 };
}

// Всплеск i: позиция в окне экрана и фаза 0..1 (каждые ~0,5 с — новое место).
export function splashAt(i, t, w, h) {
  const period = 0.45 + hash2(i, 9, 5) * 0.3;
  const n = Math.floor(t / period + hash2(i, 4, 5));
  const k = (t / period + hash2(i, 4, 5)) % 1;
  return { x: hash2(i, n, 6) * w, y: hash2(n, i, 7) * h, k };
}

// Мокрые участки видимой области: слитные отрезки тайлов по строкам [tx, ty, n].
export function wetRuns(isWet, x0, y0, x1, y1) {
  const out = [];
  for (let ty = y0; ty <= y1; ty++) {
    let start = -1;
    for (let tx = x0; tx <= x1 + 1; tx++) {
      const wet = tx <= x1 && isWet(tx, ty);
      if (wet && start < 0) start = tx;
      else if (!wet && start >= 0) {
        out.push([start, ty, tx - start]);
        start = -1;
      }
    }
  }
  return out;
}
