// 32-битный набор тайлов: комната без собственного маляра печатается сразу в плотной
// сетке. Каждый вид пола рисуется сплошной текстурой по своей области (клип по тайлам),
// а не повтором квадрата 16×16: брусчатка, плиты, земля, трава, доски, ступени —
// со светотенью, бликами и мелочами (листва, мох, трещины). Стены — кладка с карнизом,
// городские — штукатурка с окнами и черепица.
import { TILE, T } from './tiles.js';
import { mulberry32, hash2 } from '../core/math.js';
import { poly, oval, path, rect, lin } from './hd.js';

export const LEAF = ['#b8721f', '#8a4a18', '#d89a34', '#5a3014', '#c45a1c', '#e0a040'];

const tileOf = (room, tx, ty) => (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h ? T.WALL : room.tiles[ty * room.w + tx]);

export function clipTiles(ctx, room, pred) {
  ctx.beginPath();
  let any = false;
  for (let ty = 0; ty < room.h; ty++) {
    let s = -1;
    for (let tx = 0; tx <= room.w; tx++) {
      const ok = tx < room.w && pred(tileOf(room, tx, ty));
      if (ok && s < 0) s = tx;
      else if (!ok && s >= 0) {
        ctx.rect(s * TILE, ty * TILE, (tx - s) * TILE, TILE);
        any = true;
        s = -1;
      }
    }
  }
  ctx.clip();
  return any;
}

export function stone(ctx, x, y, w, h, rnd, erased = false) {
  if (erased && rnd() < 0.12) {
    rect(ctx, x, y, w, h, '#05060c');
    rect(ctx, x + 1, y + h - 1.2, w - 2, 0.6, '#4a0c1e');
    return;
  }
  const v = rnd();
  const base = erased ? ['#24242e', '#2a2933', '#1f1f28'][(v * 3) | 0] : ['#262b3a', '#2d3344', '#343b4f', '#2a2f40'][(v * 4) | 0];
  const r = Math.min(1.6, h / 2.4);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = lin(ctx, x, y, x + w * 0.4, y + h, [[0, erased ? '#3a3a46' : '#4a5470'], [0.35, base], [1, '#161925']]);
  ctx.fill();
  path(ctx, [x + r, y + 0.45, x + w * (0.4 + rnd() * 0.4), y + 0.45], erased ? 'rgba(160,160,180,0.25)' : 'rgba(150,175,230,0.45)', 0.4);
  if (rnd() < 0.18) oval(ctx, x + w * 0.5, y + h * 0.45, w * 0.3, 0.45, 'rgba(190,210,255,0.22)');
}

export function leaf(ctx, x, y, a, c) {
  oval(ctx, x, y, 1.3, 0.6, c, a);
  path(ctx, [x - Math.cos(a) * 1.1, y - Math.sin(a) * 1.1, x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1], 'rgba(40,20,8,0.5)', 0.2);
}

