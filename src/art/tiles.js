// Тайлы 16×16, нарисованные кодом. Статичная часть комнаты кэшируется в один холст.
import { P } from './palette.js';
import { hash2 } from '../core/math.js';
import { upscaleCanvas } from './upscale.js';
import { RS } from '../core/frame.js';
import { hd } from './hdflag.js';
import { paintTilesHd } from './tiles32.js';

export const TILE = 16;

// Коды тайлов.
export const T = {
  VOID: 0,
  FLOOR: 1, // булыжник
  WALL: 2,
  ROAD: 3,
  ASH: 4,
  GRASS: 5,
  FLICKER: 6, // стирающийся участок
  STAIR: 7,
  PLAZA: 8,
  WOOD: 9,
};

export const CHAR_TILE = {
  ' ': T.VOID, '.': T.FLOOR, '#': T.WALL, '=': T.ROAD, ',': T.ASH, '"': T.GRASS,
  ':': T.FLICKER, '_': T.STAIR, '+': T.PLAZA, 'w': T.WOOD,
};

export const isWallTile = (t) => t === T.WALL;
export const isVoidTile = (t) => t === T.VOID;

function rect(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function cobble(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.stone0);
  // 4 камня со сдвигом рядов
  const off = (ty & 1) * 4;
  const stones = [
    [0 + off, 1, 7, 6], [8 + off, 1, 7, 6], [-8 + off, 1, 7, 6],
    [4 - off, 9, 7, 6], [12 - off, 9, 7, 6], [-4 - off, 9, 7, 6],
  ];
  stones.forEach(([sx, sy, w, h], i) => {
    const r = hash2(tx * 7 + i, ty * 13 + i, s);
    const base = r < 0.15 ? P.stone2 : r < 0.75 ? P.stone1 : P.ash1;
    const cx = Math.max(0, sx);
    const cw = Math.min(16, sx + w) - cx;
    if (cw <= 0) return;
    rect(ctx, x + cx, y + sy, cw, h, base);
    rect(ctx, x + cx, y + sy, cw, 1, P.stone3);
    rect(ctx, x + cx, y + sy + h - 1, cw, 1, P.ink);
    if (r > 0.9) rect(ctx, x + cx + 2, y + sy + 2, 2, 1, P.ash3); // скол
  });
  // мокрые блики как на референсе
  if (hash2(tx, ty, s + 9) > 0.86) {
    rect(ctx, x + 3, y + 7, 5, 1, P.slate);
    rect(ctx, x + 4, y + 8, 3, 1, P.amber0);
  }
}

function road(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.ash1);
  for (let i = 0; i < 14; i++) {
    const r = hash2(tx * 31 + i, ty * 17 - i, s);
    const px = Math.floor(r * 16);
    const py = Math.floor(hash2(i, tx + ty * 3, s + 1) * 16);
    rect(ctx, x + px, y + py, 1, 1, r > 0.5 ? P.ash0 : P.ash2);
  }
  // колеи
  rect(ctx, x, y + 4, 16, 1, P.ash0);
  rect(ctx, x, y + 11, 16, 1, P.ash0);
  if (hash2(tx, ty, s + 3) > 0.7) rect(ctx, x + 6, y + 7, 3, 2, P.stone2);
}

function ashGround(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.ash0);
  for (let i = 0; i < 18; i++) {
    const r = hash2(tx * 5 + i, ty * 11 + i * 3, s);
    rect(ctx, x + Math.floor(r * 16), y + Math.floor(hash2(i * 7, tx - ty, s) * 16), 1, 1, r > 0.7 ? P.ash2 : P.ash1);
  }
  if (hash2(tx, ty, s + 5) > 0.8) {
    rect(ctx, x + 9, y + 4, 2, 1, P.amber0); // тлеющая крошка
  }
}

function grass(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.moss);
  for (let i = 0; i < 10; i++) {
    const gx = Math.floor(hash2(tx * 3 + i, ty, s) * 15);
    const gy = Math.floor(hash2(tx, ty * 3 + i, s) * 13) + 2;
    const c = hash2(i, tx + ty, s) > 0.5 ? P.leaf : P.leafHi;
    rect(ctx, x + gx, y + gy, 1, 3, c);
    rect(ctx, x + gx + 1, y + gy - 1, 1, 2, P.amber0);
  }
}

function stair(ctx, x, y) {
  for (let i = 0; i < 4; i++) {
    rect(ctx, x, y + i * 4, 16, 4, P.stone1);
    rect(ctx, x, y + i * 4, 16, 1, P.stone3);
    rect(ctx, x, y + i * 4 + 3, 16, 1, P.stone0);
  }
}

