// Затухший тракт — эталонная комната 32-битного стиля (референс: мокрая дорога ночью,
// тёплый город прошлого слева, малиновое Стирание справа, башни ворот с колоколом).
//   • paintRoadHd — пол целиком в плотной сетке: мокрая брусчатка с бордюрами и лужами,
//     земля с опавшей листвой и травой, балюстрада над обрывом (сквозь неё видно небо),
//     провал Стирания с малиновыми трещинами по краю; восточнее провала — «стёртая» часть.
//   • drawRoadParallax — ночное небо, луна, готический город с огнями окон, колокольня.
//   • HD-маляры объектов: фонарь, знамя, осеннее дерево, мёртвое дерево, надгробие,
//     башня ворот; колокол на цепи и тёмный передний план — поверх сцены.
import { TILE, T } from './tiles.js';
import { tileAt } from '../world/room.js';
import { mulberry32, hash2 } from '../core/math.js';
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';
import { atlas } from './spritecache.js';
import { blit } from './atlas.js';
import { clipTiles, stone, leaf, tuft, LEAF } from './tiles32.js';

const GAP = { x0: 32, x1: 35 }; // колонки провала
const isRoad = (t) => t === T.ROAD;
const isGround = (t) => t === T.ASH || t === T.GRASS;


// ── пол ────────────────────────────────────────────────────────────────
export function paintRoadBase() {
  // всё рисуется в плотной сетке (paintHd); базовый холст прозрачный
}

export function paintRoadHd(ctx, room) {
  const rnd = mulberry32(room.seed || 7);
  const W = room.w * TILE;
  const H = room.h * TILE;
  const at = (x, y) => tileAt(room, Math.floor(x / TILE), Math.floor(y / TILE));
  const east = (x) => x >= (GAP.x1 + 1) * TILE; // стёртая часть
  ctx.save();

  // 1. земля: тёмная почва пятнами
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const t = tileAt(room, tx, ty);
      if (!isGround(t)) continue;
      const er = east(tx * TILE);
      rect(ctx, tx * TILE, ty * TILE, TILE, TILE, er ? '#131218' : '#16131a');
    }
  }
  ctx.save();
  clipTiles(ctx, room, isGround);
  for (let i = 0; i < room.w * room.h * 1.4; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const er = east(x);
    const c = er ? ['#1a1820', '#0f0e14', '#1d1622'][i % 3] : ['#1f1b22', '#110f15', '#231d1a', '#1b1f1c'][i % 4];
    oval(ctx, x, y, 2 + rnd() * 5, 1 + rnd() * 2.5, c);
  }
  // мох и трава
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      if (tileAt(room, tx, ty) !== T.GRASS) continue;
      const er = east(tx * TILE);
      for (let k = 0; k < 4; k++) tuft(ctx, tx * TILE + rnd() * 16, ty * TILE + 4 + rnd() * 13, rnd, er);
    }
  }
  // опавшая листва (в стёртой части — пепел вместо листьев)
  for (let i = 0; i < room.w * room.h * 2.2; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (!isGround(at(x, y))) continue;
    const er = east(x);
    if (er && rnd() < 0.7) {
      rect(ctx, x, y, 0.5 + rnd(), 0.5, rnd() < 0.2 ? '#86163a' : '#3a3b47');
      continue;
    }
    leaf(ctx, x, y, rnd() * Math.PI, LEAF[(rnd() * LEAF.length) | 0]);
  }
  ctx.restore();

  // 2. мокрая брусчатка
  ctx.save();
  clipTiles(ctx, room, isRoad);
  const ry0 = firstRow(room, isRoad);
  const ry1 = lastRow(room, isRoad);
  const top = ry0 * TILE;
  const bottom = (ry1 + 1) * TILE;
  rect(ctx, 0, top, W, bottom - top, '#0b0d14');
  const rowH = 5.4;
  let row = 0;
  for (let y = top + 3; y < bottom - 3; y += rowH, row++) {
    let x = -rnd() * 8;
    while (x < W) {
      const w = 5.5 + rnd() * 4;
      stone(ctx, x + 0.5, y + 0.4, w - 1, rowH - 1, rnd, east(x));
      x += w;
    }
  }
  // лужи: тёмные зеркала с холодным бликом по верхнему краю
  for (let i = 0; i < room.w * 0.7; i++) {
    const x = rnd() * W;
    const y = top + 6 + rnd() * (bottom - top - 12);
    if (!isRoad(at(x, y))) continue;
    const rx = 5 + rnd() * 12;
    const ry = 1.6 + rnd() * 2.2;
    oval(ctx, x, y, rx, ry, 'rgba(6,9,18,0.82)');
    oval(ctx, x, y + 0.3, rx * 0.86, ry * 0.7, 'rgba(18,26,48,0.6)');
    path(ctx, [x - rx * 0.6, y - ry * 0.55, x + rx * 0.3, y - ry * 0.8], 'rgba(150,170,220,0.35)', 0.4);
  }
  // трещины Стирания в стёртой части дороги
  for (let i = 0; i < 9; i++) {
    const x = (GAP.x1 + 1) * TILE + rnd() * (W - (GAP.x1 + 1) * TILE - 24);
    const y = top + 4 + rnd() * (bottom - top - 8);
    crack(ctx, x, y, rnd);
  }
  ctx.restore();
  // бордюры вдоль дороги
  curb(ctx, top - 1.5, W, rnd, east);
  curb(ctx, bottom - 1.5, W, rnd, east);

  // 3. балюстрада над обрывом (верхний ряд стен): сквозь просветы видно небо
  wallRows(ctx, room, rnd);

  // 4. провал Стирания
  gapVoid(ctx, room, rnd);
  ctx.restore();
}

