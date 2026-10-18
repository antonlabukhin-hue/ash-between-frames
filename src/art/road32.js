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

// Геометрия тракта читается из карты: дорога — тайлы '=', провал — ряды пустоты поперёк.
// Дорога идёт снизу вверх к воротам; правая сторона за провалом — стёртая (Стирание).
const isRoad = (t) => t === T.ROAD;
const isGround = (t) => t === T.ASH || t === T.GRASS;

export function roadGeometry(room) {
  let rx0 = Infinity;
  let rx1 = -1;
  let gy0 = Infinity;
  let gy1 = -1;
  for (let ty = 1; ty < room.h - 1; ty++) {
    for (let tx = 1; tx < room.w - 1; tx++) {
      const t = tileAt(room, tx, ty);
      if (isRoad(t)) {
        rx0 = Math.min(rx0, tx);
        rx1 = Math.max(rx1, tx);
      }
      if (t === T.VOID) {
        gy0 = Math.min(gy0, ty);
        gy1 = Math.max(gy1, ty);
      }
    }
  }
  const road = { x0: rx0 * TILE, x1: (rx1 + 1) * TILE };
  const gap = { y0: gy0 * TILE, y1: (gy1 + 1) * TILE };
  const mid = (road.x0 + road.x1) / 2;
  // Стирание: правая сторона за провалом, к воротам захватывает и край дороги
  const erased = (x, y) => y < gap.y0 && x > mid + 4 + (y / gap.y0) * 28;
  return { road, gap, mid, erased };
}

// ── пол ────────────────────────────────────────────────────────────────
export function paintRoadBase() {
  // всё рисуется в плотной сетке (paintHd); базовый холст прозрачный
}

export function paintRoadHd(ctx, room) {
  const rnd = mulberry32(room.seed || 7);
  const W = room.w * TILE;
  const H = room.h * TILE;
  const G = roadGeometry(room);
  const at = (x, y) => tileAt(room, Math.floor(x / TILE), Math.floor(y / TILE));
  ctx.save();

  // 1. земля: тёмная почва пятнами, трава, листва (в стёртой части — пепел)
  ctx.save();
  clipTiles(ctx, room, isGround);
  rect(ctx, 0, 0, W, H, '#16131a');
  for (let i = 0; i < room.w * room.h * 1.4; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const c = G.erased(x, y) ? ['#1a1820', '#0f0e14', '#1d1622'][i % 3] : ['#1f1b22', '#110f15', '#231d1a', '#1b1f1c'][i % 4];
    oval(ctx, x, y, 2 + rnd() * 5, 1 + rnd() * 2.5, c);
  }
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      if (tileAt(room, tx, ty) !== T.GRASS) continue;
      for (let k = 0; k < 4; k++) {
        const x = tx * TILE + rnd() * 16;
        const y = ty * TILE + 4 + rnd() * 13;
        tuft(ctx, x, y, rnd, G.erased(x, y));
      }
    }
  }
  for (let i = 0; i < room.w * room.h * 2.2; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    if (!isGround(at(x, y))) continue;
    if (G.erased(x, y) && rnd() < 0.75) {
      rect(ctx, x, y, 0.5 + rnd(), 0.5, rnd() < 0.25 ? '#86163a' : '#3a3b47');
      continue;
    }
    leaf(ctx, x, y, rnd() * Math.PI, LEAF[(rnd() * LEAF.length) | 0]);
  }
  // тёплая сторона: листва сбилась у левого бордюра
  for (let y = TILE; y < H - TILE; y += 4 + rnd() * 8) {
    if (y > G.gap.y0 - 6 && y < G.gap.y1 + 6) continue;
    for (let k = 0; k < 5; k++) leaf(ctx, G.road.x0 - 2 - rnd() * 8, y + rnd() * 4, rnd() * Math.PI, LEAF[(rnd() * LEAF.length) | 0]);
  }
  ctx.restore();

  // 2. мокрая брусчатка
  ctx.save();
  clipTiles(ctx, room, isRoad);
  rect(ctx, G.road.x0, 0, G.road.x1 - G.road.x0, H, '#0b0d14');
  const rowH = 5.4;
  for (let y = 0; y < H; y += rowH) {
    let x = G.road.x0 - rnd() * 8;
    while (x < G.road.x1) {
      const w = 5.5 + rnd() * 4;
      stone(ctx, x + 0.5, y + 0.4, w - 1, rowH - 1, rnd, G.erased(x, y));
      x += w;
    }
  }
  // лужи — тёмные зеркала с холодным бликом
  for (let i = 0; i < room.h * 0.9; i++) {
    const x = G.road.x0 + 8 + rnd() * (G.road.x1 - G.road.x0 - 16);
    const y = TILE + rnd() * (H - TILE * 2);
    if (!isRoad(at(x, y))) continue;
    const rx = 5 + rnd() * 12;
    const ry = 1.6 + rnd() * 2.4;
    oval(ctx, x, y, rx, ry, 'rgba(6,9,18,0.82)');
    oval(ctx, x, y + 0.3, rx * 0.86, ry * 0.7, 'rgba(18,26,48,0.6)');
    path(ctx, [x - rx * 0.6, y - ry * 0.55, x + rx * 0.3, y - ry * 0.8], 'rgba(150,170,220,0.35)', 0.4);
  }
  // трещины Стирания в стёртой части дороги
  for (let i = 0; i < 14; i++) {
    const x = G.mid + rnd() * (G.road.x1 - G.mid);
    const y = TILE * 2 + rnd() * (G.gap.y0 - TILE * 3);
    crack(ctx, x, y, rnd);
  }
  ctx.restore();
  // бордюры вдоль дороги
  const y0 = (room.def.skyRows ?? 1) * TILE;
  curbV(ctx, G.road.x0 - 1.5, y0, H, G, rnd);
  curbV(ctx, G.road.x1 - 1.5, y0, H, G, rnd);

  // 3. стены: балюстрада сверху (сквозь неё небо), ограды по бокам, парапет снизу
  walls(ctx, room, rnd, G);
  // 4. провал Стирания поперёк дороги
  gapVoid(ctx, room, rnd, G);
  ctx.restore();
}

