// Разбор карты комнаты из строк и столкновения. Без DOM — покрыто тестами.
import { T, CHAR_TILE, TILE } from '../art/tiles.js';

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// def.map — массив строк. Символы тайлов — см. CHAR_TILE, остальные — маркеры
// (точки появления, объекты), под ними пол def.floor (по умолчанию «.»).
export function parseRoom(def) {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const tiles = new Uint8Array(w * h);
  const markers = {};
  const floorChar = def.floor ?? '.';
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty][tx] ?? '#';
      let t = CHAR_TILE[ch];
      if (t === undefined) {
        const under = def.under?.[ch] ?? floorChar;
        t = CHAR_TILE[under] ?? T.FLOOR;
        (markers[ch] ||= []).push({ tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
      }
      tiles[ty * w + tx] = t;
    }
  }
  return { id: def.id, w, h, tiles, markers, seed: def.seed ?? hashString(def.id || 'room') % 100000, pxW: w * TILE, pxH: h * TILE, def };
}

export function tileAt(room, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return T.WALL;
  return room.tiles[ty * room.w + tx];
}

export const tileAtPx = (room, x, y) => tileAt(room, Math.floor(x / TILE), Math.floor(y / TILE));

export function setTile(room, tx, ty, t) {
  if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return;
  room.tiles[ty * room.w + tx] = t;
}

function boxBlocked(x, y, hw, hh, blocked) {
  return (
    blocked(x - hw, y - hh) || blocked(x + hw, y - hh) || blocked(x - hw, y + hh) || blocked(x + hw, y + hh) ||
    (hw > 7 && (blocked(x, y - hh) || blocked(x, y + hh))) ||
    (hh > 7 && (blocked(x - hw, y) || blocked(x + hw, y)))
  );
}

// Движение прямоугольника «ног» с раздельными осями — скольжение вдоль стен.
export function moveBox(x, y, hw, hh, dx, dy, blocked) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 3));
  const sx = dx / steps;
  const sy = dy / steps;
  let hitX = false;
  let hitY = false;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      if (!boxBlocked(x + sx, y, hw, hh, blocked)) x += sx;
      else hitX = true;
    }
    if (sy) {
      if (!boxBlocked(x, y + sy, hw, hh, blocked)) y += sy;
      else hitY = true;
    }
  }
  return { x, y, hitX, hitY };
}

export const pointInRect = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

// Прямая видимость по тайлам-стенам (для стрелков).
export function lineOfSight(room, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (tileAtPx(room, ax + (bx - ax) * t, ay + (by - ay) * t) === T.WALL) return false;
  }
  return true;
}