function firstRow(room, pred) {
  for (let ty = 0; ty < room.h; ty++) for (let tx = 0; tx < room.w; tx++) if (pred(tileAt(room, tx, ty))) return ty;
  return 0;
}
function lastRow(room, pred) {
  for (let ty = room.h - 1; ty >= 0; ty--) for (let tx = 0; tx < room.w; tx++) if (pred(tileAt(room, tx, ty))) return ty;
  return 0;
}

function curb(ctx, y, W, rnd, east) {
  let x = 0;
  while (x < W) {
    const w = 10 + rnd() * 8;
    const er = east(x);
    ctx.beginPath();
    ctx.roundRect(x + 0.3, y, w - 0.6, 3, 0.8);
    ctx.fillStyle = lin(ctx, 0, y, 0, y + 3, [[0, er ? '#55566a' : '#6c7590'], [0.4, er ? '#3c3d4c' : '#454c63'], [1, '#1a1c26']]);
    ctx.fill();
    if (er && rnd() < 0.3) rect(ctx, x + w * 0.3, y, w * 0.3, 3, '#05060c');
    x += w;
  }
}

function crack(ctx, x, y, rnd) {
  const pts = [x, y];
  let cx = x;
  let cy = y;
  for (let i = 0; i < 5; i++) {
    cx += 3 + rnd() * 5;
    cy += (rnd() - 0.5) * 4;
    pts.push(cx, cy);
  }
  path(ctx, pts, '#05060c', 1.2);
  path(ctx, pts, '#c8284a', 0.5);
  path(ctx, pts.map((v, i) => (i % 2 ? v - 0.4 : v)), 'rgba(255,90,122,0.6)', 0.25);
}