function plaza(ctx, x, y, tx, ty, s) {
  // плиты 8×8 со сдвигом рядов, трещины, мох в стыках
  rect(ctx, x, y, 16, 16, P.stone0);
  for (let j = 0; j < 2; j++) {
    const off = ((ty * 2 + j) & 1) * 4;
    for (let i = -1; i < 2; i++) {
      const sx = i * 8 + off;
      const cx = Math.max(0, sx);
      const cw = Math.min(16, sx + 7) - cx;
      if (cw <= 0) continue;
      const r = hash2(tx * 4 + i, ty * 4 + j, s);
      const c = r > 0.8 ? P.stone2 : r > 0.25 ? P.stone1 : '#262838';
      rect(ctx, x + cx, y + j * 8, cw, 7, c);
      rect(ctx, x + cx, y + j * 8, cw, 1, r > 0.5 ? P.stone2 : P.stone1);
      if (r > 0.93) rect(ctx, x + cx + 1, y + j * 8 + 3, 3, 1, P.ink);
      if (r < 0.05) rect(ctx, x + cx, y + j * 8 + 6, 2, 1, P.moss);
    }
  }
  if (hash2(tx, ty, s + 7) > 0.9) {
    rect(ctx, x + 6, y + 4, 4, 1, P.slate);
    rect(ctx, x + 7, y + 5, 3, 1, P.amber0);
  }
}

function wood(ctx, x, y, tx, ty, s) {
  // доски вдоль, стыки вразбежку, оттенок у каждой доски свой
  for (let i = 0; i < 4; i++) {
    const row = ty * 4 + i;
    const seam = Math.floor(hash2(row, 3, s) * 32);
    const lx = (tx * 16) % 32;
    const plank = Math.floor((lx + 32 - seam) / 32) + tx;
    const r = hash2(plank, row, s);
    rect(ctx, x, y + i * 4, 16, 4, r > 0.66 ? P.woodHi : r > 0.33 ? '#5a3f2c' : P.wood);
    rect(ctx, x, y + i * 4 + 3, 16, 1, '#2e2018');
    const sx = (seam - lx + 32) % 32;
    if (sx < 16) rect(ctx, x + sx, y + i * 4, 1, 3, '#2e2018');
    if (hash2(tx + i, ty, s + 2) > 0.85) rect(ctx, x + 5, y + i * 4 + 1, 2, 1, '#2e2018');
  }
}

function wallTop(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.night);
  if (hash2(tx, ty, s) > 0.5) rect(ctx, x + 3, y + 5, 4, 3, P.navy);
  if (hash2(ty, tx, s) > 0.6) rect(ctx, x + 9, y + 10, 3, 2, P.navy);
}

function wallFace(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, P.stone1);
  // карниз
  rect(ctx, x, y, 16, 3, P.stone3);
  rect(ctx, x, y + 3, 16, 1, P.ink);
  // кладка
  for (let row = 0; row < 3; row++) {
    const yy = y + 4 + row * 4;
    rect(ctx, x, yy + 3, 16, 1, P.stone0);
    const off = (row + tx) & 1 ? 0 : 5;
    for (let bx = off; bx < 16; bx += 10) rect(ctx, x + bx, yy, 1, 3, P.stone0);
  }
  if (hash2(tx, ty, s) > 0.7) {
    rect(ctx, x + 5, y + 8, 1, 6, P.moss); // плющ
    rect(ctx, x + 4, y + 10, 1, 2, P.leaf);
  }
  rect(ctx, x, y + 15, 16, 1, P.ink);
}

// Фасад городского дома: штукатурка, окна (редкие светятся), карниз.
function facade(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, '#30293a');
  rect(ctx, x, y, 16, 2, P.stone3);
  rect(ctx, x, y + 2, 16, 1, P.ink);
  if (tx % 2 === 0) {
    const lit = hash2(tx, ty, s + 4) > 0.75;
    rect(ctx, x + 4, y + 5, 8, 8, P.ink);
    rect(ctx, x + 5, y + 6, 6, 6, lit ? P.amber1 : P.night);
    if (lit) rect(ctx, x + 5, y + 6, 2, 2, P.amberHi);
    rect(ctx, x + 7, y + 6, 1, 6, P.ink);
    rect(ctx, x + 5, y + 8, 6, 1, P.ink);
    rect(ctx, x + 3, y + 13, 10, 1, P.stone3);
  } else if (hash2(tx, ty, s) > 0.6) {
    rect(ctx, x + 6, y + 4, 1, 10, P.moss);
  }
  rect(ctx, x, y + 15, 16, 1, P.ink);
}

// Крыши: черепица рядами.
function roof(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 16, '#1e1a28');
  for (let j = 0; j < 4; j++) {
    const off = (j & 1) * 2;
    for (let i = off; i < 16; i += 4) rect(ctx, x + i, y + j * 4 + 2, 3, 2, hash2(tx * 8 + i, ty * 8 + j, s) > 0.85 ? P.crimson0 : '#2c2638');
  }
}

// Обрыв: передняя стенка пола над пустотой.
function cliff(ctx, x, y, tx, ty, s) {
  rect(ctx, x, y, 16, 6, P.stone0);
  rect(ctx, x, y, 16, 1, P.stone2);
  for (let i = 0; i < 16; i += 2) {
    const d = Math.floor(hash2(tx * 16 + i, ty, s) * 4);
    rect(ctx, x + i, y + 6, 2, d, P.stone0);
  }
}