export function tuft(ctx, x, y, rnd, erased = false) {
  const n = 4 + ((rnd() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2;
    const len = 2.5 + rnd() * 3.5;
    const ex = x + Math.cos(a) * len + (rnd() - 0.5);
    const ey = y + Math.sin(a) * len;
    const c = erased ? ['#24252c', '#30313b', '#3a1a26'][i % 3] : ['#2e3a24', '#3b4a2a', '#262e1e', '#4f5430'][i % 4];
    path(ctx, [x + (rnd() - 0.5) * 1.5, y, (x + ex) / 2 + 0.4, (y + ey) / 2, ex, ey], c, 0.55);
    if (!erased && rnd() < 0.35) rect(ctx, ex - 0.25, ey - 0.25, 0.5, 0.5, '#d89a34');
  }
}

// ── виды пола (каждый рисует всю комнату, лишнее отрезает клип) ──────────
function ground(ctx, W, H, rnd, green) {
  rect(ctx, 0, 0, W, H, green ? '#15171a' : '#17151b');
  const n = (W * H) / 90;
  for (let i = 0; i < n; i++) {
    const c = green ? ['#1b2019', '#101310', '#1d1c17', '#202619'][i % 4] : ['#1f1b22', '#110f15', '#231d1a', '#1b1a20'][i % 4];
    oval(ctx, rnd() * W, rnd() * H, 2 + rnd() * 5, 1 + rnd() * 2.5, c);
  }
  for (let i = 0; i < n * 0.6; i++) rect(ctx, rnd() * W, rnd() * H, 0.5, 0.5, rnd() < 0.5 ? '#3a3b47' : '#55576a');
  for (let i = 0; i < n * (green ? 0.5 : 0.25); i++) leaf(ctx, rnd() * W, rnd() * H, rnd() * Math.PI, LEAF[(rnd() * LEAF.length) | 0]);
}

function grassField(ctx, W, H, rnd) {
  ground(ctx, W, H, rnd, true);
  for (let i = 0; i < (W * H) / 40; i++) tuft(ctx, rnd() * W, rnd() * H, rnd);
}

function dirtRoad(ctx, room, W, H, rnd) {
  rect(ctx, 0, 0, W, H, '#25232b');
  for (let i = 0; i < (W * H) / 6; i++) {
    const c = ['#2e2c36', '#1c1b22', '#34323d', '#222028'][i % 4];
    rect(ctx, rnd() * W, rnd() * H, 0.5 + rnd() * 0.5, 0.5, c);
  }
  // колеи вдоль каждого ряда дороги
  for (let ty = 0; ty < room.h; ty++) {
    const y = ty * TILE;
    for (const dy of [4.5, 11.5]) {
      ctx.fillStyle = 'rgba(12,12,18,0.45)';
      ctx.fillRect(0, y + dy - 0.8, W, 1.6);
      path(ctx, [0, y + dy - 1, W, y + dy - 1], 'rgba(120,125,150,0.12)', 0.4);
    }
  }
  for (let i = 0; i < (W * H) / 900; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    oval(ctx, x, y, 3 + rnd() * 7, 1.2 + rnd() * 1.6, 'rgba(8,10,20,0.7)');
    path(ctx, [x - 2, y - 0.8, x + 2, y - 1], 'rgba(150,170,220,0.3)', 0.4);
  }
  for (let i = 0; i < (W * H) / 400; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    oval(ctx, x, y, 1 + rnd(), 0.7 + rnd() * 0.5, '#3d4152');
    oval(ctx, x - 0.3, y - 0.3, 0.5, 0.3, '#6a7088');
  }
}

function cobbles(ctx, W, H, rnd) {
  rect(ctx, 0, 0, W, H, '#0b0d14');
  const rowH = 4.6;
  for (let y = 0; y < H; y += rowH) {
    let x = -rnd() * 6;
    while (x < W) {
      const w = 4 + rnd() * 3;
      stone(ctx, x + 0.4, y + 0.4, w - 0.8, rowH - 0.8, rnd);
      x += w;
    }
  }
}

function flags(ctx, W, H, rnd, dark) {
  rect(ctx, 0, 0, W, H, '#0d0e15');
  const S = 8;
  for (let j = 0; j * S < H; j++) {
    const off = (j & 1) * 4;
    for (let i = -1; i * S < W; i++) {
      const x = i * S + off;
      const y = j * S;
      const v = hash2(i, j, 3);
      const base = dark ? ['#20222d', '#252733', '#1c1d27'][(v * 3) | 0] : ['#2a2d3c', '#30344a', '#262836', '#353a4f'][(v * 4) | 0];
      ctx.beginPath();
      ctx.roundRect(x + 0.4, y + 0.4, S - 0.8, S - 0.8, 0.8);
      ctx.fillStyle = lin(ctx, x, y, x + S, y + S, [[0, dark ? '#3a3c4a' : '#4c5269'], [0.3, base], [1, '#14151d']]);
      ctx.fill();
      path(ctx, [x + 1, y + 0.7, x + S - 1.5, y + 0.7], 'rgba(160,175,220,0.3)', 0.35);
      if (v > 0.9) path(ctx, [x + 2, y + 2, x + 3.5, y + 4, x + 3, y + 6], '#0b0c12', 0.4);
      if (v < 0.08) oval(ctx, x + 1, y + S - 1, 1.6, 0.8, '#2e3a22');
    }
  }
}

function planks(ctx, W, H, rnd) {
  const ph = 4;
  for (let y = 0; y < H; y += ph) {
    let x = -rnd() * 20;
    while (x < W) {
      const w = 18 + rnd() * 18;
      const v = rnd();
      const base = ['#553a25', '#4a3424', '#5e4230', '#3f2c1e'][(v * 4) | 0];
      rect(ctx, x, y, w, ph, lin(ctx, 0, y, 0, y + ph, [[0, '#77553a'], [0.25, base], [1, '#2a1c12']]));
      for (let k = 0; k < 3; k++) path(ctx, [x + 1, y + 1 + k * 0.9 + rnd() * 0.4, x + w - 1, y + 1 + k * 0.9 + rnd() * 0.4], 'rgba(30,18,10,0.35)', 0.3);
      rect(ctx, x, y, 0.5, ph, '#1e140c');
      oval(ctx, x + 1.5, y + 2, 0.35, 0.35, '#9aa0b4');
      oval(ctx, x + w - 1.5, y + 2, 0.35, 0.35, '#9aa0b4');
      x += w;
    }
    rect(ctx, 0, y + ph - 0.5, W, 0.5, '#1e140c');
  }
}

function steps(ctx, W, H) {
  for (let y = 0; y < H; y += 4) {
    rect(ctx, 0, y, W, 4, lin(ctx, 0, y, 0, y + 4, [[0, '#5a6078'], [0.2, '#3d4152'], [0.7, '#2c2f3d'], [1, '#14151d']]));
    path(ctx, [0, y + 0.3, W, y + 0.3], 'rgba(170,180,215,0.35)', 0.35);
  }
}

// ── стены ──────────────────────────────────────────────────────────────
function wallFace(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, TILE, TILE, lin(ctx, 0, y, 0, y + TILE, [[0, '#2c3346'], [1, '#161925']]));
  // карниз
  rect(ctx, x, y, TILE, 3, lin(ctx, 0, y, 0, y + 3, [[0, '#7b88a3'], [0.4, '#4a5470'], [1, '#232736']]));
  rect(ctx, x, y + 3, TILE, 0.6, '#05060c');
  // кладка со светотенью
  for (let row = 0; row < 3; row++) {
    const yy = y + 4 + row * 4;
    const off = (row + tx) & 1 ? 0 : 5;
    for (let bx = off - 10; bx < TILE; bx += 10) {
      const v = hash2(tx * 7 + bx, ty * 5 + row, s);
      ctx.beginPath();
      ctx.roundRect(x + bx + 0.3, yy + 0.3, 9.4, 3.4, 0.5);
      ctx.fillStyle = lin(ctx, 0, yy, 0, yy + 4, [[0, v > 0.7 ? '#4a5168' : '#3d4459'], [1, '#1d212d']]);
      ctx.fill();
    }
  }
  if (hash2(tx, ty, s) > 0.7) {
    path(ctx, [x + 5, y + 4, x + 5.5, y + 9, x + 4.5, y + 14], '#33462a', 0.9);
    for (let k = 0; k < 4; k++) oval(ctx, x + 4.5 + (k & 1), y + 6 + k * 2, 0.9, 0.6, k % 2 ? '#4a6a34' : '#6f9444');
  }
  rect(ctx, x, y + TILE - 0.5, TILE, 0.5, '#05060c');
}