// Верхний ряд стен — балюстрада: карниз, балясины, столбы; между балясинами — небо.
// Нижний ряд — тёмный парапет; боковые столбцы — каменная кладка.
function wallRows(ctx, room, rnd) {
  const W = room.w * TILE;
  // верх: всё прозрачно, кроме балюстрады
  const y0 = 0;
  for (let tx = 0; tx < room.w; tx++) {
    if (tileAt(room, tx, 0) !== T.WALL || (tx >= GAP.x0 && tx <= GAP.x1)) continue;
    const x = tx * TILE;
    // основание и тень на земле
    rect(ctx, x, y0 + 12.5, TILE, 3.5, lin(ctx, 0, 12.5, 0, 16, [[0, '#4d5570'], [0.3, '#30364a'], [1, '#12141c']]));
    // балясины-вазы
    for (let b = 1.5; b < TILE; b += 3.2) {
      poly(ctx, [x + b - 0.6, 5, x + b + 0.6, 5, x + b + 1, 8, x + b + 0.5, 10, x + b + 0.9, 12.5, x + b - 0.9, 12.5, x + b - 0.5, 10, x + b - 1, 8], lin(ctx, x + b - 1, 0, x + b + 1, 0, [[0, '#6c7590'], [0.5, '#3d4459'], [1, '#1d212d']]));
    }
    // перила
    rect(ctx, x, 3, TILE, 2.4, lin(ctx, 0, 3, 0, 5.4, [[0, '#7a84a2'], [0.4, '#4a5168'], [1, '#1f2330']]));
  }
  // столбы с вазонами каждые 3 тайла
  for (let tx = 1; tx < room.w - 1; tx += 3) {
    if (tx >= GAP.x0 - 1 && tx <= GAP.x1 + 1) continue;
    const x = tx * TILE;
    rect(ctx, x - 2.5, 0, 5, 16, lin(ctx, x - 2.5, 0, x + 2.5, 0, [[0, '#727c99'], [0.35, '#454c63'], [1, '#191c27']]));
    rect(ctx, x - 3.2, 0, 6.4, 1.6, '#8a93ae');
    rect(ctx, x - 3.2, 13, 6.4, 3, '#2a2f40');
  }
  // низ: парапет переднего плана
  const yb = (room.h - 1) * TILE;
  rect(ctx, 0, yb, W, TILE, lin(ctx, 0, yb, 0, yb + TILE, [[0, '#3a4058'], [0.15, '#262b3c'], [1, '#0a0b12']]));
  for (let x = 0; x < W; x += 9 + rnd() * 7) path(ctx, [x, yb + 0.6, x, yb + TILE], 'rgba(5,6,12,0.55)', 0.4);
  path(ctx, [0, yb + 0.4, W, yb + 0.4], '#5d6683', 0.6);
  // боковые стены
  for (const tx of [0, room.w - 1]) {
    for (let ty = 0; ty < room.h; ty++) {
      if (tileAt(room, tx, ty) !== T.WALL) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      rect(ctx, x, y, TILE, TILE, '#1a1d29');
      for (let j = 0; j < 4; j++) {
        const off = (j & 1) * 4;
        for (let i = -1; i < 2; i++) {
          ctx.beginPath();
          ctx.roundRect(x + i * 8 + off + 0.4, y + j * 4 + 0.4, 7.2, 3.2, 0.6);
          ctx.fillStyle = lin(ctx, 0, y + j * 4, 0, y + j * 4 + 4, [[0, '#4a5168'], [1, '#232736']]);
          ctx.fill();
        }
      }
    }
  }
}

// Провал: колонки GAP — прозрачные сверху (небо), ниже — пустота с малиновым краем.
function gapVoid(ctx, room, rnd) {
  const x0 = GAP.x0 * TILE;
  const x1 = (GAP.x1 + 1) * TILE;
  const H = room.h * TILE;
  rect(ctx, x0, TILE, x1 - x0, H - TILE * 2, lin(ctx, x0, 0, x1, 0, [[0, '#0a0610'], [0.5, '#020205'], [1, '#0a0610']]));
  for (let i = 0; i < 160; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = TILE + rnd() * (H - TILE * 2);
    const c = rnd() < 0.25 ? '#86163a' : rnd() < 0.5 ? '#4a0c1e' : '#1a0a14';
    rect(ctx, x, y, rnd() < 0.15 ? 1 : 0.5, rnd() < 0.15 ? 1 : 0.5, c);
  }
  // рваные края с трещинами
  for (const [ex, dir] of [[x0, 1], [x1, -1]]) {
    for (let y = TILE; y < H - TILE; y += 2 + rnd() * 3) {
      const d = 1 + rnd() * 4;
      poly(ctx, [ex, y, ex + dir * d, y + 1.2, ex, y + 2.6], '#2a2a34');
      if (rnd() < 0.5) path(ctx, [ex + dir * 0.4, y, ex + dir * 0.4, y + 2.6], '#c8284a', 0.45);
    }
  }
  // сверху — небо: стираем верхний ряд провала
  ctx.clearRect(x0, 0, x1 - x0, TILE);
}

