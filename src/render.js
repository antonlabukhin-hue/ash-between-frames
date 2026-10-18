// Отрисовка комнаты: параллакс, пол, пустоты, объекты, персонажи по глубине, эффекты, свет, HUD.
// Персонажи и декор выводятся из атласа (src/art/spritecache.js), невидимое отсекается,
// частицы — из пула, свет — ступенчатые маски. Лимиты — docs/PERFORMANCE_BUDGET.md.
import { W, H } from './core/renderer.js';
import { P, PHASE_COLOR } from './art/palette.js';
import { TILE, T } from './art/tiles.js';
import { tileAt } from './world/room.js';
import { px, line, disc, ring, setShadowStyle, shadow } from './art/sprites.js';
import { propSortY, propCenter } from './world/props.js';
import { isPhased } from './enemies/enemies.js';
import { isShifted, isFading, PAST, PRESENT, otherPhase, channelProgress } from './timeline/timeline.js';
import { inPerfectWindow } from './combat/combo.js';
import { drawHud, drawDigits, digitsWidth } from './ui/hud.js';
import { hash2 } from './core/math.js';
import { atlas, drawHeroC, drawEnemyC, drawMelC } from './art/spritecache.js';
import { blit } from './art/atlas.js';
import { lightMask } from './art/lightmask.js';

const OUTLINE = '#05060c';
let lightCanvas = null;
let lightCtx = null;

function ensureLight() {
  if (lightCanvas && lightCanvas.width === W / 2 && lightCanvas.height === H / 2) return;
  lightCanvas = document.createElement('canvas');
  lightCanvas.width = W / 2;
  lightCanvas.height = H / 2;
  lightCtx = lightCanvas.getContext('2d');
}

export const lightLayerBytes = () => (lightCanvas ? lightCanvas.width * lightCanvas.height * 4 : 0);

const SHADOW_W = { hollow: 12, framer: 8, ringer: 14, shadow: 18, eater: 22 };

// Видимая область мира с полем (высокие спрайты торчат вверх).
let view = { x0: 0, y0: 0, x1: 0, y1: 0 };
const visible = (x, y, up = 64, side = 40) => x > view.x0 - side && x < view.x1 + side && y > view.y0 - 8 && y - up < view.y1;

function drawVoidLayer(g, ctx, x0, y0, x1, y1) {
  const room = g.room;
  const t = g.time;
  const per = g.quality.id === 'low' ? 1 : g.quality.id === 'medium' ? 2 : 3;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const tile = tileAt(room, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (tile === T.FLICKER && room.flickerState) {
        const st = room.flickerState(g, tx, ty);
        if (st === 'warn') {
          if (Math.floor(t * 10) % 2) {
            ctx.fillStyle = 'rgba(200,40,74,0.35)';
            ctx.fillRect(x, y, TILE, TILE);
          }
        } else if (st === 'void') {
          ctx.fillStyle = P.void;
          ctx.fillRect(x, y, TILE, TILE);
          voidSquares(ctx, x, y, tx, ty, t, per);
        }
        continue;
      }
      if (tile !== T.VOID) continue;
      voidSquares(ctx, x, y, tx, ty, t, per);
    }
  }
}

// Дрейфующие квадраты Стирания в пустоте (число на тайл — по профилю).
function voidSquares(ctx, x, y, tx, ty, t, per) {
  for (let i = 0; i < per; i++) {
    const r = hash2(tx * 3 + i, ty * 7, 11);
    if (per < 3 && r < 0.3) continue;
    const speed = 4 + r * 8;
    const yy = (y + 16 - ((t * speed + r * 16) % 16)) | 0;
    const xx = (x + hash2(tx, ty * 5 + i, 3) * 15) | 0;
    ctx.fillStyle = r > 0.8 ? P.crimson1 : r > 0.4 ? P.crimson0 : '#0d0a18';
    ctx.fillRect(xx, yy, r > 0.85 ? 2 : 1, r > 0.85 ? 2 : 1);
  }
}

