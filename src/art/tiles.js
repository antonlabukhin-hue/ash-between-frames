// Тайлы 16×16, нарисованные кодом. Статичная часть комнаты кэшируется в один холст.
import { P } from './palette.js';
import { hash2 } from '../core/math.js';

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
  const big = ((tx >> 1) + (ty >> 1)) & 1;
  rect(ctx, x, y, 16, 16, big ? P.stone1 : P.stone2);
  if ((tx & 1) === 0) rect(ctx, x, y, 1, 16, P.stone0);
  if ((ty & 1) === 0) rect(ctx, x, y, 16, 1, P.stone0);
  if ((tx & 1) === 0 && (ty & 1) === 0) rect(ctx, x + 1, y + 1, 14, 1, P.stone3);
  if (hash2(tx, ty, s) > 0.8) rect(ctx, x + 4, y + 9, 6, 1, P.ink); // трещина
}

function wood(ctx, x, y, tx, ty) {
  for (let i = 0; i < 4; i++) {
    const c = (i + tx) & 1 ? P.wood : P.woodHi;
    rect(ctx, x, y + i * 4, 16, 4, c);
    rect(ctx, x, y + i * 4 + 3, 16, 1, P.ink);
    rect(ctx, x + ((tx * 5 + i * 7 + ty) % 16), y + i * 4, 1, 3, P.ink);
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
    if (below !== T.WALL) wallFace(ctx, x, y, tx, ty, s);
    else wallTop(ctx, x, y, tx, ty, s);
    return;
  }
  if (t === T.VOID) {
    rect(ctx, x, y, 16, 16, P.void);
    const above = ty > 0 ? room.tiles[(ty - 1) * room.w + tx] : T.VOID;
    if (above !== T.VOID && above !== T.WALL) cliff(ctx, x, y, tx, ty, s);
    return;
  }
  (DRAW[t] || cobble)(ctx, x, y, tx, ty, s);
  // тень от стены сверху
  const above = ty > 0 ? room.tiles[(ty - 1) * room.w + tx] : T.FLOOR;
  if (above === T.WALL) {
    ctx.fillStyle = 'rgba(5,6,12,0.55)';
    ctx.fillRect(x, y, 16, 4);
    ctx.fillStyle = 'rgba(5,6,12,0.3)';
    ctx.fillRect(x, y + 4, 16, 3);
  }
  if (t === T.FLICKER) {
    // разметка стирающейся плиты — пунктир по краю
    ctx.fillStyle = P.crimson0;
    for (let i = 0; i < 16; i += 4) {
      ctx.fillRect(x + i, y, 2, 1);
      ctx.fillRect(x + i + 2, y + 15, 2, 1);
    }
  }
}

export function buildRoomCanvas(room) {
  const c = document.createElement('canvas');
  c.width = room.w * TILE;
  c.height = room.h * TILE;
  const ctx = c.getContext('2d');
  for (let ty = 0; ty < room.h; ty++) for (let tx = 0; tx < room.w; tx++) drawTile(ctx, room, tx, ty);
  return c;
}