// ── параллакс ──────────────────────────────────────────────────────────
let sky = null;
function buildSky() {
  const SW = 640;
  const SH = 48;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w * 2;
    c.height = h * 2;
    const x = c.getContext('2d');
    x.scale(2, 2);
    return [c, x];
  };
  const [city, cx] = mk(SW, SH);
  const rnd = mulberry32(31);
  // дальний город: шпили, башни, крыши; окна — тёплые огни
  let x = 0;
  while (x < SW) {
    const w = 10 + rnd() * 26;
    const h = 12 + rnd() * 24;
    const top = SH - h;
    cx.fillStyle = '#121729';
    cx.fillRect(x, top, w, h);
    if (rnd() < 0.5) poly(cx, [x - 1, top, x + w / 2, top - 6 - rnd() * 12, x + w + 1, top], '#121729');
    if (rnd() < 0.25) poly(cx, [x + w / 2 - 1.5, top - 4, x + w / 2, top - 16 - rnd() * 10, x + w / 2 + 1.5, top - 4], '#151b30');
    for (let k = 0; k < w * h * 0.02; k++) {
      cx.fillStyle = rnd() < 0.8 ? 'rgba(255,190,100,0.85)' : 'rgba(255,230,170,1)';
      cx.fillRect(x + 1 + rnd() * (w - 2), top + 2 + rnd() * (h - 4), 0.5, 1);
    }
    x += w - 1;
  }
  // колокольня посреди города
  const bx = 300;
  cx.fillStyle = '#0e1222';
  cx.fillRect(bx - 5, 0, 10, SH);
  poly(cx, [bx - 7, 6, bx, -8, bx + 7, 6], '#0e1222');
  oval(cx, bx, 14, 2.4, 2.6, '#7a4a18');
  oval(cx, bx, 14, 1.4, 1.6, '#e0a040');
  sky = { city, SW, SH };
}

export function drawRoadParallax(g, ctx, cx, cy, q) {
  const top = -cy; // верх комнаты на экране
  const band = top + TILE; // низ верхнего ряда
  if (band <= 0) return;
  if (!sky) buildSky();
  const W = ctx.canvas.width;
  const roomW = g.room.pxW;
  ctx.save();
  // небо
  ctx.fillStyle = lin(ctx, 0, band - 48, 0, band, [[0, '#070a18'], [0.6, '#121a34'], [1, '#26304e']]);
  ctx.fillRect(0, 0, W, band);
  // луна с ореолом
  const mx = 300 - cx * 0.05;
  const my = band - 30;
  ctx.fillStyle = rad(ctx, mx, my, 2, 26, [[0, 'rgba(200,210,240,0.35)'], [1, 'rgba(200,210,240,0)']]);
  ctx.fillRect(mx - 26, my - 26, 52, 52);
  oval(ctx, mx, my, 6, 6, '#d8dcec');
  oval(ctx, mx + 1.5, my - 1, 1.6, 1.2, '#b4b9cc');
  oval(ctx, mx - 2, my + 2, 1.2, 1, '#bcc1d4');
  // облака-полосы
  for (let i = 0; i < 6; i++) {
    const w = 60 + hash2(i, 3, 1) * 90;
    const x = ((hash2(i, 1, 1) * 900 - cx * 0.1 + g.time * 2) % 900 + 900) % 900 - 200;
    ctx.fillStyle = 'rgba(20,26,48,0.75)';
    ctx.fillRect(x, band - 40 + hash2(i, 2, 1) * 22, w, 2 + hash2(i, 4, 1) * 2);
  }
  // город — параллакс 0.3; восток тонет в малиновом зареве Стирания
  if (q.parallax >= 2) {
    const off = -((cx * 0.3) % sky.SW);
    for (let x = off - sky.SW; x < W; x += sky.SW) ctx.drawImage(sky.city, x, band - sky.SH + 4, sky.SW, sky.SH);
    const k = Math.max(0, Math.min(1, (cx + 200) / roomW));
    ctx.fillStyle = lin(ctx, 0, 0, W, 0, [[0, 'rgba(200,40,74,0)'], [0.5, `rgba(200,40,74,${0.1 * k})`], [1, `rgba(200,40,74,${0.45 * k})`]]);
    ctx.fillRect(0, 0, W, band);
  }
  ctx.restore();
}

// ── объекты (HD-маляры; ctx — плотная сетка атласа) ─────────────────────
const IRON = ['#0d0e14', '#1c1e28', '#353848', '#565a6e'];