function wallTop(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, TILE, TILE, '#101425');
  for (let i = 0; i < 3; i++) {
    const v = hash2(tx * 3 + i, ty, s);
    oval(ctx, x + 2 + v * 12, y + 3 + i * 5, 2 + v * 2, 1.2, v > 0.5 ? '#1a2038' : '#151a2e');
  }
}

function facade(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, TILE, TILE, lin(ctx, 0, y, 0, y + TILE, [[0, '#3a3248'], [1, '#221d2c']]));
  rect(ctx, x, y, TILE, 2, '#6a6f86');
  rect(ctx, x, y + 2, TILE, 0.6, '#05060c');
  if (tx % 2 === 0) {
    const lit = hash2(tx, ty, s + 4) > 0.75;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4.5, 8, 8.5, [3, 3, 0, 0]);
    ctx.fillStyle = '#05060c';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 4.8, y + 5.3, 6.4, 7.2, [2.6, 2.6, 0, 0]);
    ctx.fillStyle = lit ? lin(ctx, 0, y + 5, 0, y + 12.5, [[0, '#ffd27a'], [1, '#b8721f']]) : '#141a2e';
    ctx.fill();
    path(ctx, [x + 8, y + 5.3, x + 8, y + 12.5], '#05060c', 0.6);
    path(ctx, [x + 4.8, y + 8.6, x + 11.2, y + 8.6], '#05060c', 0.6);
    rect(ctx, x + 3.4, y + 13, 9.2, 1, '#6a6f86');
  } else if (hash2(tx, ty, s) > 0.6) path(ctx, [x + 6, y + 3, x + 6.5, y + 14], '#33462a', 0.9);
  rect(ctx, x, y + TILE - 0.5, TILE, 0.5, '#05060c');
}

