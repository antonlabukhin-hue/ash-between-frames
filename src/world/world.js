// Запросы к миру: стены, пустоты, твёрдые объекты, свет.
import { TILE, T } from '../art/tiles.js';
import { tileAt, pointInRect } from './room.js';
import { propFoot, propWalkRect, PROP_KINDS } from './props.js';
import { PAST } from '../timeline/timeline.js';
import { dist2 } from '../core/math.js';
import { inIslands } from './memory.js';

// Стирающаяся плита сейчас пустая? Решает сценарий комнаты (room.flickerOn).
function flickerVoid(g, tx, ty) {
  const fn = g.room.flickerOn;
  if (!fn || !fn(g, tx, ty)) return false;
  // камни памяти в прошлом удерживают плиты рядом
  const cx = tx * TILE + 8;
  const cy = ty * TILE + 8;
  for (const p of g.props) {
    const r = p.def.protect?.[p.tl.phase];
    if (r && dist2(cx, cy, p.x, p.y) < r * r) return false;
  }
  // в острове памяти плиты целы
  if (g.memIslands?.length && inIslands(g.memIslands, cx, cy)) return false;
  return true;
}

export function isPit(g, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const t = tileAt(g.room, tx, ty);
  let pit = t === T.VOID || (t === T.FLICKER && (g.room.pitAt ? g.room.pitAt(g, x, y) : flickerVoid(g, tx, ty)));
  for (const z of g.voidZones) if (z.active && dist2(x, y, z.x, z.y) < z.r * z.r) pit = true;
  if (!pit) return false;
  for (const p of g.props) {
    const r = propWalkRect(p);
    if (r && pointInRect(x, y, r)) return false;
  }
  return true;
}

// Надёжная земля — пол, который не исчезнет сам: не пустота, не стирающаяся плита, не трещина
// и не временный мост. Только здесь запоминаем, куда вернуть героя после падения.
const NO_ISLANDS = { memIslands: [] };
export function isStableGround(g, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const t = tileAt(g.room, tx, ty);
  if (t === T.VOID || t === T.FLICKER || t === T.WALL || t == null) return false;
  if (g.room.pitAt && g.room.pitAt(NO_ISLANDS, x, y)) return false;
  for (const z of g.voidZones) if (dist2(x, y, z.x, z.y) < (z.r + 6) * (z.r + 6)) return false;
  return true;
}

export function isWall(g, x, y) {
  return tileAt(g.room, Math.floor(x / TILE), Math.floor(y / TILE)) === T.WALL;
}

export function solidPropAt(g, x, y) {
  for (const p of g.props) {
    const f = propFoot(p);
    if (f && pointInRect(x, y, f)) return p;
    if (p.kind === 'gate' && p.closed && pointInRect(x, y, p)) return p;
  }
  return null;
}

// Для героя пустота не стена — в неё можно упасть.
export const heroBlocked = (g) => (x, y) => isWall(g, x, y) || !!solidPropAt(g, x, y);
// Враги в пустоту не идут (кроме летающих).
export const enemyBlocked = (g, flying = false) => (x, y) =>
  isWall(g, x, y) || !!solidPropAt(g, x, y) || (!flying && isPit(g, x, y));

// Источники света для слоя освещения и для проявления Кадровиков.
export function collectLights(g) {
  const out = [];
  for (const p of g.props) {
    const r = p.def.light?.[p.tl.phase];
    if (!r) continue;
    const c = p.lightColor || p.def.lightColor?.[p.tl.phase] || (p.tl.phase === PAST ? 'amber' : 'cold');
    out.push({ x: p.x, y: p.y - (p.def.lightY ?? 12), base: p.y, r, c, reveal: p.def.reveal?.[p.tl.phase] || 0 });
  }
  // постоянные источники комнаты (зарево провала и т.п.)
  for (const l of g.room?.def.lights || []) out.push(l);
  for (const pr of g.projectiles) if (pr.light) out.push({ x: pr.x, y: pr.y, r: pr.light, c: 'cold' });
  // записки и обрывки на земле светятся тёплым — их видно издалека
  for (const pk of g.pickups || []) if (pk.kind === 'scrap') out.push({ x: pk.x, y: pk.y - 4, r: 34, c: 'amber' });
  return out;
}

export function revealedAt(g, x, y) {
  for (const p of g.props) {
    const r = p.def.reveal?.[p.tl.phase];
    if (r && dist2(x, y, p.x, p.y) < r * r) return true;
  }
  return false;
}

export const propDefs = PROP_KINDS;