// Кованый фонарь у дороги. p.erased — в стёртой части: стекло разбито, свет малиновый.
export function drawLampHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  const er = p.erased;
  oval(ctx, x, y - 0.5, 4, 1.4, 'rgba(3,4,10,0.5)');
  // постамент и столб
  rect(ctx, x - 2.4, y - 3, 4.8, 3, lin(ctx, x - 2.4, 0, x + 2.4, 0, [[0, IRON[3]], [0.4, IRON[2]], [1, IRON[0]]]));
  rect(ctx, x - 0.9, y - 30, 1.8, 27, lin(ctx, x - 1, 0, x + 1, 0, [[0, IRON[3]], [0.5, IRON[1]], [1, IRON[0]]]));
  rect(ctx, x - 1.6, y - 16, 3.2, 1.2, IRON[2]);
  // кронштейн и фонарь
  path(ctx, [x, y - 29, x + 2.5, y - 32, x + 4.8, y - 31], IRON[1], 0.8);
  const lx = x;
  const ly = y - 34;
  poly(ctx, [lx - 2.6, ly - 3, lx + 2.6, ly - 3, lx + 3.2, ly + 3.2, lx - 3.2, ly + 3.2], IRON[0]);
  const fl = 0.85 + 0.15 * Math.sin(t * 14);
  if (er) {
    poly(ctx, [lx - 2.2, ly - 2.4, lx + 2.2, ly - 2.4, lx + 2.6, ly + 2.6, lx - 2.6, ly + 2.6], '#2a0c18');
    poly(ctx, [lx - 2, ly + 0.5, lx + 0.4, ly - 2.2, lx + 1.5, ly + 2.5], `rgba(255,90,122,${0.75 * fl})`);
  } else {
    poly(ctx, [lx - 2.2, ly - 2.4, lx + 2.2, ly - 2.4, lx + 2.6, ly + 2.6, lx - 2.6, ly + 2.6], rad(ctx, lx, ly + 0.5, 0.3, 3.4, [[0, '#fff8e0'], [0.35, '#ffd27a'], [1, '#b8721f']]));
    oval(ctx, lx, ly + 0.6, 0.9 * fl, 1.4 * fl, '#ffffff');
  }
  path(ctx, [lx, ly - 3, lx, ly + 3.2], IRON[0], 0.4);
  poly(ctx, [lx - 3.6, ly - 3, lx, ly - 6, lx + 3.6, ly - 3], lin(ctx, lx - 3, 0, lx + 3, 0, [[0, IRON[3]], [1, IRON[0]]]));
  rect(ctx, lx - 0.4, ly - 7.4, 0.8, 1.6, IRON[2]);
}

// Знамя: тёмно-синее полотно с золотым солнцем, бахрома, рваный низ, колышется.
export function drawBannerHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  oval(ctx, x + 1, y - 0.5, 3, 1, 'rgba(3,4,10,0.5)');
  rect(ctx, x - 0.8, y - 42, 1.6, 42, lin(ctx, x - 1, 0, x + 1, 0, [[0, IRON[3]], [1, IRON[0]]]));
  rect(ctx, x - 1, y - 42, 15, 1.4, IRON[2]);
  oval(ctx, x + 14, y - 41.3, 0.9, 0.9, '#cfa75a');
  oval(ctx, x, y - 43, 1.1, 1.1, '#cfa75a');
  const pts = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const wv = Math.sin(t * 3 + k * 4) * 0.8 * k;
    pts.push(x + 1.2 + wv, y - 40.5 + k * 30);
  }
  const hem = [];
  for (let i = 0; i <= 6; i++) {
    const k = i / 6;
    const wv = Math.sin(t * 3 + 4) * 0.8;
    hem.push(x + 1.2 + k * 12 + wv, y - 10.5 + (i % 2 ? 2.4 : -0.6) + Math.sin(t * 3 + i) * 0.4);
  }
  const right = [];
  for (let i = n; i >= 0; i--) {
    const k = i / n;
    const wv = Math.sin(t * 3 + k * 4 + 0.6) * 0.8 * k;
    right.push(x + 13.2 + wv, y - 40.5 + k * 30);
  }
  poly(ctx, [...pts, ...hem, ...right], lin(ctx, x, y - 40, x + 14, y - 10, [[0, '#2f4a7a'], [0.45, '#1f3058'], [1, '#111a33']]));
  inside(ctx, () => {
    // кайма и складки
    rect(ctx, x, y - 41, 16, 1, '#cfa75a');
    path(ctx, [x + 2, y - 39, x + 2 + Math.sin(t * 3 + 2), y - 12], '#cfa75a', 0.45);
    path(ctx, [x + 12.4, y - 39, x + 12.4 + Math.sin(t * 3 + 3), y - 12], '#cfa75a', 0.45);
    path(ctx, [x + 5, y - 38, x + 5.6 + Math.sin(t * 3 + 2) * 0.8, y - 12], 'rgba(5,8,20,0.45)', 0.6);
    path(ctx, [x + 9.6, y - 38, x + 10.2 + Math.sin(t * 3 + 3) * 0.8, y - 12], 'rgba(120,150,210,0.25)', 0.5);
    // солнце
    const sx = x + 7.2 + Math.sin(t * 3 + 2) * 0.5;
    const sy = y - 28;
    ctx.strokeStyle = '#e6c06a';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    oval(ctx, sx, sy, 1, 1, '#f2d792');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r1 = i % 2 ? 3.6 : 4.8;
      path(ctx, [sx + Math.cos(a) * 3, sy + Math.sin(a) * 3, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1], '#e6c06a', 0.45);
    }
    path(ctx, [sx, sy + 5, sx, sy + 14], '#cfa75a', 0.4);
  });
}