// ── объекты через атлас ─────────────────────────────────────────────────
// Кадр декора: цикл по fps; в Шраме каждый третий кадр пропускается (рывки), на Low — реже.
function propFrame(g, c, phase) {
  if (!c.frames || c.frames <= 1) return 0;
  const fps = g.quality.decorAnim ? c.fps : c.fps / 3;
  let f = Math.floor(g.time * fps);
  if (phase === PRESENT && f % 3 === 2) f -= 1;
  return f % c.frames;
}

function propEntry(g, p, phase) {
  const c = p.def.cache;
  const frame = propFrame(g, c, phase);
  const inst = c.inst ? c.inst(p) : '';
  const key = `p|${p.kind}|${phase}|${frame}|${inst}`;
  return atlas.sprite(key, c.w, c.h, c.ax, c.ay, (bctx, ax, ay) => {
    const tl = { ...p.tl, phase };
    p.def.draw(bctx, { ...p, x: ax, y: ay, tl }, { time: c.fps ? frame / c.fps : 0, quality: g.quality });
  });
}

export function drawProp(g, ctx, p) {
  const c = p.def.cache;
  if (!c || p.nocache) {
    p.def.draw(ctx, p, g);
    return;
  }
  const tl = p.tl;
  const e = propEntry(g, p, tl.phase);
  if (tl.flash > 0 && tl.switchable) {
    transition(g, ctx, e, propEntry(g, p, otherPhase(tl.phase)), p.x, p.y, tl, `p${p.id}`);
    return;
  }
  blit(ctx, e, p.x, p.y);
}

// Переход между состояниями — 8 кадров (≈0,27 с): янтарный контур → двойной контур →
// сдвиг старой версии → малиновые трещины → кадр без деталей → новая версия → след.
function transition(g, ctx, cur, old, x, y, tl, id) {
  const f = Math.min(7, Math.floor((1 - tl.flash) * 8));
  const amber = (e) => atlas.tinted(e.key, e, P.amber);
  const crimson = (e) => atlas.tinted(e.key, e, P.crimson);
  if (f === 0) {
    blit(ctx, amber(old), x - 1, y);
    blit(ctx, amber(old), x + 1, y);
    blit(ctx, old, x, y);
  } else if (f === 1) {
    blit(ctx, amber(old), x - 2, y);
    blit(ctx, crimson(old), x + 2, y);
    blit(ctx, old, x + 1, y);
  } else if (f === 2) {
    blit(ctx, old, x + 1, y);
    for (let i = 0; i < 6; i++) {
      const hx = x - old.ax + hash2(i, tl.flash * 100, 3) * old.w;
      const hy = y - old.ay + hash2(tl.flash * 100, i, 4) * old.h;
      px(ctx, hx, hy, 1, 3, P.crimsonHi);
      px(ctx, hx + 1, hy + 2, 2, 1, P.crimsonHi);
    }
  } else if (f === 3) {
    blit(ctx, atlas.tinted(cur.key, cur, P.slate), x, y);
  } else {
    ctx.globalAlpha = (7 - f) / 6;
    blit(ctx, (tl.phase === PAST ? amber : crimson)(cur), x - (8 - f), y);
    ctx.globalAlpha = 1;
    blit(ctx, cur, x, y);
  }
  void id;
}