const DRAW = {
  [T.FLOOR]: cobble, [T.ROAD]: road, [T.ASH]: ashGround, [T.GRASS]: grass,
  [T.STAIR]: stair, [T.PLAZA]: plaza, [T.WOOD]: wood, [T.FLICKER]: road,
};

// Пол под стенами/пустотой — для обрывов и подложки.
export function drawTile(ctx, room, tx, ty) {
  const t = room.tiles[ty * room.w + tx];
  const x = tx * TILE;
  const y = ty * TILE;
  const s = room.seed;
  if (t === T.WALL) {
    const below = ty + 1 < room.h ? room.tiles[(ty + 1) * room.w + tx] : T.WALL;
    const city = room.def?.walls === 'city';
    if (below !== T.WALL) (city ? facade : wallFace)(ctx, x, y, tx, ty, s);
    else (city ? roof : wallTop)(ctx, x, y, tx, ty, s);
    return;
  }
  if (t === T.VOID) {
    // пустота — дыра в холсте комнаты: под ней один анимированный узор на весь кадр
    ctx.clearRect(x, y, 16, 16);
    const above = ty > 0 ? room.tiles[(ty - 1) * room.w + tx] : T.VOID;
    if (above !== T.VOID && above !== T.WALL) cliff(ctx, x, y, tx, ty, s);
    return;
  }
  (DRAW[t] || cobble)(ctx, x, y, tx, ty, s);
  // мягкий край травы: зубцы чужого тайла заходят на траву
  if (t === T.GRASS) {
    const at = (dx, dy) => (tx + dx < 0 || ty + dy < 0 || tx + dx >= room.w || ty + dy >= room.h ? T.GRASS : room.tiles[(ty + dy) * room.w + tx + dx]);
    const edge = (dx, dy, other) => {
      if (other === T.GRASS || other === T.WALL || other === T.VOID) return;
      const col = other === T.ROAD ? P.ash1 : P.ash0;
      for (let i = 0; i < 16; i++) {
        const d = Math.floor(hash2(tx * 16 + i, ty * 16 + dx * 3 + dy * 7, s) * 4);
        if (dx) rect(ctx, dx < 0 ? x : x + 16 - d, y + i, d, 1, col);
        else rect(ctx, x + i, dy < 0 ? y : y + 16 - d, 1, d, col);
      }
    };
    edge(-1, 0, at(-1, 0));
    edge(1, 0, at(1, 0));
    edge(0, -1, at(0, -1));
    edge(0, 1, at(0, 1));
  }
  // тень от стены сверху
  const above = ty > 0 ? room.tiles[(ty - 1) * room.w + tx] : T.FLOOR;
  if (above === T.WALL) {
    ctx.fillStyle = 'rgba(5,6,12,0.55)';
    ctx.fillRect(x, y, 16, 4);
    ctx.fillStyle = 'rgba(5,6,12,0.3)';
    ctx.fillRect(x, y + 4, 16, 3);
  }
  if (t === T.FLICKER) {
    // стирающаяся плита: редкие малиновые трещины
    const r = hash2(tx, ty, s + 13);
    if (r > 0.55) {
      rect(ctx, x + 3 + Math.floor(r * 6), y + 5, 1, 4, P.crimson0);
      rect(ctx, x + 4 + Math.floor(r * 6), y + 8, 3, 1, P.crimson0);
    }
  }
}

// Комната печатается в логических пикселях и удваивается Scale2x в 32-битную сетку
// (холст помечен полем rs — во сколько раз он плотнее мира).
export function buildRoomCanvas(room) {
  // обычная комната в 32-битном режиме печатается сразу в плотной сетке
  if (hd.on && RS > 1 && !room.def?.paint) {
    const out = document.createElement('canvas');
    out.width = room.w * TILE * RS;
    out.height = room.h * TILE * RS;
    out.rs = RS;
    const hctx = out.getContext('2d');
    hctx.scale(RS, RS);
    paintTilesHd(hctx, room);
    room.def?.paintHd?.(hctx, room);
    return out;
  }
  const c = document.createElement('canvas');
  c.width = room.w * TILE;
  c.height = room.h * TILE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  // комнаты нового стиля запекаются своим «маляром» целиком
  if (room.def?.paint) room.def.paint(ctx, room);
  else for (let ty = 0; ty < room.h; ty++) for (let tx = 0; tx < room.w; tx++) drawTile(ctx, room, tx, ty);
  const out = dense(room, c);
  // детали в плотной сетке (блики луж, тонкие швы) — поверх удвоенной комнаты
  if (room.def?.paintHd) {
    const hd = out.getContext('2d');
    hd.save();
    hd.scale(out.rs || 1, out.rs || 1);
    room.def.paintHd(hd, room);
    hd.restore();
  }
  return out;
}

function dense(room, c) {
  if (RS === 1) return c;
  const out = upscaleCanvas(c, RS);
  out.rs = RS;
  if (room.pastCanvas && !room.pastCanvas.rs) {
    room.pastCanvas = upscaleCanvas(room.pastCanvas, RS);
    room.pastCanvas.rs = RS;
  }
  return out;
}