// Осеннее дерево: тёмный ствол, крона из листвяных шапок — янтарь, охра, ржавчина.
export function drawTreeHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const id = p.id || 1;
  const sw = Math.sin((g.time || 0) * 1.3 + x) * 0.6;
  oval(ctx, x, y - 0.5, 13, 3, 'rgba(3,4,10,0.45)');
  poly(ctx, [x - 2.6, y, x - 1.4, y - 26, x + 1.4, y - 26, x + 2.8, y], lin(ctx, x - 2, 0, x + 2, 0, [[0, '#4a3424'], [0.4, '#2e2018'], [1, '#160f0b']]));
  path(ctx, [x, y - 15, x - 4, y - 21, x - 8, y - 26], '#24180f', 1.4);
  path(ctx, [x, y - 18, x + 4, y - 24, x + 7, y - 29], '#24180f', 1.2);
  path(ctx, [x - 1, y - 6, x - 3.5, y - 1], '#24180f', 1);
  const cols = [['#5a3014', '#8a4a18'], ['#8a4a18', '#c46a1c'], ['#b8721f', '#e0a040'], ['#d89a34', '#ffd27a']];
  for (let i = 0; i < 26; i++) {
    // шапки снизу вверх: нижние темнее, верхние ловят свет
    const k = i / 26;
    const a = hash2(i, id, 1) * Math.PI * 2;
    const r = (0.35 + 0.65 * hash2(id, i, 2)) * 13 * (1 - k * 0.45);
    const cx = x + Math.cos(a) * r * 1.3 + sw * (0.4 + k);
    const cy = y - 34 + Math.sin(a) * r * 0.7 - k * 6;
    const s = 3.4 + hash2(i, id, 3) * 3.2;
    const shade = k < 0.3 ? 0 : k < 0.6 ? 1 : 2;
    const [lo, hi] = cols[Math.min(3, shade + (hash2(i, id, 4) > 0.7 ? 1 : 0))];
    oval(ctx, cx, cy, s, s * 0.8, lin(ctx, cx - s, cy - s, cx + s, cy + s, [[0, hi], [1, lo]]));
  }
  // одинокие листья по краю кроны
  for (let i = 0; i < 10; i++) {
    const a = hash2(i, id, 5) * Math.PI * 2;
    leaf(ctx, x + Math.cos(a) * 19 + sw, y - 36 + Math.sin(a) * 11, a, LEAF[i % LEAF.length]);
  }
}

export function drawDeadTreeHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  oval(ctx, x, y - 0.5, 7, 1.8, 'rgba(3,4,10,0.45)');
  poly(ctx, [x - 2, y, x - 0.8, y - 24, x + 0.8, y - 24, x + 2, y], lin(ctx, x - 2, 0, x + 2, 0, [[0, '#2a2530'], [1, '#08070c']]));
  for (const b of [[0, -14, -10, -26, 1.3], [-6, -20, -8, -32, 0.7], [0, -18, 9, -30, 1.2], [5, -24, 12, -26, 0.6], [0, -23, 2, -33, 0.7]]) path(ctx, [x + b[0], y + b[1], x + b[2], y + b[3]], '#0d0b12', b[4]);
  rect(ctx, x - 10.4, y - 27.4, 0.8, 0.8, '#ff5a7a');
  rect(ctx, x + 8.6, y - 30.6, 0.6, 0.6, '#c8284a');
}