function drawEnemy(g, ctx, e) {
  if (e.draw) {
    e.draw(ctx, e, g);
    return;
  }
  if (e.spawn > 0) {
    // собирается из квадратов
    const k = 1 - e.spawn / 0.6;
    for (let i = 0; i < 12; i++) {
      const r = hash2(e.id, i, 1);
      const a = r * Math.PI * 2;
      const d = (1 - k) * 18;
      px(ctx, e.x + Math.cos(a) * d - 1, e.y - 8 + Math.sin(a) * d * 0.7 - hash2(i, e.id, 2) * 10, 2, 2, i % 2 ? P.crimson : P.ink);
    }
    return;
  }
  if (e.kind === 'echo') {
    ctx.globalAlpha = 0.65;
    drawHeroC(ctx, e.x, e.y, { dir: 'down', t: e.t, aim: e.face, charges: 0 }, Math.floor(e.t * 20) % 3 ? P.crimson : P.crimsonHi);
    ctx.globalAlpha = 1;
    return;
  }
  const o = {
    phase: e.tl.phase, t: e.t, walk: e.walk, windup: e.state === 'windup', lunge: e.state === 'lunge',
    charge: e.charge, look: e.look, shield: e.kind === 'shadow' && !(e.exposed > 0),
  };
  if (e.kind === 'framer' && isPhased(g, e)) {
    // пропущенный кадр: почти невидим
    if (Math.floor(e.t * 30) % 5 === 0) {
      ctx.globalAlpha = 0.25;
      drawEnemyC(ctx, 'framer', e.x + (Math.random() > 0.5 ? 1 : -1), e.y, o, P.crimson);
      ctx.globalAlpha = 1;
    }
    return;
  }
  shadow(ctx, e.x, e.y, SHADOW_W[e.kind] ?? 12);
  const flash = e.flash > 0;
  const shifted = isShifted(e.tl);
  const fading = isFading(e.tl) && Math.floor(g.time * 10) % 2 === 0;
  if (e.tl.flash > 0) {
    // переход фазы: старая версия со сдвигом и двойным контуром, потом новая
    const f = Math.floor((1 - e.tl.flash) * 8);
    const oldO = { ...o, phase: otherPhase(e.tl.phase) };
    if (f < 3) {
      drawEnemyC(ctx, e.kind, e.x - 1, e.y, oldO, P.amber);
      drawEnemyC(ctx, e.kind, e.x + 2, e.y, oldO, P.crimson);
      drawEnemyC(ctx, e.kind, e.x + (f > 0 ? 1 : 0), e.y, oldO);
      return;
    }
    if (f === 3) {
      drawEnemyC(ctx, e.kind, e.x, e.y, o, P.slate);
      return;
    }
  }
  if (shifted && !fading) {
    const c = PHASE_COLOR[e.tl.phase];
    drawEnemyC(ctx, e.kind, e.x - 1, e.y, o, c);
    drawEnemyC(ctx, e.kind, e.x + 1, e.y, o, c);
    drawEnemyC(ctx, e.kind, e.x, e.y - 1, o, c);
  }
  drawEnemyC(ctx, e.kind, e.x, e.y, o, flash ? '#ffffff' : null);
  if (e.kind === 'shadow') drawEnemyC(ctx, e.kind, e.x, e.y, { ...o, layer: 'front' }, flash ? '#ffffff' : null);
  if (e.burn > 0 && Math.floor(g.time * 12) % 2) px(ctx, e.x - 2 + Math.random() * 4, e.y - 18 - Math.random() * 6, 1, 2, P.amberHi);
}


function drawPickup(ctx, pk, t) {
  const bob = Math.round(Math.sin(t * 5 + pk.seed) * 1.5);
  const x = Math.round(pk.x);
  const y = Math.round(pk.y);
  px(ctx, x - 2, y, 5, 1, 'rgba(3,4,10,0.5)');
  if (pk.kind === 'ash') {
    px(ctx, x - 1, y - 4 + bob, 3, 3, P.ash3);
    px(ctx, x, y - 4 + bob, 1, 1, P.amberHi);
  } else if (pk.kind === 'shard') {
    px(ctx, x, y - 8 + bob, 1, 7, P.teal);
    px(ctx, x - 1, y - 6 + bob, 3, 3, P.teal);
    px(ctx, x, y - 6 + bob, 1, 2, P.tealHi);
  } else if (pk.kind === 'heal') {
    px(ctx, x - 4, y - 6 + bob, 8, 5, P.amber1);
    px(ctx, x - 3, y - 7 + bob, 6, 1, P.amber);
    px(ctx, x - 2, y - 5 + bob, 1, 1, P.amberHi);
  } else if (pk.kind === 'fragment' || pk.kind === 'scrap') {
    const c = pk.kind === 'scrap' ? P.milk : P.amberHi;
    ring(ctx, x, y - 7 + bob, 5 + Math.sin(t * 6), 'rgba(255,210,122,0.5)');
    px(ctx, x - 2, y - 9 + bob, 5, 5, P.ink);
    px(ctx, x - 1, y - 8 + bob, 3, 3, c);
  }
}