function curbV(ctx, x, y0, H, G, rnd) {
  let y = y0;
  while (y < H - TILE) {
    const h = 10 + rnd() * 8;
    if (y + h > G.gap.y0 && y < G.gap.y1) {
      y = G.gap.y1;
      continue;
    }
    const er = G.erased(x, y);
    ctx.beginPath();
    ctx.roundRect(x, y + 0.3, 3, h - 0.6, 0.8);
    ctx.fillStyle = lin(ctx, x, 0, x + 3, 0, [[0, er ? '#55566a' : '#6c7590'], [0.4, er ? '#3c3d4c' : '#454c63'], [1, '#1a1c26']]);
    ctx.fill();
    if (er && rnd() < 0.3) rect(ctx, x, y + h * 0.3, 3, h * 0.3, '#05060c');
    y += h;
  }
}

function crack(ctx, x, y, rnd) {
  const pts = [x, y];
  let cx = x;
  let cy = y;
  for (let i = 0; i < 5; i++) {
    cx += (rnd() - 0.5) * 5;
    cy += 3 + rnd() * 5;
    pts.push(cx, cy);
  }
  path(ctx, pts, '#05060c', 1.2);
  path(ctx, pts, '#c8284a', 0.5);
  path(ctx, pts.map((v, i) => (i % 2 ? v : v - 0.4)), 'rgba(255,90,122,0.6)', 0.25);
}

// Балюстрада сверху (небо сквозь балясины), каменные ограды по бокам, парапет снизу.
function walls(ctx, room, rnd, G) {
  const W = room.w * TILE;
  const H = room.h * TILE;
  // ряды неба сверху (стены без пола) — прозрачные; балюстрада — на нижнем из них
  let sky = 1;
  while (sky < room.h && tileAt(room, 1, sky) === T.WALL) sky++;
  const by = (sky - 1) * TILE;
  for (let tx = 0; tx < room.w; tx++) {
    if (tileAt(room, tx, sky - 1) !== T.WALL) continue;
    const x = tx * TILE;
    rect(ctx, x, by + 12.5, TILE, 3.5, lin(ctx, 0, by + 12.5, 0, by + 16, [[0, '#4d5570'], [0.3, '#30364a'], [1, '#12141c']]));
    for (let b = 1.5; b < TILE; b += 3.2) {
      poly(ctx, [x + b - 0.6, by + 5, x + b + 0.6, by + 5, x + b + 1, by + 8, x + b + 0.5, by + 10, x + b + 0.9, by + 12.5, x + b - 0.9, by + 12.5, x + b - 0.5, by + 10, x + b - 1, by + 8], lin(ctx, x + b - 1, 0, x + b + 1, 0, [[0, '#6c7590'], [0.5, '#3d4459'], [1, '#1d212d']]));
    }
    rect(ctx, x, by + 3, TILE, 2.4, lin(ctx, 0, by + 3, 0, by + 5.4, [[0, '#7a84a2'], [0.4, '#4a5168'], [1, '#1f2330']]));
  }
  for (const tx of [0, room.w - 1]) {
    const x = tx * TILE;
    const right = tx > 0;
    for (let y = sky * TILE; y < H - TILE; y += 4) {
      const er = right && G.erased(x, y);
      rect(ctx, x, y, TILE, 4, lin(ctx, x, 0, x + TILE, 0, right ? [[0, '#0d0e15'], [0.4, er ? '#2a2230' : '#2c3346'], [1, er ? '#3a2a34' : '#4a5168']] : [[0, '#4a5168'], [0.6, '#2c3346'], [1, '#0d0e15']]));
      path(ctx, [x + 2, y + 3.6, x + TILE - 2, y + 3.6], 'rgba(5,6,12,0.6)', 0.35);
    }
    path(ctx, [right ? x + 1 : x + TILE - 1, sky * TILE, right ? x + 1 : x + TILE - 1, H - TILE], 'rgba(160,175,215,0.45)', 0.5);
    for (let y = (sky + 1) * TILE; y < H - TILE; y += TILE * 3) {
      if (y > G.gap.y0 - 8 && y < G.gap.y1 + 8) continue;
      rect(ctx, x + 2, y - 3, TILE - 4, 6, lin(ctx, x, 0, x + TILE, 0, [[0, '#8a93ae'], [0.5, '#454c63'], [1, '#191c27']]));
      rect(ctx, x + 1, y - 4, TILE - 2, 1.4, '#9aa3be');
    }
  }
  const yb = (room.h - 1) * TILE;
  rect(ctx, 0, yb, W, TILE, lin(ctx, 0, yb, 0, yb + TILE, [[0, '#3a4058'], [0.15, '#262b3c'], [1, '#0a0b12']]));
  for (let x = 0; x < W; x += 9 + rnd() * 7) path(ctx, [x, yb + 0.6, x, yb + TILE], 'rgba(5,6,12,0.55)', 0.4);
  path(ctx, [0, yb + 0.4, W, yb + 0.4], '#5d6683', 0.6);
}