export function drawGraveHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  oval(ctx, x, y - 0.5, 6, 1.6, 'rgba(3,4,10,0.5)');
  ctx.beginPath();
  ctx.moveTo(x - 4.6, y);
  ctx.lineTo(x - 4.6, y - 11);
  ctx.arc(x, y - 11, 4.6, Math.PI, 0);
  ctx.lineTo(x + 4.6, y);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x - 5, y - 16, x + 5, y, [[0, '#7b88a3'], [0.35, '#4a5168'], [1, '#1d212d']]);
  ctx.fill();
  inside(ctx, () => {
    rect(ctx, x - 0.8, y - 13, 1.6, 7, '#1a1d29');
    rect(ctx, x - 2.8, y - 11, 5.6, 1.4, '#1a1d29');
    oval(ctx, x - 3, y - 2, 2.4, 1.6, '#33462a');
    oval(ctx, x + 3.6, y - 6, 1.4, 2, 'rgba(10,12,20,0.45)');
  });
}

// Башня ворот: кладка, бойница с огнём, знамя; на вершине — крюк для цепи колокола.
export function drawGateTowerHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const h = 78;
  const t = g.time || 0;
  oval(ctx, x, y - 1, 12, 3, 'rgba(3,4,10,0.55)');
  rect(ctx, x - 9, y - h, 18, h, lin(ctx, x - 9, 0, x + 9, 0, [[0, '#4a5168'], [0.3, '#30364a'], [0.75, '#1d212d'], [1, '#0d0f16']]));
  inside(ctx, () => {
    for (let j = 0; j < h / 4; j++) {
      const off = (j & 1) * 3;
      path(ctx, [x - 9, y - j * 4, x + 9, y - j * 4], 'rgba(5,6,12,0.55)', 0.4);
      for (let i = -9 + off; i < 9; i += 6) path(ctx, [x + i, y - j * 4, x + i, y - j * 4 - 4], 'rgba(5,6,12,0.45)', 0.35);
    }
    // мох и потёки
    for (let i = 0; i < 5; i++) path(ctx, [x - 8 + i * 4, y - h + 6, x - 8 + i * 4 + 0.5, y - h + 12 + i * 3], 'rgba(59,74,42,0.6)', 0.7);
  });
  // зубцы
  for (let i = -9; i < 9; i += 4.5) rect(ctx, x + i, y - h - 4, 3, 4, lin(ctx, 0, y - h - 4, 0, y - h, [[0, '#5d6683'], [1, '#262b3c']]));
  // бойница с тёплым огнём
  ctx.beginPath();
  ctx.roundRect(x - 2, y - h + 14, 4, 8, [2, 2, 0, 0]);
  ctx.fillStyle = rad(ctx, x, y - h + 19, 0.5, 5, [[0, '#ffd27a'], [0.5, '#e0a040'], [1, '#7a4a18']]);
  ctx.fill();
  oval(ctx, x, y - h + 19, 0.8 + Math.sin(t * 9) * 0.2, 1.4, '#fff8e0');
  // знамя: багровое, рваное (Стирание доходит до ворот)
  const bx = x - 6;
  const by = y - h + 28;
  const wv = Math.sin(t * 2.6) * 0.6;
  poly(ctx, [bx, by, bx + 12, by, bx + 12 + wv, by + 26, bx + 9 + wv, by + 22, bx + 6 + wv, by + 28, bx + 3 + wv, by + 21, bx + wv, by + 25], lin(ctx, bx, by, bx + 12, by + 26, [[0, '#86163a'], [0.5, '#5a0f22'], [1, '#2a0610']]));
  inside(ctx, () => {
    ctx.strokeStyle = '#cfa75a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(bx + 6 + wv * 0.5, by + 9, 2.6, 0, Math.PI * 2);
    ctx.stroke();
    path(ctx, [bx + 6 + wv * 0.5, by + 4, bx + 6 + wv * 0.5, by + 16], '#cfa75a', 0.4);
  });
  rect(ctx, bx - 1, by - 1, 14, 1.2, IRON[2]);
}