function drawTelegraphs(g, ctx, e) {
  if (e.spawn > 0) return;
  if (e.kind === 'hollow' && e.state === 'windup') {
    px(ctx, e.x - 1, e.y - 30, 2, 5, P.crimsonHi);
    px(ctx, e.x - 1, e.y - 24, 2, 2, P.crimsonHi);
    const ex = e.x + Math.cos(e.lock) * 22;
    const ey = e.y + Math.sin(e.lock) * 16;
    ctx.globalAlpha = 0.5;
    line(ctx, e.x, e.y - 2, ex, ey, P.crimson);
    ctx.globalAlpha = 1;
  }
  if (e.kind === 'framer' && e.state === 'windup' && !isPhased(g, e)) px(ctx, e.x - 1, e.y - 18, 2, 3, P.crimsonHi);
  if (e.kind === 'eater' && e.state === 'windup') ring(ctx, e.x, e.y - 2, 22, Math.floor(g.time * 12) % 2 ? P.crimsonHi : P.crimson, 0.6, 2);
  if (e.kind === 'ringer' && e.state === 'charge') {
    const k = 1 - e.st / 1.3;
    ring(ctx, e.x, e.y - 4, 4 + k * 16, `rgba(200,40,74,${0.3 + k * 0.5})`, 0.6, 2);
  }
  if (e.kind === 'ringer' && e.state === 'aim') px(ctx, e.x - 1, e.y - 32, 2, 4, P.crimsonHi);
  if (e.kind === 'shadow') {
    if (e.state === 'dash' && e.phaseStep === 0) {
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < 90; i += 6) {
        px(ctx, e.x + Math.cos(e.lock) * i, e.y - 2 + Math.sin(e.lock) * i, 3, 1, P.crimsonHi);
      }
      ctx.globalAlpha = 1;
    }
    if (e.state === 'ring') ring(ctx, e.x, e.y - 6, 8 + (1 - e.st) * 14, 'rgba(230,192,106,0.6)', 0.6, 2);
  }
}

function drawProjectile(g, ctx, pr) {
  const back = pr.tl.phase === PAST;
  if (pr.kind === 'note') {
    const c = back ? P.amberHi : P.crimsonHi;
    const x = Math.round(pr.x);
    const y = Math.round(pr.y);
    disc(ctx, x, y, 3, back ? P.amber0 : P.crimson0);
    disc(ctx, x, y, 2, c);
    px(ctx, x - 1, y - 1, 1, 1, P.milk);
    // хвост
    px(ctx, x - Math.sign(pr.vx) * 4, y - Math.sign(pr.vy) * 3, 2, 2, back ? P.amber : P.crimson);
    if (pr.frozen > 0) ring(ctx, x, y, 5, P.milk, 1, 2);
  } else if (pr.kind === 'ring') {
    const a = Math.max(0.2, 1 - pr.rad / pr.max);
    const c = back ? `rgba(255,210,122,${0.5 + a * 0.5})` : `rgba(255,90,122,${0.35 + a * 0.6})`;
    ring(ctx, pr.x, pr.y, pr.rad, c, 0.6);
    ring(ctx, pr.x, pr.y, pr.rad - 2, back ? 'rgba(224,160,64,0.35)' : 'rgba(200,40,74,0.3)', 0.6, 2);
    ring(ctx, pr.x, pr.y, pr.rad + 2, back ? 'rgba(224,160,64,0.35)' : 'rgba(200,40,74,0.3)', 0.6, 2);
  }
}