function roof(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, TILE, TILE, '#1a1624');
  for (let j = 0; j < 4; j++) {
    const off = (j & 1) * 2;
    for (let i = off - 4; i < TILE; i += 4) {
      const er = hash2(tx * 8 + i, ty * 8 + j, s) > 0.88;
      ctx.beginPath();
      ctx.roundRect(x + i + 0.2, y + j * 4 + 0.6, 3.6, 3.2, [0, 0, 1.6, 1.6]);
      ctx.fillStyle = lin(ctx, 0, y + j * 4, 0, y + j * 4 + 4, [[0, er ? '#86163a' : '#4a2f40'], [1, er ? '#2a0610' : '#1e1622']]);
      ctx.fill();
    }
  }
}

function cliff(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, TILE, 6, lin(ctx, 0, y, 0, y + 6, [[0, '#4a5168'], [0.2, '#262a38'], [1, '#0d0e15']]));
  for (let i = 0; i < TILE; i += 1.5) {
    const d = hash2(tx * 16 + i * 3, ty, s) * 4;
    poly(ctx, [x + i, y + 6, x + i + 1.5, y + 6, x + i + 0.75, y + 6 + d], '#0d0e15');
  }
  path(ctx, [x, y + 0.3, x + TILE, y + 0.3], 'rgba(170,180,215,0.4)', 0.4);
}

// ── сборка ─────────────────────────────────────────────────────────────
export function paintTilesHd(ctx, room) {
  const W = room.w * TILE;
  const H = room.h * TILE;
  const s = room.seed;
  const rnd = mulberry32(s || 1);
  const layer = (pred, fn) => {
    ctx.save();
    if (clipTiles(ctx, room, pred)) fn();
    ctx.restore();
  };
  layer((t) => t === T.ASH, () => ground(ctx, W, H, rnd, false));
  layer((t) => t === T.GRASS, () => grassField(ctx, W, H, rnd));
  layer((t) => t === T.ROAD, () => dirtRoad(ctx, room, W, H, rnd));
  layer((t) => t === T.FLOOR, () => cobbles(ctx, W, H, rnd));
  layer((t) => t === T.PLAZA, () => flags(ctx, W, H, rnd, false));
  layer((t) => t === T.FLICKER, () => flags(ctx, W, H, rnd, true));
  layer((t) => t === T.WOOD, () => planks(ctx, W, H, rnd));
  layer((t) => t === T.STAIR, () => steps(ctx, W, H));
  // трава заходит на соседние тайлы неровным краем
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      if (tileOf(room, tx, ty) !== T.GRASS) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const o = tileOf(room, tx + dx, ty + dy);
        if (o === T.GRASS || o === T.WALL || o === T.VOID) continue;
        for (let k = 0; k < 3; k++) {
          const ex = tx * TILE + 8 + dx * 8 + (dy ? (rnd() - 0.5) * 14 : dx * rnd() * -2);
          const ey = ty * TILE + 8 + dy * 8 + (dx ? (rnd() - 0.5) * 14 : dy * rnd() * -2) + 2;
          tuft(ctx, ex, ey, rnd);
        }
      }
    }
  }
  for (let ty = 0; ty < room.h; ty++) {
    for (let tx = 0; tx < room.w; tx++) {
      const t = tileOf(room, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (t === T.WALL) {
        const below = tileOf(room, tx, ty + 1);
        const city = room.def?.walls === 'city';
        if (below !== T.WALL) (city ? facade : wallFace)(ctx, x, y, tx, ty, s);
        else (city ? roof : wallTop)(ctx, x, y, tx, ty, s);
        continue;
      }
      if (t === T.VOID) {
        ctx.clearRect(x, y, TILE, TILE);
        const above = tileOf(room, tx, ty - 1);
        if (above !== T.VOID && above !== T.WALL) cliff(ctx, x, y, tx, ty, s);
        continue;
      }
      // мягкая тень от стены сверху
      if (tileOf(room, tx, ty - 1) === T.WALL) rect(ctx, x, y, TILE, 8, lin(ctx, 0, y, 0, y + 8, [[0, 'rgba(5,6,12,0.65)'], [1, 'rgba(5,6,12,0)']]));
      if (t === T.FLICKER) {
        const r = hash2(tx, ty, s + 13);
        if (r > 0.45) {
          const pts = [x + 3 + r * 6, y + 4, x + 4 + r * 6, y + 8, x + 7 + r * 6, y + 9, x + 8 + r * 5, y + 12];
          path(ctx, pts, '#05060c', 1);
          path(ctx, pts, '#86163a', 0.45);
        }
      }
    }
  }
}