// Колокол на цепи между башнями ворот и тёмный передний план — поверх сцены.
export function drawRoadOver(g, ctx) {
  const towers = g.gateTowers;
  if (towers?.length === 2) {
    const [a, b] = towers;
    const ax = a.x;
    const ay = a.y - 80;
    const bx = b.x;
    const by = b.y - 80;
    const mx = (ax + bx) / 2 + 10;
    const my = (ay + by) / 2 + 6;
    const sway = Math.sin(g.time * 0.9) * 1.2;
    // цепь — два провиса
    ctx.save();
    ctx.strokeStyle = '#1c1e28';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + mx) / 2 + 4, (ay + my) / 2 + 6, mx + sway, my);
    ctx.quadraticCurveTo((bx + mx) / 2 + 4, (by + my) / 2 + 6, bx, by);
    ctx.stroke();
    ctx.strokeStyle = '#4a4e60';
    ctx.lineWidth = 0.4;
    ctx.setLineDash([0.8, 0.9]);
    ctx.stroke();
    ctx.restore();
    const bell = atlas.sprite('road|bell', 26, 30, 13, 2, (c, x, y) => paintBell(c, x, y), { hd: true, crisp: true, outline: '#05060c' });
    blit(ctx, bell, mx + sway, my);
  }
  // передний план: тёмные столбы ограды и размытые листья у нижнего края
  const H = g.room.pxH;
  for (let i = 0; i < g.room.w / 7; i++) {
    const x = 40 + i * 112 + hash2(i, 2, 3) * 30;
    const post = atlas.sprite('road|fgpost', 16, 46, 8, 44, (c, px, py) => paintFgPost(c, px, py), { hd: true, crisp: true });
    blit(ctx, post, x, H + 8);
    if (g.quality.extraDecor || i % 2 === 0) {
      const lv = atlas.sprite(`road|fgleaf|${i % 3}`, 40, 26, 20, 22, (c, px, py) => paintFgLeaves(c, px, py, i % 3), { hd: true });
      blit(ctx, lv, x + 22, H + 4);
    }
  }
}

function paintBell(ctx, x, y) {
  path(ctx, [x, y - 2, x, y + 3], '#1c1e28', 1);
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 4);
  ctx.quadraticCurveTo(x - 4.4, y + 3, x, y + 3);
  ctx.quadraticCurveTo(x + 4.4, y + 3, x + 4, y + 4);
  ctx.quadraticCurveTo(x + 5.4, y + 14, x + 10, y + 21);
  ctx.lineTo(x - 10, y + 21);
  ctx.quadraticCurveTo(x - 5.4, y + 14, x - 4, y + 4);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, x - 10, 0, x + 10, 0, [[0, '#3a2810'], [0.22, '#9c7832'], [0.38, '#f2d792'], [0.55, '#9c7832'], [0.85, '#4a3414'], [1, '#22170a']]);
  ctx.fill();
  inside(ctx, () => {
    path(ctx, [x - 9, y + 17, x + 9, y + 17], 'rgba(20,12,4,0.7)', 0.6);
    path(ctx, [x - 7.5, y + 13.5, x + 7.5, y + 13.5], 'rgba(242,215,146,0.5)', 0.4);
    oval(ctx, x + 6, y + 10, 4, 9, 'rgba(10,6,2,0.4)');
  });
  oval(ctx, x, y + 21, 10, 1.6, '#22170a');
  oval(ctx, x + 0.5, y + 22.4, 1.4, 1.4, '#2a1c0c');
}

function paintFgPost(ctx, x, y) {
  rect(ctx, x - 4, y - 38, 8, 38, lin(ctx, x - 4, 0, x + 4, 0, [[0, '#14161f'], [0.3, '#0a0b11'], [1, '#040508']]));
  rect(ctx, x - 5.4, y - 42, 10.8, 4.4, '#0d0e15');
  poly(ctx, [x - 4.6, y - 42, x, y - 45.5, x + 4.6, y - 42], '#0d0e15');
  path(ctx, [x - 3.6, y - 37, x - 3.6, y - 2], 'rgba(90,100,140,0.35)', 0.4);
  rect(ctx, x - 3, y - 30, 6, 10, '#101420');
  path(ctx, [x, y - 29, x, y - 21], 'rgba(207,167,90,0.35)', 0.5);
}

// Размытые («не в фокусе») листья переднего плана — мягкие пятна без пикселизации.
function paintFgLeaves(ctx, x, y, v) {
  for (let i = 0; i < 14; i++) {
    const a = hash2(i, v, 8) * Math.PI * 2;
    const r = hash2(v, i, 9) * 14;
    const cx = x + Math.cos(a) * r * 1.3;
    const cy = y - 10 + Math.sin(a) * r * 0.6;
    const s = 2.5 + hash2(i, v, 10) * 3;
    const c = ['80,40,14', '140,72,20', '184,114,31', '60,28,10'][i % 4];
    ctx.fillStyle = rad(ctx, cx, cy, 0, s, [[0, `rgba(${c},0.95)`], [0.7, `rgba(${c},0.6)`], [1, `rgba(${c},0)`]]);
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  }
}