function drawFxItem(ctx, f) {
  const k = f.life / f.max;
  if (f.kind === 'sq') {
    ctx.globalAlpha = Math.min(1, k * 1.5);
    px(ctx, f.x, f.y, f.size, f.size, f.c);
    ctx.globalAlpha = 1;
  } else if (f.kind === 'ring') {
    const r = f.r1 + (f.r0 - f.r1) * k;
    ctx.globalAlpha = k;
    ring(ctx, f.x, f.y, r, f.c, f.squash);
    ctx.globalAlpha = 1;
  } else if (f.kind === 'slash') {
    // серп удара
    const steps = 14;
    ctx.globalAlpha = k;
    for (let i = 0; i <= steps; i++) {
      const a = f.angle - f.span / 2 + (f.span * i) / steps;
      const w = Math.sin((i / steps) * Math.PI);
      for (let d = 0; d < 3 + w * 3; d++) {
        const rr = f.radius - d;
        px(ctx, f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.75, 1, 1, d < 2 ? P.milk : f.c);
      }
    }
    ctx.globalAlpha = 1;
  } else if (f.kind === 'bolt') {
    ctx.globalAlpha = k;
    const n = 6;
    let lx = f.x0;
    let ly = f.y0;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const jx = i === n ? 0 : (hash2(i, f.seed, 1) - 0.5) * 8;
      const jy = i === n ? 0 : (hash2(f.seed, i, 2) - 0.5) * 8;
      const nx = f.x0 + (f.x1 - f.x0) * t + jx;
      const ny = f.y0 + (f.y1 - f.y0) * t + jy;
      line(ctx, lx, ly, nx, ny, f.c);
      lx = nx;
      ly = ny;
    }
    ctx.globalAlpha = 1;
  }
}

function drawTargetMarker(g, ctx, tgt, p) {
  const x = Math.round(tgt.x);
  const y = Math.round(tgt.y);
  const tl = tgt.obj.tl;
  const nextPhase = isShifted(tl) ? tl.base : tl.phase === PAST ? 'present' : 'past';
  const c = PHASE_COLOR[nextPhase];
  const s = 9 + Math.round(Math.sin(g.time * 8));
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    px(ctx, x + dx * s - (dx > 0 ? 2 : 0), y + dy * s - (dy > 0 ? 0 : 0), 3, 1, c);
    px(ctx, x + dx * s - (dx > 0 ? 0 : 0), y + dy * s - (dy > 0 ? 2 : 0), 1, 3, c);
  }
  // стоимость
  const cost = isShifted(tl) || p.echo > 0 || g.freeShift ? 0 : tl.cost;
  for (let i = 0; i < cost; i++) px(ctx, x - 1 + i * 3, y - s - 4, 2, 2, P.teal);
  if (p.channel && p.channel.target.obj === tgt.obj) {
    const pr = channelProgress(p.channel);
    const n = Math.floor(pr * 24);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / 24) * Math.PI * 2;
      px(ctx, x + Math.cos(a) * (s + 3), y + Math.sin(a) * (s + 3), 1, 1, P.milk);
    }
  }
}

function drawInteractMarker(g, ctx, obj) {
  const [cx, cy] = propCenter(obj);
  const top = obj.def.flat ? cy - 6 : obj.y - (obj.markY ?? 30);
  const bob = Math.round(Math.sin(g.time * 5));
  px(ctx, cx - 3, top - 6 + bob, 7, 7, P.ink);
  px(ctx, cx - 2, top - 5 + bob, 5, 5, P.amber);
  px(ctx, cx - 1, top - 4 + bob, 3, 1, P.ink);
  px(ctx, cx - 1, top - 2 + bob, 3, 1, P.ink);
  px(ctx, cx - 1, top - 4 + bob, 1, 3, P.ink);
}


// Сводка для отладочного оверлея (обновляется каждый кадр).
export const frameStats = { objects: 0, lights: 0, culled: 0 };

