// Атлас спрайтов: каждый кадр рисуется кодом один раз и дальше выводится одним drawImage.
// Страницы 1024×1024, укладка полками с отступом 1 px. См. docs/SPRITE_PIPELINE.md.
import { createShelfPacker, packRect } from './packer.js';

const PAGE = 1024;

export function createAtlas({ pageSize = PAGE, maxPages = 2, makeCanvas } = {}) {
  const mk = makeCanvas || ((w, h) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  });
  const a = { pages: [], map: new Map(), stats: { baked: 0, hits: 0, resets: 0 } };

  function newPage() {
    const canvas = mk(pageSize, pageSize);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const page = { canvas, ctx, packer: createShelfPacker(pageSize, pageSize, 1) };
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
    const { page, r } = alloc(cw, ch);
    // рисуем на отдельном CPU-холсте: чтение пикселей для контура не тормозит GPU-страницу
    const sc = scratch(cw, ch);
    sc.save();
    sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
    sc.translate(pad, pad);
    draw(sc, ax, ay);
    sc.restore();
    if (opts.outline) outlineRect(sc, 0, 0, cw, ch, opts.outline);
    if (opts.tint) tintRect(sc, 0, 0, cw, ch, opts.tint);
    page.ctx.clearRect(r.x, r.y, cw, ch);
    page.ctx.drawImage(sc.canvas, 0, 0, cw, ch, r.x, r.y, cw, ch);
    const e = { key, page: page.canvas, sx: r.x, sy: r.y, w: cw, h: ch, ax: ax + pad, ay: ay + pad };
    a.map.set(key, e);
    a.stats.baked++;
    return e;
  };

  // Силуэт уже запечённого кадра одним цветом (двойной контур, вспышка).
  a.tinted = (key, base, color) => {
    const k = `${key}#${color}`;
    const hit = a.map.get(k);
    if (hit) return hit;
    const { page, r } = alloc(base.w, base.h);
    // source-in стирает всё вне прямоугольника — тонируем только на рабочем холсте
    const sc = scratch(base.w, base.h);
    sc.clearRect(0, 0, sc.canvas.width, sc.canvas.height);
    sc.drawImage(base.page, base.sx, base.sy, base.w, base.h, 0, 0, base.w, base.h);
    tintRect(sc, 0, 0, base.w, base.h, color);
    page.ctx.clearRect(r.x, r.y, base.w, base.h);
    page.ctx.drawImage(sc.canvas, 0, 0, base.w, base.h, r.x, r.y, base.w, base.h);
    const e = { key: k, page: page.canvas, sx: r.x, sy: r.y, w: base.w, h: base.h, ax: base.ax, ay: base.ay };
    a.map.set(k, e);
    return e;
  };

  a.memory = () => a.pages.length * pageSize * pageSize * 4;
  a.count = () => a.map.size;
  return a;
}

// Вывод кадра: точка привязки встаёт в (x, y), координаты округляются до пикселя.
export function blit(ctx, e, x, y) {
  ctx.drawImage(e.page, e.sx, e.sy, e.w, e.h, Math.round(x) - e.ax, Math.round(y) - e.ay, e.w, e.h);
}

let scratchCtx = null;
function scratch(w, h) {
  if (!scratchCtx || scratchCtx.canvas.width < w || scratchCtx.canvas.height < h) {
    const c = document.createElement('canvas');
    c.width = Math.max(w, scratchCtx?.canvas.width || 0, 128);
    c.height = Math.max(h, scratchCtx?.canvas.height || 0, 128);
    scratchCtx = c.getContext('2d', { willReadFrequently: true });
    scratchCtx.imageSmoothingEnabled = false;
  }
  return scratchCtx;
}

function tintRect(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Тёмный контур 1 px по маске альфы (selout 16-bit спрайтов).
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