// Провал: ряды пустоты поперёк — тьма с малиновыми искрами, рваные края, обрыв.
function gapVoid(ctx, room, rnd, G) {
  const W = room.w * TILE;
  const y0 = G.gap.y0;
  const y1 = G.gap.y1;
  ctx.clearRect(TILE, y0, W - TILE * 2, y1 - y0);
  rect(ctx, TILE, y0, W - TILE * 2, y1 - y0, lin(ctx, 0, y0, 0, y1, [[0, '#14060e'], [0.5, '#020205'], [1, '#0a0610']]));
  for (let i = 0; i < 260; i++) {
    const x = TILE + rnd() * (W - TILE * 2);
    const y = y0 + rnd() * (y1 - y0);
    const c = rnd() < 0.25 ? '#86163a' : rnd() < 0.5 ? '#4a0c1e' : '#1a0a14';
    rect(ctx, x, y, rnd() < 0.15 ? 1 : 0.5, rnd() < 0.15 ? 1 : 0.5, c);
  }
  for (const [ey, dir] of [[y0, 1], [y1, -1]]) {
    for (let x = TILE; x < W - TILE; x += 2 + rnd() * 3) {
      const d = 1 + rnd() * 4;
      poly(ctx, [x, ey, x + 1.2, ey + dir * d, x + 2.6, ey], dir > 0 ? '#2a2a34' : '#1a1a22');
      if (rnd() < 0.5) path(ctx, [x, ey + dir * 0.4, x + 2.6, ey + dir * 0.4], '#c8284a', 0.45);
    }
  }
  rect(ctx, TILE, y1 - 5, W - TILE * 2, 5, lin(ctx, 0, y1 - 5, 0, y1, [[0, 'rgba(10,6,12,0)'], [1, 'rgba(60,20,34,0.8)']]));
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
    cx.fillStyle = '#1b2240';
    cx.fillRect(x, top, w, h);
    if (rnd() < 0.5) poly(cx, [x - 1, top, x + w / 2, top - 6 - rnd() * 12, x + w + 1, top], '#1b2240');
    if (rnd() < 0.25) poly(cx, [x + w / 2 - 1.5, top - 4, x + w / 2, top - 16 - rnd() * 10, x + w / 2 + 1.5, top - 4], '#222a4c');
    cx.fillStyle = 'rgba(120,140,200,0.25)';
    cx.fillRect(x, top, 1, h);
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
  // низ полосы неба: ряды стен без пола сверху комнаты (def.skyRows)
  const band = top + (g.room.def.skyRows ?? 1) * TILE;
  if (band <= 0) return;
  if (!sky) buildSky();
  const W = ctx.canvas.width;
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
    // как на эталоне: слева тёплое зарево живого города, справа — малиновое Стирание
    ctx.fillStyle = lin(ctx, 0, 0, W, 0, [[0, 'rgba(224,140,50,0.32)'], [0.42, 'rgba(224,140,50,0)'], [0.58, 'rgba(200,40,74,0)'], [1, 'rgba(200,40,74,0.42)']]);
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
  const er = p.erased;
  if (er) for (let i = 0; i < hem.length; i += 2) hem[i + 1] += (i % 4 ? 4 : -2) + Math.sin(i) * 2;
  poly(ctx, [...pts, ...hem, ...right], lin(ctx, x, y - 40, x + 14, y - 10, er ? [[0, '#86163a'], [0.45, '#5a0f22'], [1, '#2a0610']] : [[0, '#2f4a7a'], [0.45, '#1f3058'], [1, '#111a33']]));
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
  const h = 104;
  const hw = 15;
  const t = g.time || 0;
  oval(ctx, x, y - 1, hw + 4, 4, 'rgba(3,4,10,0.55)');
  rect(ctx, x - hw, y - h, hw * 2, h, lin(ctx, x - hw, 0, x + hw, 0, [[0, '#4a5168'], [0.3, '#30364a'], [0.75, '#1d212d'], [1, '#0d0f16']]));
  inside(ctx, () => {
    for (let j = 0; j < h / 4; j++) {
      const off = (j & 1) * 3;
      path(ctx, [x - hw, y - j * 4, x + hw, y - j * 4], 'rgba(5,6,12,0.55)', 0.4);
      for (let i = -hw + off; i < hw; i += 6) path(ctx, [x + i, y - j * 4, x + i, y - j * 4 - 4], 'rgba(5,6,12,0.45)', 0.35);
    }
    // мох и потёки
    for (let i = 0; i < 8; i++) path(ctx, [x - hw + 1 + i * 4, y - h + 6, x - hw + 1.5 + i * 4, y - h + 14 + (i % 3) * 6], 'rgba(59,74,42,0.6)', 0.8);
  });
  // зубцы
  for (let i = -hw; i < hw; i += 5) rect(ctx, x + i, y - h - 5, 3.4, 5, lin(ctx, 0, y - h - 4, 0, y - h, [[0, '#5d6683'], [1, '#262b3c']]));
  // бойница с тёплым огнём
  ctx.beginPath();
  ctx.roundRect(x - 2, y - h + 14, 4, 8, [2, 2, 0, 0]);
  ctx.fillStyle = rad(ctx, x, y - h + 19, 0.5, 5, [[0, '#ffd27a'], [0.5, '#e0a040'], [1, '#7a4a18']]);
  ctx.fill();
  oval(ctx, x, y - h + 19, 0.8 + Math.sin(t * 9) * 0.2, 1.4, '#fff8e0');
  // знамя: на тёплой башне — синее с золотым солнцем и ровной бахромой,
  // на стёртой — багровое и рваное (как на эталоне)
  const bx = x - 7;
  const by = y - h + 34;
  const wv = Math.sin(t * 2.6) * 0.6;
  const cloth = p.warm
    ? [bx, by, bx + 14, by, bx + 14 + wv, by + 30, bx + 7 + wv, by + 36, bx + wv, by + 30]
    : [bx, by, bx + 12, by, bx + 12 + wv, by + 26, bx + 9 + wv, by + 22, bx + 6 + wv, by + 28, bx + 3 + wv, by + 21, bx + wv, by + 25];
  poly(ctx, cloth, lin(ctx, bx, by, bx + 12, by + 30, p.warm ? [[0, '#2f4a7a'], [0.5, '#1f3058'], [1, '#111a33']] : [[0, '#86163a'], [0.5, '#5a0f22'], [1, '#2a0610']]));
  if (p.warm) {
    path(ctx, [bx + 1, by + 1, bx + 1 + wv, by + 29], '#cfa75a', 0.5);
    path(ctx, [bx + 13, by + 1, bx + 13 + wv, by + 29], '#cfa75a', 0.5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      path(ctx, [bx + 7 + Math.cos(a) * 3.4, by + 13 + Math.sin(a) * 3.4, bx + 7 + Math.cos(a) * (i % 2 ? 5 : 6.4), by + 13 + Math.sin(a) * (i % 2 ? 5 : 6.4)], '#e6c06a', 0.5);
    }
  }
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
    const ay = a.y - 100;
    const bx = b.x;
    const by = b.y - 100;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2 + 10;
    const sway = Math.sin(g.time * 0.9) * 1.2;
    // цепь — два провиса
    ctx.save();
    ctx.strokeStyle = '#1c1e28';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + mx) / 2, my + 2, mx + sway, my);
    ctx.quadraticCurveTo((bx + mx) / 2, my + 2, bx, by);
    ctx.stroke();
    ctx.strokeStyle = '#4a4e60';
    ctx.lineWidth = 0.4;
    ctx.setLineDash([0.8, 0.9]);
    ctx.stroke();
    ctx.restore();
    // колокол крупнее, как на эталоне
    const bell = atlas.sprite('road|bell2', 38, 44, 19, 2, (c, x, y) => {
      c.save();
      c.translate(x, y);
      c.scale(1.45, 1.45);
      paintBell(c, 0, 0);
      c.restore();
    }, { hd: true, crisp: true, outline: '#05060c' });
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
