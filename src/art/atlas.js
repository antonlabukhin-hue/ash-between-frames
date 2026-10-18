// Атлас спрайтов: каждый кадр рисуется кодом один раз и дальше выводится одним drawImage.
// Страницы 1024·rs, укладка полками с отступом 1 px. См. docs/SPRITE_PIPELINE.md.
//
// 32-битная сетка (rs = 2): размеры и точка привязки кадра — в логических пикселях мира,
// а сам кадр хранится в rs раз плотнее.
//   • Обычный (16-битный) маляр рисует в логических пикселях; кадр удваивается Scale2x.
//   • HD-маляр (opts.hd) рисует сразу в плотной сетке: контекст уже умножен на rs,
//     координаты с шагом 1/rs — это и есть детали 32-битного кадра.
// Контур (selout) — 1 пиксель плотной сетки, после удвоения.
import { createShelfPacker, packRect } from './packer.js';
import { scale2xWords, nearestWords } from './upscale.js';
import { RS } from '../core/frame.js';
import { crispen } from './hd.js';

const PAGE = 1024;

export function createAtlas({ pageSize = PAGE, maxPages = 2, makeCanvas, rs = 1 } = {}) {
  const mk = makeCanvas || ((w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  });
  const size = pageSize * rs;
  const a = { rs, pages: [], map: new Map(), stats: { baked: 0, hits: 0, resets: 0 } };

  function newPage() {
    const canvas = mk(size, size);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const page = { canvas, ctx, packer: createShelfPacker(size, size, 1) };
    a.pages.push(page);
    return page;
  }

  function alloc(w, h) {
    for (const page of a.pages) {
      const r = packRect(page.packer, w, h);
      if (r) return { page, r };
    }
    if (a.pages.length < maxPages) {
      const page = newPage();
      const r = packRect(page.packer, w, h);
      if (r) return { page, r };
    }
    // переполнение: начинаем заново (комната прогреет свои кадры)
    a.reset();
    const page = newPage();
    return { page, r: packRect(page.packer, w, h) };
  }

  a.reset = () => {
    a.pages = [];
    a.map.clear();
    a.stats.resets++;
  };

  // key — уникальная строка кадра; (ax, ay) — точка привязки внутри клетки (обычно ноги).
  a.sprite = (key, w, h, ax, ay, draw, opts = {}) => {
    const hit = a.map.get(key);
    if (hit) {
      a.stats.hits++;
      return hit;
    }
    const pad = opts.outline ? 1 : 0;
    const cw = w + pad * 2;
    const ch = h + pad * 2;
    const pw = cw * rs;
    const ph = ch * rs;
    const { page, r } = alloc(pw, ph);
    // рисуем на отдельном CPU-холсте: чтение пикселей для контура не тормозит GPU-страницу
    const sc = scratch(pw, ph);
    sc.save();
    sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
    if (opts.hd || rs === 1) {
      sc.scale(rs, rs);
      sc.translate(pad, pad);
      draw(sc, ax, ay);
      sc.restore();
      // HD-кадр: чёткий край и 15-битный цвет (src/art/hd.js)
      if (opts.crisp) crispen(sc, pw, ph, opts.crisp === true ? undefined : opts.crisp);
    } else {
      sc.translate(pad, pad);
      draw(sc, ax, ay);
      sc.restore();
      upscaleInPlace(sc, cw, ch, rs);
    }
    if (opts.outline) outlineRect(sc, 0, 0, pw, ph, opts.outline);
    if (opts.tint) tintRect(sc, 0, 0, pw, ph, opts.tint);
    page.ctx.clearRect(r.x, r.y, pw, ph);
    page.ctx.drawImage(sc.canvas, 0, 0, pw, ph, r.x, r.y, pw, ph);
    const e = { key, page: page.canvas, sx: r.x, sy: r.y, pw, ph, w: cw, h: ch, ax: ax + pad, ay: ay + pad };
    a.map.set(key, e);
    a.stats.baked++;
    return e;
  };

  // Силуэт уже запечённого кадра одним цветом (двойной контур, вспышка).
  a.tinted = (key, base, color) => {
    const k = `${key}#${color}`;
    const hit = a.map.get(k);
    if (hit) return hit;
    const { page, r } = alloc(base.pw, base.ph);
    // source-in стирает всё вне прямоугольника — тонируем только на рабочем холсте
    const sc = scratch(base.pw, base.ph);
    sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
    sc.drawImage(base.page, base.sx, base.sy, base.pw, base.ph, 0, 0, base.pw, base.ph);
    tintRect(sc, 0, 0, base.pw, base.ph, color);
    page.ctx.clearRect(r.x, r.y, base.pw, base.ph);
    page.ctx.drawImage(sc.canvas, 0, 0, base.pw, base.ph, r.x, r.y, base.pw, base.ph);
    const e = { ...base, key: k, page: page.canvas, sx: r.x, sy: r.y };
    a.map.set(k, e);
    return e;
  };

  a.memory = () => a.pages.length * size * size * 4;
  a.count = () => a.map.size;
  return a;
}

// Вывод кадра: точка привязки встаёт в (x, y); позиция округляется до пикселя плотной сетки.
let snap = RS;
export const setSnap = (rs) => (snap = rs);
export function blit(ctx, e, x, y) {
  const dx = Math.round(x * snap) / snap - e.ax;
  const dy = Math.round(y * snap) / snap - e.ay;
  ctx.drawImage(e.page, e.sx, e.sy, e.pw ?? e.w, e.ph ?? e.h, dx, dy, e.w, e.h);
}

let scratchCtx = null;
function scratch(w, h) {
  if (!scratchCtx || scratchCtx.canvas.width < w || scratchCtx.canvas.height < h) {
    const c = document.createElement('canvas');
    c.width = Math.max(w, scratchCtx?.canvas.width || 0, 256);
    c.height = Math.max(h, scratchCtx?.canvas.height || 0, 256);
    scratchCtx = c.getContext('2d', { willReadFrequently: true });
    scratchCtx.imageSmoothingEnabled = false;
  }
  return scratchCtx;
}

// Логический кадр cw×ch в левом верхнем углу → плотный (cw·rs)×(ch·rs) на том же месте.
function upscaleInPlace(ctx, cw, ch, rs) {
  const src = ctx.getImageData(0, 0, cw, ch);
  const out = ctx.createImageData(cw * rs, ch * rs);
  const s32 = new Uint32Array(src.data.buffer);
  const d32 = new Uint32Array(out.data.buffer);
  if (rs === 2) scale2xWords(s32, cw, ch, d32);
  else nearestWords(s32, cw, ch, d32, rs);
  ctx.putImageData(out, 0, 0);
}

function tintRect(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Тёмный контур 1 px по маске альфы (selout).
function outlineRect(ctx, x, y, w, h, color) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const solid = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 40;
  const out = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (solid(i, j)) continue;
      if (solid(i - 1, j) || solid(i + 1, j) || solid(i, j - 1) || solid(i, j + 1)) out.push(i, j);
    }
  }
  const [r, g, b] = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
  for (let k = 0; k < out.length; k += 2) {
    const o = (out[k + 1] * w + out[k]) * 4;
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
    d[o + 3] = 230;
  }
  ctx.putImageData(img, x, y);
}