export function renderWorld(g, ctx) {
  const room = g.room;
  const q = g.quality;
  setShadowStyle(q.shadows);
  ctx.fillStyle = P.void;
  ctx.fillRect(0, 0, W, H);
  if (!room) return;
  ensureLight();
  const shake = g.cam.shakeT > 0 && g.save.settings.screenShake ? g.cam.shakeA : 0;
  const cx = Math.round(g.cam.x + (Math.random() - 0.5) * shake * 2);
  const cy = Math.round(g.cam.y + (Math.random() - 0.5) * shake * 2);
  view = { x0: cx, y0: cy, x1: cx + W, y1: cy + H };
  let drawn = 0;
  let culled = 0;

  // параллакс неба (экранные координаты) — под прозрачной полосой холста комнаты
  room.def.drawParallax?.(g, ctx, cx, cy, q);

  ctx.save();
  ctx.translate(-cx, -cy);
  // только видимая часть запечённой комнаты
  const sx = Math.max(0, cx);
  const sy = Math.max(0, cy);
  const sw = Math.min(g.roomCanvas.width - sx, W + (cx < 0 ? cx : 0));
  const sh = Math.min(g.roomCanvas.height - sy, H + (cy < 0 ? cy : 0));
  if (sw > 0 && sh > 0) ctx.drawImage(g.roomCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
  const x0 = Math.max(0, Math.floor(cx / TILE));
  const y0 = Math.max(0, Math.floor(cy / TILE));
  drawVoidLayer(g, ctx, x0, y0, x0 + Math.ceil(W / TILE) + 1, y0 + Math.ceil(H / TILE) + 1);

  // зоны стирания
  for (const z of g.voidZones) {
    if (!visible(z.x, z.y, z.r, z.r)) continue;
    if (!z.active) {
      const k = 1 - z.warn;
      ring(ctx, z.x, z.y, z.r * (0.4 + k * 0.6), Math.floor(g.time * 12) % 2 ? P.crimsonHi : P.crimson, 0.7, 2);
    } else {
      ctx.fillStyle = P.void;
      for (let yy = -z.r; yy <= z.r; yy += 1) {
        const w = Math.sqrt(z.r * z.r - yy * yy);
        ctx.fillRect(Math.round(z.x - w), Math.round(z.y + yy * 0.7), Math.round(w * 2), 1);
      }
      for (let i = 0; i < 6; i++) {
        const a = hash2(i, z.x | 0, 1) * Math.PI * 2 + g.time;
        px(ctx, z.x + Math.cos(a) * z.r * 0.8, z.y + Math.sin(a) * z.r * 0.55, 2, 2, P.crimson);
      }
    }
  }

  room.def.drawFloor?.(g, ctx, q);

  // плоские объекты
  for (const p of g.props) {
    if (!p.def.flat || p.hidden) continue;
    if (!visible(p.x + p.w / 2, p.y + p.h, p.h + 16, p.w / 2 + 16)) {
      culled++;
      continue;
    }
    p.def.draw(ctx, p, g);
    drawn++;
  }
  for (const pk of g.pickups) if (visible(pk.x, pk.y, 16, 8)) drawPickup(ctx, pk, g.time);

  // сортировка по глубине, только видимое
  const list = [];
  for (const p of g.props) {
    if (p.def.flat || p.hidden) continue;
    const c = p.def.cache;
    if (!visible(p.x, p.y, c ? c.ay : 64, c ? c.w / 2 + 8 : 48)) {
      culled++;
      continue;
    }
    list.push({ y: propSortY(p), kind: 'prop', o: p });
  }
  for (const e of g.enemies) {
    if (!visible(e.x, e.y, e.kind === 'mel' ? 90 : 48)) {
      culled++;
      continue;
    }
    list.push({ y: e.y, kind: 'enemy', o: e });
  }
  if (g.player && !g.player.dead) list.push({ y: g.player.y, kind: 'hero', o: g.player });
  for (const extra of g.drawables) list.push(extra);
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    drawn++;
    if (it.kind === 'prop') {
      const p = it.o;
      drawProp(g, ctx, p);
      if (isShifted(p.tl) && p.tl.switchable && !p.def.flat) {
        const [mx] = propCenter(p);
        const fading = isFading(p.tl) && Math.floor(g.time * 10) % 2 === 0;
        if (!fading) ring(ctx, mx, p.y - 1, 9, PHASE_COLOR[p.tl.phase], 0.4, 2);
      }
    } else if (it.kind === 'enemy') drawEnemy(g, ctx, it.o);
    else if (it.kind === 'hero') drawHeroSprite(g, ctx, it.o);
    else if (it.draw) it.draw(ctx, g);
  }

  for (const pr of g.projectiles) {
    const r = pr.kind === 'ring' ? pr.rad : 4;
    if (pr.x + r < view.x0 || pr.x - r > view.x1 || pr.y + r < view.y0 || pr.y - r > view.y1) continue;
    drawProjectile(g, ctx, pr);
  }
  // частицы из пула
  const pl = g.particles;
  for (let i = 0; i < pl.n; i++) {
    const x = pl.x[i];
    const y = pl.y[i];
    if (x < view.x0 || x > view.x1 || y < view.y0 || y > view.y1) continue;
    const k = pl.life[i] / pl.max[i];
    ctx.globalAlpha = k > 0.66 ? 1 : k > 0.33 ? 0.66 : 0.33;
    ctx.fillStyle = pl.color[i];
    ctx.fillRect(x | 0, y | 0, pl.size[i], pl.size[i]);
  }
  ctx.globalAlpha = 1;
  for (const f of g.fx) drawFxItem(ctx, f);
  room.def.drawOver?.(g, ctx, q);
  ctx.restore();

  ambientAsh(g, ctx);
  drawLighting(g, ctx, cx, cy);

  // поверх света: метки, полоски здоровья, цифры — одинаковы во всех профилях
  ctx.save();
  ctx.translate(-cx, -cy);
  for (const e of g.enemies) {
    if (!visible(e.x, e.y, 60)) continue;
    drawTelegraphs(g, ctx, e);
    if (e.hp < e.maxHp && !e.def.elite && e.spawn <= 0 && !(e.kind === 'framer' && isPhased(g, e))) {
      const w = 14;
      px(ctx, e.x - w / 2 - 1, e.y - e.hitY - 16, w + 2, 3, P.ink);
      px(ctx, e.x - w / 2, e.y - e.hitY - 15, Math.round((w * e.hp) / e.maxHp), 1, P.ash4);
    }
  }
  const p = g.player;
  if (p && !p.dead && !g.cinematic) {
    if (p.shiftTarget) drawTargetMarker(g, ctx, p.shiftTarget, p);
    if (g.interactTarget) drawInteractMarker(g, ctx, g.interactTarget);
  }
  for (const t of g.texts) {
    const k = Math.min(1, (t.life / t.max) * 2);
    ctx.globalAlpha = k;
    if (/^[\d+\-×/]+$/.test(t.text)) {
      const s = t.big ? 2 : 1;
      const w = digitsWidth(t.text, s);
      drawDigits(ctx, Math.round(t.x - w / 2) + 1, Math.round(t.y) + 1, t.text, P.ink, s);
      drawDigits(ctx, Math.round(t.x - w / 2), Math.round(t.y), t.text, t.c, s);
    } else {
      ctx.font = `${t.big ? 10 : 8}px "Pixelify Sans", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = P.ink;
      ctx.fillText(t.text, Math.round(t.x) + 1, Math.round(t.y) + 1);
      ctx.fillStyle = t.c;
      ctx.fillText(t.text, Math.round(t.x), Math.round(t.y));
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // экранные эффекты
  if (p && p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(200,40,74,${Math.min(0.9, p.hurtFlash * 4)})`;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
  }
  if (p && p.hp / p.maxHp < 0.3 && !p.dead) {
    ctx.fillStyle = Math.floor(g.time * 3) % 2 ? P.crimson0 : P.crimson1;
    ctx.fillRect(0, 0, W, 1);
    ctx.fillRect(0, H - 1, W, 1);
  }
  if (q.glitch) glitch(g, ctx);
  if (g.scene === 'play') drawHud(g, ctx);
  frameStats.objects = drawn;
  frameStats.culled = culled;
}

function drawHeroSprite(g, ctx, p) {
  const o = {
    dir: p.dir, flip: p.flip, t: g.time, walk: p.walk, sway: p.sway, moving: p.moving, aim: p.aim,
    swing: p.swing ? p.swing.t : null, swingStep: p.swing?.step, glow: inPerfectWindow(p.combo), charges: p.charges.n,
  };
  if (p.falling > 0) {
    const k = p.falling / 0.5;
    ctx.globalAlpha = k > 0.5 ? 1 : 0.5;
    drawHeroC(ctx, p.x, p.y + Math.round((1 - k) * 8), { ...o, moving: false, swing: null });
    ctx.globalAlpha = 1;
    return;
  }
  const blink = p.invuln > 0 && p.dodge <= 0 && Math.floor(g.time * 20) % 2 === 0;
  if (blink) return;
  shadow(ctx, p.x, p.y, 12);
  if (p.dodge > 0) {
    // шлейф рывка — силуэт того же кадра
    ctx.globalAlpha = 0.5;
    drawHeroC(ctx, p.x - p.dodgeDir[0] * 8, p.y - p.dodgeDir[1] * 6, o, P.blueLo);
    ctx.globalAlpha = 1;
  }
  if (p.doubleOutline > 0) {
    // двойной контур при смене состояния
    drawHeroC(ctx, p.x - 2, p.y, o, P.amber);
    drawHeroC(ctx, p.x + 2, p.y, o, P.crimson);
  }
  if (p.echo > 0 && Math.floor(g.time * 15) % 2) drawHeroC(ctx, p.x + 1, p.y, o, P.tealHi);
  drawHeroC(ctx, p.x, p.y, o, p.hurtFlash > 0.1 ? '#ffffff' : null);
  if (p.channel) {
    const pr = channelProgress(p.channel);
    ring(ctx, p.x, p.y - 2, 6 + pr * 6, pr > 0.95 ? P.milk : P.teal, 0.5, 2);
  }
}

// Пепел в воздухе — экранные пиксели, число по профилю.
function ambientAsh(g, ctx) {
  const n = g.room.def.ambient === false ? 0 : g.quality.ambient;
  if (!n) return;
  ctx.fillStyle = g.room.def.ashColor || P.ash3;
  const t = g.time;
  for (let i = 0; i < n; i++) {
    const r = hash2(i, 1, 4);
    const x = ((r * W + t * (5 + r * 9) - g.cam.x * 0.2) % W + W) % W;
    const y = ((hash2(i, 2, 4) * H + t * (7 + r * 6) - g.cam.y * 0.2) % H + H) % H;
    ctx.fillRect(x | 0, y | 0, 1, 1);
  }
}

// Свет: тьма в половинном разрешении, ступенчатые маски из кэша, число по профилю.
function drawLighting(g, ctx, cx, cy) {
  const dark = g.room.def.dark ?? 0.45;
  frameStats.lights = 0;
  if (dark <= 0) return;
  const q = g.quality;
  const lc = lightCtx;
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, W / 2, H / 2);
  lc.fillStyle = `rgba(4,5,14,${dark})`;
  lc.fillRect(0, 0, W / 2, H / 2);
  lc.globalCompositeOperation = 'destination-out';
  const p = g.player;
  const list = [];
  if (p) list.push({ x: p.x, y: p.y - 8, r: 46, s: 0.85, hero: true });
  // остальные — ближайшие к герою, в пределах кадра
  const extra = [];
  for (const l of g.lights) {
    const sx = l.x - cx;
    const sy = l.y - cy;
    if (sx < -l.r || sy < -l.r || sx > W + l.r || sy > H + l.r) continue;
    extra.push({ ...l, s: 1, d: p ? Math.abs(l.x - p.x) + Math.abs(l.y - p.y) : 0 });
  }
  extra.sort((a, b) => a.d - b.d);
  list.push(...extra.slice(0, q.lights - 1));
  for (const l of list) {
    const m = lightMask(l.r / 2, q.lightRings, '0,0,0', l.s);
    const r = (m.width - 1) / 2;
    lc.drawImage(m, Math.round((l.x - cx) / 2 - r), Math.round((l.y - cy) / 2 - r));
  }
  frameStats.lights = list.length;
  lc.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lightCanvas, 0, 0, W, H);
  // тёплые ореолы прошлого — ступенчатые пятна, без градиентов
  if (q.lightRings >= 3) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of list) {
      if (l.c !== 'amber') continue;
      const m = lightMask(l.r * 0.8, q.lightRings - 1, '110,64,18', 0.3);
      const r = (m.width - 1) / 2;
      ctx.drawImage(m, Math.round(l.x - cx - r), Math.round(l.y - cy - r));
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// Редкие сбои кадра — мир «проходит через неисправный экран» (не на Low).
function glitch(g, ctx) {
  const amount = g.glitch ?? 0.02;
  if (Math.random() > amount) return;
  const y = Math.floor(Math.random() * H);
  const h = 1 + Math.floor(Math.random() * 4);
  const dx = Math.random() > 0.5 ? 2 : -2;
  ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
}
