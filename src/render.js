// Отрисовка комнаты: параллакс, пол, пустоты, объекты, персонажи по глубине, эффекты, свет, HUD.
// Персонажи и декор выводятся из атласа (src/art/spritecache.js), невидимое отсекается,
// частицы — из пула, свет — ступенчатые маски. Лимиты — docs/PERFORMANCE_BUDGET.md.
import { W, H, RS } from './core/renderer.js';
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
import { atlas, hd, drawHeroC, drawEnemyC, drawMelC } from './art/spritecache.js';
import { blit } from './art/atlas.js';
import { softMask, glow } from './art/glow.js';
import { drawWet, drawFog, drawRain, drawLeaves, drawVignette } from './art/atmo.js';
import { drawArtOver } from './art/roomart.js';
import { heatCost } from './timeline/heat.js';
import { islandRows, islandScale, inIslands } from './world/memory.js';
import { threadList, chainOf } from './timeline/threads.js';
import { shadeFade, recordLeft, ECHO_TIME, ECHO_LINGER } from './player/echo.js';
import { shiftNote } from './combat/bestiary.js';
import { MEMORIES } from './story/memories.js';

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

const SHADOW_W = { hollow: 12, framer: 12, ringer: 14, shadow: 18, eater: 22 };

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
        if (st === 'warn') warnTile(ctx, x, y, tx, ty, t);
        else if (st === 'void') {
          // провал: почти чёрная глубина, а у края целого пола — «толщина» земли и светлая кромка
          ctx.fillStyle = '#030308';
          ctx.fillRect(x, y, TILE, TILE);
          voidSquares(ctx, x, y, tx, ty, t, per);
          const solidAt = (ax, ay) => {
            const tt = tileAt(room, ax, ay);
            if (tt === T.VOID || tt === T.WALL || tt == null) return false;
            return tt !== T.FLICKER || room.flickerState(g, ax, ay) !== 'void';
          };
          if (solidAt(tx, ty - 1)) {
            ctx.fillStyle = '#2a2434';
            ctx.fillRect(x, y, TILE, 4);
            ctx.fillStyle = '#16121c';
            ctx.fillRect(x, y + 4, TILE, 2);
            ctx.fillStyle = '#8a8296';
            ctx.fillRect(x, y, TILE, 1);
          }
          ctx.fillStyle = '#8a8296';
          if (solidAt(tx - 1, ty)) ctx.fillRect(x, y, 1, TILE);
          if (solidAt(tx + 1, ty)) ctx.fillRect(x + TILE - 1, y, 1, TILE);
          if (solidAt(tx, ty + 1)) ctx.fillRect(x, y + TILE - 1, TILE, 1);
        }
        continue;
      }
    }
  }
}

// Плита вот-вот сотрётся: дрожит, трескается малиновым и сыплет крошкой (как в Celeste).
function warnTile(ctx, x, y, tx, ty, t) {
  const j = Math.floor(t * 24) % 2 ? 1 : 0;
  ctx.fillStyle = 'rgba(5,4,10,0.35)';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ff5a7a' : '#c8284a';
  const r = hash2(tx, ty, 5);
  // ломаная трещина через плиту
  let cx = x + 2 + Math.floor(r * 6) + j;
  let cy = y + 2;
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(cx, cy, 1, 2);
    cx += hash2(tx + i, ty, 7) > 0.5 ? 1 : -1;
    cy += 2;
  }
  ctx.fillRect(x + 9 - j, y + 6, 4, 1);
  // крошка падает вниз
  for (let i = 0; i < 2; i++) {
    const k = (t * 1.6 + hash2(tx, ty + i, 9)) % 1;
    ctx.fillStyle = '#5a5266';
    ctx.fillRect(x + 3 + Math.floor(hash2(tx + i, ty, 13) * 10), y + Math.floor(k * TILE), 1, 1);
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

// Анимированное поле пустоты: плитка 64×64, 8 кадров дрейфа квадратов, якорь — мир.
const voidFrames = [];
function voidFrame(i) {
  if (voidFrames[i]) return voidFrames[i];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const v = c.getContext('2d');
  v.fillStyle = P.void;
  v.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 26; k++) {
    const r = hash2(k, 3, 11);
    const yy = Math.floor((hash2(k, 7, 2) * 64 - i * (2 + r * 3)) % 64 + 64) % 64;
    v.fillStyle = r > 0.8 ? P.crimson1 : r > 0.45 ? P.crimson0 : '#0d0a18';
    const sz = r > 0.86 ? 2 : 1;
    v.fillRect(Math.floor(hash2(k, 5, 3) * 64), yy, sz, sz);
  }
  voidFrames[i] = { canvas: c, pattern: null };
  return voidFrames[i];
}

function drawVoidField(g, ctx, cx, cy) {
  const n = g.quality.decorAnim ? 8 : 2;
  const f = voidFrame(Math.floor(g.time * 4) % n);
  if (!f.pattern) f.pattern = ctx.createPattern(f.canvas, 'repeat');
  ctx.save();
  ctx.translate(-cx, -cy);
  ctx.fillStyle = f.pattern;
  ctx.fillRect(cx, cy, W, H);
  ctx.restore();
}

// Острова памяти: Отпечаток комнаты сквозь ступенчатую маску, янтарный ободок по краю.
function drawMemoryIslands(g, ctx) {
  const pc = g.room.pastCanvas;
  for (const isl of g.memIslands) {
    const rows = islandRows(isl, 2);
    if (!rows.length) continue;
    let bx0 = Infinity;
    let by0 = Infinity;
    let bx1 = -Infinity;
    let by1 = -Infinity;
    ctx.save();
    ctx.beginPath();
    for (const [x, y, w, h] of rows) {
      ctx.rect(x, y, w, h);
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x + w);
      by1 = Math.max(by1, y + h);
    }
    ctx.clip();
    const k = pc.rs || 1;
    bx0 = Math.max(0, bx0);
    by0 = Math.max(0, by0);
    bx1 = Math.min(pc.width / k, bx1);
    by1 = Math.min(pc.height / k, by1);
    if (bx1 > bx0 && by1 > by0) ctx.drawImage(pc, bx0 * k, by0 * k, (bx1 - bx0) * k, (by1 - by0) * k, bx0, by0, bx1 - bx0, by1 - by0);
    ctx.restore();
    const s = islandScale(isl.k);
    ring(ctx, isl.x, isl.y, isl.rx * s, isl.k < 1 ? 'rgba(255,210,122,0.9)' : 'rgba(224,160,64,0.45)', isl.ry / isl.rx, 2);
  }
}

// Ореол без отпечатка комнаты: тёплое пятно и ступенчатый янтарный ободок.
function drawAuraRims(g, ctx) {
  for (const isl of g.memIslands) {
    if (!isl.rim) continue;
    const s = islandScale(isl.k);
    ctx.fillStyle = `rgba(255,196,120,${0.07 * isl.k})`;
    for (const [x, y, w, h] of islandRows(isl, 2)) ctx.fillRect(x, y, w, h);
    ring(ctx, isl.x, isl.y, isl.rx * s, isl.k < 1 ? 'rgba(255,210,122,0.7)' : 'rgba(224,160,64,0.32)', isl.ry / isl.rx, 2);
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
  // состояние, зависящее от окружения (свет фонаря возвращает прошлое декору)
  const state = c.state ? c.state(p, g) : undefined;
  const key = `p|${p.kind}|${phase}|${frame}|${inst}|${state ?? ''}`;
  // 32-битный маляр объекта рисует в плотной сетке, кадр пикселизуется
  const hdDraw = hd.on && p.def.drawHd;
  return atlas.sprite(hdDraw ? `hd|${key}` : key, c.w, c.h, c.ax, c.ay, (bctx, ax, ay) => {
    const tl = { ...p.tl, phase };
    (hdDraw || p.def.draw)(bctx, { ...p, x: ax, y: ay, tl, state }, { time: c.fps ? frame / c.fps : 0, quality: g.quality });
  }, hdDraw ? { hd: true, crisp: p.def.crisp ?? true } : undefined);
}

// Контур и контровой свет живых фигур (Hades, Children of Morta): тёмная кромка вокруг и
// светлый блик сверху-слева — фигура отделяется от фона того же тона. draw(dx, dy, tint).
const rimOf = (g) => g.room?.def.rim ?? '#a9c0e8';
function figureEdge(ctx, g, draw) {
  // прозрачность — от текущей (отражения в лужах, призраки рисуются полупрозрачно)
  // тёмный контур уже запечён в кадр атласа — добавляем только контровой свет
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * 0.6;
  draw(-0.5, -0.5, rimOf(g));
  ctx.globalAlpha = a0;
}

export function drawProp(g, ctx, p) {
  const c = p.def.cache;
  if (!c || p.nocache) {
    p.def.draw(ctx, p, g);
    return;
  }
  const tl = p.tl;
  const e = propEntry(g, p, tl.phase);
  // контур — только у живых: призраки полупрозрачны, кромка просвечивала бы сквозь них
  if (p.kind === 'npc') figureEdge(ctx, g, (dx, dy, c) => blit(ctx, atlas.tinted(e.key, e, c), p.x + dx, p.y + dy));
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
  const o = enemyOpts(e);
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
  groundRing(g, ctx, e);
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
  if (!flash) figureEdge(ctx, g, (dx, dy, t) => drawEnemyC(ctx, e.kind, e.x + dx, e.y + dy, o, t));
  drawEnemyC(ctx, e.kind, e.x, e.y, o, flash ? '#ffffff' : null);
  if (!flash && e.tl?.phase === PRESENT && e.kind !== 'shadow' && g.quality.decorAnim !== false) {
    // Шрам рвёт форму: время от времени одна полоса фигуры съезжает вбок
    const step = Math.floor(g.time * 8 + e.id * 3);
    if (step % 4 === 0) {
      const top = e.y - (e.hitY ?? 9) - 16;
      const by = top + (step % 3) * 6 + 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(e.x - 16, by, 32, 3);
      ctx.clip();
      ctx.fillStyle = 'rgba(3,4,10,0.85)';
      ctx.fillRect(e.x - 16, by, 32, 3);
      drawEnemyC(ctx, e.kind, e.x + (step % 2 ? 2 : -2), e.y, o);
      ctx.restore();
    }
  }
  if (e.kind === 'shadow') drawEnemyC(ctx, e.kind, e.x, e.y, { ...o, layer: 'front' }, flash ? '#ffffff' : null);
  if (e.burn > 0 && Math.floor(g.time * 12) % 2) px(ctx, e.x - 2 + Math.random() * 4, e.y - 18 - Math.random() * 6, 1, 2, P.amberHi);
}


// Кольцо врага на земле: отличает врага от столба и статуи. Спокойное — тонкое, неподвижное,
// приглушённое: яркое и мигающее остаётся только у телеграфов атак (аудит: не путать со светом).
function groundRing(g, ctx, e) {
  const r = (SHADOW_W[e.kind] ?? 12) / 2 + 3;
  const past = e.tl.phase === PAST;
  ctx.save();
  ctx.fillStyle = 'rgba(3,4,10,0.35)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y - 0.5, r, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = past ? 'rgba(224,160,64,0.45)' : 'rgba(200,40,74,0.45)';
  ctx.stroke();
  ctx.restore();
}

// Подбираемое — 32-битный кадр из атласа (покачивание по 0,5 px), свечение — в слое света.
function drawPickup(ctx, pk, t) {
  const bob = Math.round(Math.sin(t * 5 + pk.seed) * 3) / 2;
  const f = Math.floor(t * 6 + pk.seed) % 3;
  ctx.fillStyle = 'rgba(3,4,10,0.5)';
  ctx.beginPath();
  ctx.ellipse(pk.x, pk.y, 3.2 - bob * 0.3, 1, 0, 0, Math.PI * 2);
  ctx.fill();
  const e = atlas.sprite(`pk|${pk.kind}|${f}`, 16, 20, 8, 16, (b, ax, ay) => paintPickupHd(b, pk.kind, ax, ay, f), { hd: true, crisp: true, outline: OUTLINE });
  blit(ctx, e, pk.x, pk.y - 2 + bob);
}

// Зола — тлеющий уголёк, осколок — бирюзовый кристалл, хлеб — румяная краюха,
// фрагмент — светящийся кадр плёнки, обрывок — бумажный лист.
function paintPickupHd(c, kind, x, y, f) {
  const oval = (cx, cy, rx, ry, fill, rot = 0) => {
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  };
  const poly = (pts, fill) => {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  };
  const lin = (x0, y0, x1, y1, stops) => {
    const gr = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([k, col]) => gr.addColorStop(k, col));
    return gr;
  };
  if (kind === 'ash') {
    poly([x - 3, y - 2, x - 1.5, y - 5.5, x + 2, y - 6, x + 3.4, y - 3, x + 2, y - 0.6, x - 1.8, y - 0.4], lin(x - 3, y - 6, x + 3, y, [[0, '#55576a'], [0.5, '#24252e'], [1, '#0d0e14']]));
    c.strokeStyle = f === 1 ? '#ffd27a' : '#e0a040';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(x - 1.6, y - 4.4);
    c.lineTo(x, y - 3);
    c.lineTo(x + 1.8, y - 3.6);
    c.moveTo(x, y - 3);
    c.lineTo(x - 0.4, y - 1.2);
    c.stroke();
    c.fillStyle = '#fff4d0';
    c.fillRect(x - 0.25, y - 3.25, 0.5, 0.5);
    c.fillStyle = '#ffd27a';
    c.fillRect(x - 1 + f, y - 8 - f, 0.5, 0.5);
  } else if (kind === 'shard') {
    poly([x, y - 11, x + 2.6, y - 5, x + 1.2, y, x - 1.6, y - 0.4, x - 2.4, y - 6], lin(x - 2, y - 10, x + 2, y, [[0, '#d8fff8'], [0.35, '#6ff2e0'], [0.7, '#2a9a92'], [1, '#145a5a']]));
    poly([x, y - 11, x + 0.4, y - 5, x - 1.6, y - 0.4, x - 2.4, y - 6], 'rgba(255,255,255,0.35)');
    c.fillStyle = '#ffffff';
    c.fillRect(x - 1, y - 8 + f, 0.5, 1);
  } else if (kind === 'heal') {
    oval(x, y - 3.4, 4.6, 3.2, lin(x - 4, y - 6, x + 4, y, [[0, '#ffd27a'], [0.4, '#c8842a'], [1, '#6a3a12']]));
    c.strokeStyle = '#5a3014';
    c.lineWidth = 0.45;
    c.beginPath();
    for (const dx of [-2, 0, 2]) {
      c.moveTo(x + dx - 0.8, y - 5.6);
      c.lineTo(x + dx + 0.8, y - 3.8);
    }
    c.stroke();
    oval(x - 1.6, y - 5.4, 1.2, 0.5, 'rgba(255,240,200,0.8)');
  } else if (kind === 'fragment' || kind === 'scrap') {
    const paper = kind === 'scrap';
    c.save();
    c.translate(x, y - 5);
    c.rotate((f - 1) * 0.08);
    c.fillStyle = paper ? '#ece4cf' : lin(-3, -4, 3, 4, [[0, '#fff4d0'], [0.5, '#ffd27a'], [1, '#b8721f']]);
    c.fillRect(-3.4, -4, 6.8, 8);
    c.fillStyle = paper ? '#b9ab8e' : '#4a2a10';
    c.fillRect(-2.2, -2.8, 4.4, 5.6);
    c.fillStyle = paper ? '#ece4cf' : '#fff8e0';
    for (let i = 0; i < 3; i++) {
      c.fillRect(-3.2, -3.4 + i * 2.6, 0.6, 0.9);
      c.fillRect(2.6, -3.4 + i * 2.6, 0.6, 0.9);
    }
    if (!paper) {
      c.fillStyle = '#ffd27a';
      c.fillRect(-0.8, -1.2, 1.6, 2.2);
    }
    c.restore();
  }
}

function paintPickup(ctx, kind, x, y, bob, t) {
  const pk = { kind };
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
    ring(ctx, x, y - 7 + bob, 5, 'rgba(255,210,122,0.5)');
    px(ctx, x - 2, y - 9 + bob, 5, 5, P.ink);
    px(ctx, x - 1, y - 8 + bob, 3, 3, c);
  }
}


// Цель сдвига — угловые скобки цвета будущей фазы: прямоугольная форма, которой нет у
// телеграфов атак (дуги, полосы, кольца) и у кругов под ногами.
function targetBrackets(g, ctx, t) {
  const o = t.obj;
  const c = PHASE_COLOR[nextPhaseOf(o.tl)];
  let x0;
  let y0;
  let x1;
  let y1;
  if (t.type === 'enemy') {
    x0 = o.x - 8;
    x1 = o.x + 8;
    y0 = ENEMY_TOP(o) + 4;
    y1 = o.y + 2;
  } else if (o.def?.flat) {
    x0 = o.x;
    y0 = o.y;
    x1 = o.x + o.w;
    y1 = o.y + o.h;
  } else {
    const hw = Math.max(6, (o.def?.foot?.w ?? 10) / 2 + 3);
    x0 = o.x - hw;
    x1 = o.x + hw;
    y0 = propTop(o) + 4;
    y1 = o.y + 2;
  }
  const k = 3 + (Math.floor(g.time * 4) % 2);
  ctx.fillStyle = c;
  for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.fillRect(Math.round(x) - (sx < 0 ? 1 : 0), Math.round(y) - (sy < 0 ? 1 : 0), sx * k, 1);
    ctx.fillRect(Math.round(x) - (sx < 0 ? 1 : 0), Math.round(y) - (sy < 0 ? 1 : 0), 1, sy * k);
  }
}

// Телеграфы атак — яркие, короткие, у каждого врага своя форма (аудит: отделить от света):
// Пустокожий — малиновая дуга перед телом; Кадровик — бирюзовые сегменты вдоль рывка;
// Звонарь — растущее кольцо с ярким разрывом в сторону героя; Пожиратель — мигающий круг укуса.
function arc(ctx, x, y, r, a0, a1, color, squash = 0.7) {
  const n = Math.max(6, Math.round((a1 - a0) * r));
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * squash), 1, 1);
  }
}
function drawTelegraphs(g, ctx, e) {
  if (e.spawn > 0) return;
  const blink = Math.floor(g.time * 14) % 2 ? P.crimsonHi : '#ffffff';
  if (e.kind === 'hollow' && e.state === 'windup') {
    // восклицание над головой и дуга удара перед телом — туда он прыгнет
    px(ctx, e.x - 1, e.y - 30, 2, 5, P.crimsonHi);
    px(ctx, e.x - 1, e.y - 24, 2, 2, P.crimsonHi);
    for (const r of [16, 19]) arc(ctx, e.x, e.y - 2, r, e.lock - 0.6, e.lock + 0.6, r === 16 ? blink : P.crimson);
  }
  if (e.kind === 'framer' && e.state === 'windup' && !isPhased(g, e)) {
    // бирюзовые сегменты вдоль будущего рывка
    px(ctx, e.x - 1, e.y - 18, 2, 3, '#6ff2e0');
    const nx = Math.cos(e.lock ?? e.face ?? 0);
    const ny = Math.sin(e.lock ?? e.face ?? 0) * 0.75;
    ctx.globalAlpha = 0.85;
    for (let i = 8; i < 56; i += 8) {
      const sx = e.x + nx * i;
      const sy = e.y - 2 + ny * i;
      px(ctx, Math.round(sx - ny * 5) - 1, Math.round(sy + nx * 5) - 1, 3, 2, '#6ff2e0');
      px(ctx, Math.round(sx + ny * 5) - 1, Math.round(sy - nx * 5) - 1, 3, 2, '#6ff2e0');
    }
    ctx.globalAlpha = 1;
  }
  if (e.kind === 'eater' && e.state === 'windup') ring(ctx, e.x, e.y - 2, 22, Math.floor(g.time * 12) % 2 ? P.crimsonHi : P.crimson, 0.6, 2);
  if (e.kind === 'ringer' && e.state === 'charge') {
    // растущее кольцо и яркий разрыв в сторону героя — туда уйдёт звон
    const k = 1 - e.st / 1.3;
    const rr = 4 + k * 16;
    ring(ctx, e.x, e.y - 4, rr, `rgba(200,40,74,${0.3 + k * 0.5})`, 0.6, 2);
    const hp = g.player;
    if (hp) {
      const a = Math.atan2((hp.y - (e.y - 4)) / 0.6, hp.x - e.x);
      arc(ctx, e.x, e.y - 4, rr, a - 0.35, a + 0.35, blink, 0.6);
    }
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
  } else if (f.kind === 'flash') {
    // вспышка контакта: 2 кадра звезды
    const fr = k > 0.5 ? 0 : 1;
    const e = atlas.sprite(`flash|${fr}|${f.c}`, 13, 13, 6, 6, (bc, ax, ay) => paintFlash(bc, ax, ay, fr, f.c));
    blit(ctx, e, f.x, f.y);
  } else if (f.kind === 'slash') {
    // серп из атласа: 32 направления
    const aq = ((Math.round(f.angle / (Math.PI / 16)) % 32) + 32) % 32;
    const R = Math.round(f.radius);
    const key = `slash|${aq}|${f.span.toFixed(2)}|${R}|${f.c}`;
    const e = atlas.sprite(key, R * 2 + 6, R * 2 + 6, R + 3, R + 3, (b, ax, ay) => paintSlash(b, ax, ay, (aq * Math.PI) / 16, f.span, R, f.c));
    ctx.globalAlpha = k;
    blit(ctx, e, f.x, f.y);
    ctx.globalAlpha = 1;
  } else if (f.kind === 'slash-old') {
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

// Дуга удара: белая кромка, цветное тело, тёмная внутренняя тень; к середине толще.
function paintSlash(ctx, x, y, angle, span, radius, c) {
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const a = angle - span / 2 + (span * i) / steps;
    const w = Math.sin((i / steps) * Math.PI);
    const th = 2 + Math.round(w * 5);
    for (let d = 0; d < th; d++) {
      const rr = radius - d;
      const col = d === 0 ? '#ffffff' : d < th - 1 ? c : P.slate;
      px(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.75, 1, 1, col);
    }
  }
}

// Узлы памяти заметны издалека: руны круга горят янтарём поверх света, закреплённый — ровно.
function drawNodeRunes(g, ctx) {
  for (const n of g.props) {
    if (n.kind !== 'memoryNode' || !visible(n.x + n.w / 2, n.y + n.h / 2, n.w)) continue;
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const k = n.fixed ? 1 : 0.35 + 0.65 * Math.max(0, Math.sin(g.time * 2.2 - i * 0.7));
      ctx.globalAlpha = 0.25 + 0.7 * k;
      const x = Math.round(cx + Math.cos(a) * n.w / 2);
      const y = Math.round(cy + Math.sin(a) * n.h / 2);
      px(ctx, x - 1, y, 3, 1, k > 0.7 ? P.amberHi : P.amber);
      px(ctx, x, y - 1, 1, 1, P.amberHi);
    }
  }
  ctx.globalAlpha = 1;
}

// Запись Эха: бирюзовый след пути и убывающее кольцо у ног героя.
function drawEchoRec(g, ctx, p) {
  const rec = p.echoRec;
  ctx.globalAlpha = 0.7;
  rec.frames.forEach((f, i) => {
    if (i % 4 === 0) px(ctx, Math.round(f.x), Math.round(f.y), 1, 1, P.teal);
  });
  ctx.globalAlpha = 1;
  timeBar(ctx, p.x, p.y - 34, recordLeft(rec) / ECHO_TIME, P.tealHi, 'запись');
}

// Шкала оставшегося времени: над сдвинутыми объектами и врагами (цвет фазы), над записью
// Эха и над тенью, пока она держит вес. Тёмная подложка — читается на любом фоне.
function timeBar(ctx, x, y, k, color, label = '') {
  const w = 16;
  const x0 = Math.round(x - w / 2);
  const y0 = Math.round(y);
  px(ctx, x0 - 1, y0 - 1, w + 2, 4, '#05060c');
  px(ctx, x0, y0, w, 2, 'rgba(60,60,80,0.8)');
  px(ctx, x0, y0, Math.max(0, Math.round(w * clamp01(k))), 2, color);
  if (label) void label; // подпись — в табличке; здесь только полоса
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function drawTimers(g, ctx, p) {
  for (const o of g.props) {
    if (o.hidden || !o.tl?.switchable || !isShifted(o.tl) || !Number.isFinite(o.tl.left) || !visible(o.x, o.y, 64)) continue;
    const [mx] = propCenter(o);
    const k = o.tl.left / (o.tl.hold || 1);
    timeBar(ctx, mx, propTop(o) - 6, k, k < 0.25 && Math.floor(g.time * 8) % 2 ? '#ffffff' : PHASE_COLOR[o.tl.phase]);
  }
  for (const e of g.enemies) {
    if (e.dead || !e.tl || !isShifted(e.tl) || !Number.isFinite(e.tl.left)) continue;
    timeBar(ctx, e.x, ENEMY_TOP(e) - 4, e.tl.left / (e.tl.hold || 1), PHASE_COLOR[e.tl.phase]);
  }
  const sh = g.echoShade;
  if (sh && !sh.done) {
    const k = sh.linger ? shadeFade(sh) : 1 - sh.t / Math.max(0.01, sh.rec.t + ECHO_LINGER);
    timeBar(ctx, sh.x, sh.y - 34, k, P.teal);
  }
}

// ── значки действий (docs/GAME_RESEARCH.md 3.1) ─────────────────────────
// Над персонажем, который ещё не говорил с героем, — молочный пузырь «…» (видно издалека).
// Над тем, что можно взять или осмотреть, вблизи — ладонь. Всё — поверх света.
const BUBBLE = ['.#######.', '#.......#', '#.#.#.#.#', '#.......#', '.###.###.', '....#....'];
const HAND = ['.#.#.#.', '.#.#.#.', '##.#.#.', '#######', '#######', '.#####.', '..###..'];
function pixIcon(ctx, rows, x, y, col, edge) {
  const w = rows[0].length;
  const ox = Math.round(x - w / 2);
  const oy = Math.round(y - rows.length);
  ctx.fillStyle = edge;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) if (rows[r][c] === '#') ctx.fillRect(ox + c - 0.5, oy + r, 2, 1.5);
  ctx.fillStyle = col;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < w; c++) if (rows[r][c] === '#') ctx.fillRect(ox + c, oy + r, 1, 1);
}
function drawActionIcons(g, ctx, p) {
  const bob = Math.round(Math.sin(g.time * 3) * 1);
  for (const o of g.props) {
    if (o.hidden || !o.onInteract || (o.canInteract && !o.canInteract(g)) || !visible(o.x, o.y, 64)) continue;
    if (o === g.interactTarget) continue; // у выбранного — табличка
    const top = propTop(o) - 3 + bob;
    const [mx] = propCenter(o);
    if (isTalk(o)) {
      if (!o.talked) pixIcon(ctx, BUBBLE, mx, top, '#ece4cf', '#0b0d1a');
    } else if (Math.hypot(mx - p.x, o.y - p.y) < 90) {
      ctx.globalAlpha = 0.85;
      pixIcon(ctx, HAND, mx, top, '#ffe9b0', '#0b0d1a');
      ctx.globalAlpha = 1;
    }
  }
}

// Имена персонажей рядом с героем (без взгляда) — чтобы было ясно, кто есть кто.
function nameTags(g, p, cx, cy) {
  const out = [];
  for (const o of g.props) {
    if (!isTalk(o) || o.hidden || !o.name || o === g.interactTarget) continue;
    if (Math.hypot(o.x - p.x, o.y - p.y) > 110) continue;
    out.push({ x: (o.x - cx) / W, y: (propTop(o) - 10 - cy) / H, text: o.name, kind: 'talk', d: Math.hypot(o.x - p.x, o.y - p.y) });
  }
  // подобрать: записки и обрывки воспоминаний — подпись с названием
  for (const pk of g.pickups || []) {
    if (pk.kind !== 'scrap' || Math.hypot(pk.x - p.x, pk.y - p.y) > 150) continue;
    const m = MEMORIES[pk.memory ?? 'nameScrap'];
    out.push({ x: (pk.x - cx) / W, y: (pk.y - 12 - cy) / H, text: m ? `Подобрать: ${m.name}` : 'Подобрать', kind: 'use', d: Math.hypot(pk.x - p.x, pk.y - p.y) });
  }
  return out.sort((a, b) => a.d - b.d).slice(0, 6);
}

// ── Взгляд Смотрителя ───────────────────────────────────────────────────
// Классы интерактивного: говорить (молочный), взять/осмотреть (тёплый), сдвинуть во времени
// (цвет будущей фазы), враги (малиновый). У цели сдвига — призрак её другого состояния.
const isTalk = (o) => o.kind === 'npc' || o.kind === 'ghostNpc';
const canUse = (g, o) => o.onInteract && !o.hidden && !o.carried && (!o.canInteract || o.canInteract(g)) && !(o.def.auraOnly && !o.lit);
const canShift = (o) => o.tl?.switchable && !o.hidden && !o.carried;
function drawGaze(g, ctx, p, cx, cy) {
  const k = g.gazeK;
  const near = (o) => Math.abs(o.x - p.x) < W && Math.abs(o.y - p.y) < H;
  for (const o of g.props) {
    if (!near(o) || !visible(o.x, o.y, 64)) continue;
    if (canUse(g, o)) lightUpProp(g, ctx, o, isTalk(o) ? '#ece4cf' : WARM, 0.85 * k);
    else if (canShift(o)) {
      lightUpProp(g, ctx, o, PHASE_COLOR[nextPhaseOf(o.tl)], 0.7 * k);
      targetBrackets(g, ctx, { obj: o, type: 'prop' });
    }
  }
  for (const e of g.enemies) if (!e.dead && e.spawn <= 0 && visible(e.x, e.y, 40)) lightUpEnemy(g, ctx, e, P.crimson);
  // призрак другого состояния у цели — как линза: смотри, что будет, до траты заряда
  const t = p.shiftTarget;
  if (t && t.type !== 'projectile') {
    const o = t.obj;
    const other = nextPhaseOf(o.tl);
    const a = (0.62 + 0.15 * Math.sin(g.time * 6)) * k;
    ctx.globalAlpha = a;
    if (t.type === 'enemy') drawEnemyC(ctx, o.kind, o.x, o.y, { ...enemyOpts(o), phase: other });
    else if (o.def.cache && !o.nocache) blit(ctx, propEntry(g, o, other), o.x, o.y);
    else o.def.draw(ctx, { ...o, tl: { ...o.tl, phase: other } }, g);
    ctx.globalAlpha = 1;
  }
}

// Подписи взгляда: что можно сделать с каждым объектом (ближние — первыми).
function gazeTags(g, p, cx, cy) {
  const out = [];
  for (const o of g.props) {
    const use = canUse(g, o);
    if (!use && !canShift(o)) continue;
    if (o === p.shiftTarget?.obj && !use) continue; // у цели сдвига своя табличка
    const [mx] = propCenter(o);
    // у цели сдвига сверху табличка Q — подпись действия уходит под объект
    const y = o === p.shiftTarget?.obj ? (o.def.flat ? o.y + o.h : o.y) + 12 : propTop(o);
    if (mx < cx - 8 || mx > cx + W + 8 || y < cy - 8 || y > cy + H + 8) continue;
    const text = use ? (isTalk(o) && o.name ? `${o.name} · ${(o.prompt || 'Поговорить').toLowerCase()}` : o.prompt || 'Осмотреть') : `${o.name || o.def.name || 'Объект'} — ${nextPhaseOf(o.tl) === PAST ? 'в прошлое' : 'в настоящее'}`;
    out.push({ x: (mx - cx) / W, y: (y - cy) / H, text, kind: use ? (isTalk(o) ? 'talk' : 'use') : 'time', d: Math.hypot(mx - p.x, y - p.y) });
  }
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0 || !e.tl?.switchable) continue;
    const y = ENEMY_TOP(e) - 6;
    if (e.x < cx - 8 || e.x > cx + W + 8 || y < cy - 8 || y > cy + H + 8) continue;
    const next = nextPhaseOf(e.tl);
    out.push({ x: (e.x - cx) / W, y: (y - cy) / H, text: `${e.def.name} · Q: ${shiftNote(e.kind, next)}`, kind: 'time', d: Math.hypot(e.x - p.x, e.y - p.y) - 1000 });
  }
  return out.sort((a, b) => a.d - b.d).slice(0, 12);
}

// ── нити причин (П3) ─────────────────────────────────────────────────────
// Пока герой целится сдвигом, видна цепочка цели: тонкая янтарная нить с провисом; натянутая
// (причина работает) — яркая, с бегущими бусинами. Без прицела — только натянутые, бледно.
const threadAnchor = (o) => (o.def.flat ? propCenter(o) : [o.x, o.y - (o.def.threadY ?? 12)]);
function drawThreads(g, ctx, p) {
  // нити видны только во «Взгляде Смотрителя» — в обычной игре не мешают
  if (!(g.gazeK > 0)) return;
  const all = threadList(g.props);
  if (!all.length) return;
  const target = (p.channel?.target || p.shiftTarget)?.obj;
  const key = (t) => `${t.from.id}>${t.to.id}`;
  const chain = target ? new Set(chainOf(g.props, target).map(key)) : null;
  for (const t of all) {
    if (t.from.hidden || t.to.hidden) continue;
    const [x0, y0] = threadAnchor(t.from);
    const [x1, y1] = threadAnchor(t.to);
    // рядом с героем нить видна и без прицела
    const near = Math.min(Math.hypot(p.x - x0, p.y - y0), Math.hypot(p.x - x1, p.y - y1)) < 80;
    const hot = chain?.has(key(t)) || near || g.gazeK > 0.5;
    if (!hot && !t.on) continue;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const sag = Math.min(18, len * 0.12);
    const n = Math.max(6, Math.floor(len / 3));
    const a = (hot ? (t.on ? 0.95 : 0.8) : 0.3) * g.gazeK;
    const col = t.on ? P.amberHi : hot ? '#e0a040' : '#b8721f';
    ctx.globalAlpha = a;
    for (let i = 0; i <= n; i++) {
      if (!t.on && i % 2) continue; // ослабленная нить — пунктиром
      const k = i / n;
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag;
      px(ctx, Math.round(x), Math.round(y), 1, 1, col);
    }
    if (t.on) {
      // бусины бегут от причины к следствию
      for (let b = 0; b < Math.max(1, Math.floor(len / 40)); b++) {
        const k = ((g.time * 40) / len + b / Math.max(1, Math.floor(len / 40))) % 1;
        const x = x0 + (x1 - x0) * k;
        const y = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * sag;
        px(ctx, Math.round(x) - 1, Math.round(y) - 1, 2, 2, P.milk);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ── подсветка выбранного (Diablo-подход) ───────────────────────────────
// Контур силуэта в 4 стороны на полпикселя мира и сам кадр поверх света — объект
// «загорается». Цвет: тёплый молочный — взаимодействие, янтарь/малиновый — во что
// превратит сдвиг. Сдвинутые объекты держат тонкий контур своей фазы, мигающий перед возвратом.
const WARM = '#ffe9b0';
const nextPhaseOf = (tl) => (isShifted(tl) ? tl.base : tl.phase === PAST ? 'present' : 'past');

function outlineEntry(ctx, e, x, y, color, a) {
  const tint = atlas.tinted(e.key, e, color);
  ctx.globalAlpha = a;
  for (const [dx, dy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]) blit(ctx, tint, x + dx, y + dy);
  ctx.globalAlpha = 1;
}

function lightUpProp(g, ctx, o, color, a, relit = true) {
  if (o.def.flat) {
    // плоское (мост, пролёт): светящаяся рамка по краю площадки
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = a;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 2]);
    ctx.lineDashOffset = -g.time * 8;
    ctx.strokeRect(o.x + 0.25, o.y + 0.25, o.w - 0.5, o.h - 0.5);
    ctx.restore();
    return;
  }
  if (!o.def.cache || o.nocache) return;
  const e = propEntry(g, o, o.tl.phase);
  outlineEntry(ctx, e, o.x, o.y, color, a);
  if (relit) {
    ctx.globalAlpha = 0.8;
    blit(ctx, e, o.x, o.y);
    ctx.globalAlpha = 1;
  }
}

function lightUpEnemy(g, ctx, e, color) {
  const o = enemyOpts(e);
  ctx.globalAlpha = 0.95;
  for (const [dx, dy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]]) drawEnemyC(ctx, e.kind, e.x + dx, e.y + dy, o, color);
  ctx.globalAlpha = 0.75;
  drawEnemyC(ctx, e.kind, e.x, e.y, o);
  ctx.globalAlpha = 1;
}

function drawHighlights(g, ctx, p) {
  const pulse = 0.75 + 0.25 * Math.sin(g.time * 5);
  // сдвинутые объекты: тонкий контур своей фазы, мигает перед возвратом
  for (const o of g.props) {
    if (o.hidden || !o.tl.switchable || !isShifted(o.tl) || o === p.shiftTarget?.obj) continue;
    if (!visible(o.x, o.y, 64)) continue;
    if (isFading(o.tl) && Math.floor(g.time * 10) % 2 === 0) continue;
    lightUpProp(g, ctx, o, PHASE_COLOR[o.tl.phase], 0.55, false);
  }
  const it = g.interactTarget;
  const t = p.shiftTarget;
  if (it && it !== t?.obj) lightUpProp(g, ctx, it, WARM, pulse);
  else if (!it && g.interactNear && g.interactNear !== t?.obj) lightUpProp(g, ctx, g.interactNear, WARM, 0.35, false);
  let lit = null;
  if (it && it !== t?.obj) lit = it;
  if (t && t.type !== 'projectile') targetBrackets(g, ctx, t);
  if (t) {
    const c = PHASE_COLOR[nextPhaseOf(t.obj.tl)];
    if (t.type === 'enemy') lightUpEnemy(g, ctx, t.obj, c);
    else if (t.type === 'projectile') ring(ctx, t.x, t.y, 6 + Math.floor(g.time * 4) % 2, c, 1);
    else lightUpProp(g, ctx, t.obj, c, pulse);
    if (t.type !== 'projectile') lit = lit && lit.y > t.obj.y ? lit : t.obj;
  }
  // подсвеченное рисуется поверх сцены — если герой стоит перед ним, вернуть героя вперёд
  if (lit && !lit.def?.flat && p.y > lit.y && !(p.invuln > 0 && p.dodge <= 0)) {
    const half = (lit.def?.cache?.w ?? 20) / 2 + 8;
    const up = lit.def?.cache?.ay ?? 30;
    if (Math.abs(p.x - lit.x) < half && p.y - 26 < lit.y && p.y > lit.y - up) drawHeroC(ctx, p.x, p.y, heroOpts(g, p));
  }
}

// Таблички над объектами: имя, действие с клавишей, цена сдвига и заполнение канала.
const ENEMY_TOP = (e) => e.y - (e.hitY ?? 9) - 20;
function propTop(o) {
  if (o.def.flat) return o.y + o.h / 2 - 6;
  const my = typeof o.markY === 'function' ? o.markY(o) : o.markY;
  return o.y - (my ?? o.def.cache?.ay ?? 30) - 2;
}

function plates(g, p, cx, cy) {
  const dev = g.input.device;
  const keyE = dev === 'pad' ? 'B' : dev === 'touch' ? '✋' : 'E';
  const keyQ = dev === 'pad' ? 'Y' : dev === 'touch' ? '⧗' : 'Q';
  const out = [];
  const at = (o, x, y) => {
    let pl = out.find((q) => q.obj === o);
    if (!pl) {
      pl = { obj: o, id: o.id ?? o.kind, x: (x - cx) / W, y: (y - cy) / H, name: '', lines: [], tone: 'warm' };
      out.push(pl);
    }
    return pl;
  };
  // во взгляде подписи уже висят над всем — табличка взаимодействия не нужна
  // «подойди ближе» больше не пишем: объект рядом отмечен значком над ним (drawActionIcons)
  // в бою табличка одна — цель сдвига; взаимодействие ждёт конца боя (аудит: приоритет UI)
  const it = g.gazeK > 0.5 || g.inCombat ? null : g.interactTarget;
  if (it) {
    const [mx] = propCenter(it);
    const pl = at(it, mx, propTop(it));
    pl.lines.push({ key: keyE, text: it.prompt || 'Осмотреть' });
  }
  const t = p.shiftTarget;
  if (t && t.type !== 'projectile') {
    const o = t.obj;
    const enemy = t.type === 'enemy';
    const pl = enemy ? at(o, o.x, ENEMY_TOP(o)) : at(o, propCenter(o)[0], propTop(o));
    const next = nextPhaseOf(o.tl);
    pl.name = enemy ? o.def?.name || '' : o.name || o.def?.name || '';
    pl.tone = next === 'past' ? 'past' : 'present';
    const cost = heatCost(p.heat, g.time, isShifted(o.tl) || p.echo > 0 || g.freeShift ? 0 : o.tl.cost);
    pl.lines.push({ key: keyQ, text: next === 'past' ? 'в прошлое' : 'в настоящее', cost });
    if (p.channel && p.channel.target.obj === o) pl.progress = channelProgress(p.channel);
  }
  if (out.length === 2 && Math.abs(out[0].x - out[1].x) < 0.12 && Math.abs(out[0].y - out[1].y) < 0.1) out[1].y = out[0].y - 0.09;
  return out;
}

// Цель сдвига: ступенчатый эллипс под ногами и песочные часы цвета будущей фазы.
function drawTargetMarker(g, ctx, tgt, p) {
  const o = tgt.obj;
  const tl = o.tl;
  const nextPhase = isShifted(tl) ? tl.base : tl.phase === PAST ? 'present' : 'past';
  const c = PHASE_COLOR[nextPhase];
  let fx = tgt.x;
  let fy = tgt.y;
  let top = tgt.y - 14;
  let rr = 8;
  if (tgt.type === 'enemy') {
    fx = o.x;
    fy = o.y;
    top = o.y - (o.hitY ?? 9) - 20;
    rr = (o.r ?? 5) + 5;
  } else if (tgt.type === 'prop' && o.def && !o.def.flat) {
    fx = o.x;
    fy = o.y;
    top = o.y - ((typeof o.markY === 'function' ? o.markY(o) : o.markY) ?? o.def.cache?.ay ?? 30) - 6;
    rr = Math.max(8, (o.def.foot?.w ?? 10) / 2 + 4);
  }
  const pulse = Math.floor(g.time * 4) % 2;
  // форма метки говорит, что выбрано: враг — эллипс, объект — ромб на земле, снаряд — кольцо вокруг
  if (tgt.type === 'enemy') ring(ctx, fx, fy - 1, rr + pulse, c, 0.42);
  else if (tgt.type === 'projectile') {
    ring(ctx, fx, fy, 6 + pulse, c, 1);
    return;
  } else {
    const R = rr + 2 + pulse;
    const h = Math.round(R * 0.45);
    ctx.fillStyle = c;
    for (let i = 0; i <= R; i++) {
      const dy = Math.round((h * (R - i)) / R);
      ctx.fillRect(Math.round(fx - i), Math.round(fy - 1 - dy), 1, 1);
      ctx.fillRect(Math.round(fx + i), Math.round(fy - 1 - dy), 1, 1);
      ctx.fillRect(Math.round(fx - i), Math.round(fy - 1 + dy), 1, 1);
      ctx.fillRect(Math.round(fx + i), Math.round(fy - 1 + dy), 1, 1);
    }
  }
  const pr = p.channel && p.channel.target.obj === o ? channelProgress(p.channel) : 0;
  const cost = isShifted(tl) || p.echo > 0 || g.freeShift ? 0 : tl.cost;
  const key = `hg|${c}|${Math.floor(pr * 4)}|${cost}`;
  const e = atlas.sprite(key, 9, 14, 4, 0, (bc, ax) => paintHourglass(bc, ax, 0, c, pr, cost));
  blit(ctx, e, fx, Math.round(top) - pulse);
}

function paintHourglass(ctx, x, y, c, pr, cost) {
  const rows = [5, 5, 3, 1, 3, 5, 5];
  rows.forEach((w, j) => px(ctx, x - (w >> 1) - 1, y + j, w + 2, 1, P.ink));
  rows.forEach((w, j) => {
    const sand = j < 3 ? pr < 1 - j / 3 : pr >= (6 - j) / 3;
    px(ctx, x - (w >> 1), y + j, w, 1, sand ? c : P.slate);
  });
  px(ctx, x - 3, y, 7, 1, c);
  px(ctx, x - 3, y + 6, 7, 1, c);
  for (let i = 0; i < cost; i++) px(ctx, x - 1 + i * 2 - (cost - 1), y + 9, 1, 2, P.teal);
}

function paintFlash(ctx, x, y, fr, c) {
  const L = fr === 0 ? 6 : 4;
  px(ctx, x - L, y, L * 2 + 1, 1, c);
  px(ctx, x, y - L, 1, L * 2 + 1, c);
  px(ctx, x - 1, y - 1, 3, 3, '#ffffff');
  if (fr === 0) {
    px(ctx, x - 3, y - 3, 1, 1, c);
    px(ctx, x + 3, y - 3, 1, 1, c);
    px(ctx, x - 3, y + 3, 1, 1, c);
    px(ctx, x + 3, y + 3, 1, 1, c);
  }
}

// Взаимодействие: пиктограмма действия в пузыре и клавиша под ним.
const ICON = {
  eye: ['0111110', '1100011', '1011101', '1100011', '0111110'],
  talk: ['1111111', '1000001', '1010101', '1000001', '1111011', '0000110'],
  hand: ['0010100', '0110110', '1111110', '1111110', '0111100'],
  drop: ['0001000', '0011100', '0111110', '0111110', '0011100'],
  fire: ['0010000', '0011000', '0111100', '1111110', '0111100'],
  map: ['1111111', '1001001', '1010101', '1001001', '1111111'],
};

function iconFor(obj) {
  if (obj.icon) return obj.icon;
  const t = obj.prompt || '';
  if (/Поговор|Погладить/.test(t)) return 'talk';
  if (/Осмотр|Ящик/.test(t)) return 'eye';
  if (/Напи/.test(t)) return 'drop';
  if (/Печь/.test(t)) return 'fire';
  if (/Стол/.test(t)) return 'map';
  return 'hand';
}

function drawInteractMarker(g, ctx, obj) {
  const [cx, cy] = propCenter(obj);
  const my = typeof obj.markY === 'function' ? obj.markY(obj) : obj.markY;
  const top = obj.def.flat ? cy - 8 : obj.y - (my ?? 30);
  const bob = Math.floor(g.time * 3) % 2;
  const label = g.input.device === 'pad' ? 'B' : g.input.device === 'touch' ? '' : 'E';
  const icon = iconFor(obj);
  const e = atlas.sprite(`ia32|${icon}|${label}`, 18, 22, 9, 0, (bc, ax) => paintBubbleHd(bc, ax, icon, label), { hd: true, crisp: true, outline: OUTLINE });
  blit(ctx, e, cx, top - 16 - bob);
}

// Пузырь взаимодействия в 32-битной сетке: тёмная подложка с янтарной каймой, крупная
// пиктограмма действия и клавиша (E / B) отдельной «кнопкой» под хвостиком.
function paintBubbleHd(c, x, icon, label) {
  const amber = '#ffd27a';
  c.fillStyle = '#16131e';
  c.beginPath();
  c.roundRect(x - 8, 0.5, 16, 11.5, 2.5);
  c.fill();
  c.strokeStyle = '#e0a040';
  c.lineWidth = 0.6;
  c.stroke();
  c.beginPath();
  c.moveTo(x - 2, 12);
  c.lineTo(x, 14.4);
  c.lineTo(x + 2, 12);
  c.fillStyle = '#e0a040';
  c.fill();
  const cy = 6.2;
  c.fillStyle = amber;
  c.strokeStyle = amber;
  c.lineWidth = 0.7;
  c.lineCap = 'round';
  c.beginPath();
  if (icon === 'eye') {
    c.ellipse(x, cy, 4.6, 2.6, 0, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(x, cy, 1.4, 0, Math.PI * 2);
    c.fill();
  } else if (icon === 'talk') {
    c.roundRect(x - 4.6, cy - 3, 9.2, 5.4, 1.6);
    c.stroke();
    for (const dx of [-2.2, 0, 2.2]) c.fillRect(x + dx - 0.5, cy - 0.8, 1, 1);
    c.beginPath();
    c.moveTo(x - 2, cy + 2.4);
    c.lineTo(x - 3, cy + 4);
    c.lineTo(x, cy + 2.4);
    c.fill();
  } else if (icon === 'hand') {
    c.roundRect(x - 2.6, cy - 0.6, 5.6, 4, 1.4);
    c.fill();
    for (let i = 0; i < 4; i++) c.fillRect(x - 2.4 + i * 1.4, cy - 3.6 + (i === 0 || i === 3 ? 1 : 0), 1, 3.4);
    c.fillRect(x + 3, cy - 0.4, 1.6, 1);
  } else if (icon === 'drop') {
    c.moveTo(x, cy - 4);
    c.quadraticCurveTo(x + 3.4, cy + 0.6, x, cy + 3.6);
    c.quadraticCurveTo(x - 3.4, cy + 0.6, x, cy - 4);
    c.fill();
  } else if (icon === 'fire') {
    c.moveTo(x - 3, cy + 3.4);
    c.quadraticCurveTo(x - 3.6, cy - 1, x - 0.6, cy - 4);
    c.quadraticCurveTo(x, cy - 1, x + 1.4, cy - 2);
    c.quadraticCurveTo(x + 3.6, cy + 0.6, x + 3, cy + 3.4);
    c.closePath();
    c.fill();
    c.fillStyle = '#fff4d0';
    c.beginPath();
    c.ellipse(x, cy + 1.6, 1, 1.6, 0, 0, Math.PI * 2);
    c.fill();
  } else {
    c.rect(x - 4.4, cy - 3, 8.8, 6);
    c.stroke();
    c.beginPath();
    c.moveTo(x - 1.4, cy - 3);
    c.lineTo(x - 1.4, cy + 3);
    c.moveTo(x + 1.4, cy - 3);
    c.lineTo(x + 1.4, cy + 3);
    c.stroke();
  }
  if (label) {
    c.fillStyle = '#05060c';
    c.beginPath();
    c.roundRect(x - 3.6, 15, 7.2, 6.6, 1.2);
    c.fill();
    c.fillStyle = '#3a3b47';
    c.beginPath();
    c.roundRect(x - 3, 15.4, 6, 5.4, 1);
    c.fill();
    c.fillStyle = '#ece4cf';
    c.font = 'bold 6px "Pixelify Sans", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, x, 18.3);
  }
}

function paintBubble(ctx, x, icon, label) {
  px(ctx, x - 6, 0, 13, 10, P.ink);
  px(ctx, x - 5, 1, 11, 8, '#1c1a26');
  px(ctx, x - 5, 1, 11, 1, P.amber1);
  px(ctx, x - 1, 10, 3, 1, P.ink);
  px(ctx, x, 11, 1, 1, P.ink);
  ICON[icon].forEach((row, j) => [...row].forEach((v, i) => v === '1' && px(ctx, x - 3 + i, 2 + j, 1, 1, P.amberHi)));
  if (label) {
    px(ctx, x - 3, 13, 7, 7, P.ink);
    px(ctx, x - 2, 14, 5, 5, P.ash1);
    drawDigits(ctx, x - 1, 14, label, P.milk);
  }
}


// Сводка для отладочного оверлея (обновляется каждый кадр).
export const frameStats = { objects: 0, lights: 0, culled: 0, sec: {} };
// Счётчик вызовов (подставляет оверлей): разбивка кадра по разделам для поиска пиков.
let callProbe = () => 0;
export const setCallProbe = (f) => (callProbe = f);
let secT = 0;
const sec = (name) => {
  const n = callProbe();
  frameStats.sec[name] = n - secT;
  secT = n;
};

export function renderWorld(g, ctx) {
  atlas.beginFrame?.();
  const room = g.room;
  const q = g.quality;
  setShadowStyle(q.shadows);
  ctx.fillStyle = P.void;
  ctx.fillRect(0, 0, W, H);
  if (!room) return;
  ensureLight();
  const shake = g.cam.shakeT > 0 && g.save.settings.screenShake ? g.cam.shakeA : 0;
  // камера — с шагом пикселя плотной сетки: движение вдвое плавнее
  const cx = Math.round((g.cam.x + (Math.random() - 0.5) * shake * 2) * RS) / RS;
  const cy = Math.round((g.cam.y + (Math.random() - 0.5) * shake * 2) * RS) / RS;
  view = { x0: cx, y0: cy, x1: cx + W, y1: cy + H };
  secT = callProbe();
  let drawn = 0;
  let culled = 0;

  // параллакс неба (экранные координаты) — под прозрачной полосой холста комнаты
  room.def.drawParallax?.(g, ctx, cx, cy, q);
  // поле Стирания под дырами пустоты — один fillRect узором
  if (!room.def.paint || room.def.voidField) drawVoidField(g, ctx, cx, cy);

  ctx.save();
  ctx.translate(-cx, -cy);
  // только видимая часть запечённой комнаты
  const rc = g.roomCanvas;
  const rk = rc.rs || 1;
  const sx = Math.max(0, cx);
  const sy = Math.max(0, cy);
  const sw = Math.min(rc.width / rk - sx, W + (cx < 0 ? cx : 0));
  const sh = Math.min(rc.height / rk - sy, H + (cy < 0 ? cy : 0));
  if (sw > 0 && sh > 0) ctx.drawImage(rc, sx * rk, sy * rk, sw * rk, sh * rk, sx, sy, sw, sh);
  const x0 = Math.max(0, Math.floor(cx / TILE));
  const y0 = Math.max(0, Math.floor(cy / TILE));
  drawVoidLayer(g, ctx, x0, y0, x0 + Math.ceil(W / TILE) + 1, y0 + Math.ceil(H / TILE) + 1);
  if (room.pastCanvas && g.memIslands?.length) drawMemoryIslands(g, ctx);
  else if (g.memIslands?.length) drawAuraRims(g, ctx);

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

  sec('пол');
  room.def.drawFloor?.(g, ctx, q);

  // плоские объекты
  for (const p of g.props) {
    if (!p.def.flat || p.hidden) continue;
    if (!visible(p.x + p.w / 2, p.y + p.h, p.h + 16, p.w / 2 + 16)) {
      culled++;
      continue;
    }
    drawProp(g, ctx, p);
    drawn++;
  }
  for (const pk of g.pickups) if (visible(pk.x, pk.y, 16, 8)) drawPickup(ctx, pk, g.time);
  // мокрый камень: отражения огней и персонажей, всплески
  drawWet(g, ctx, cx, cy, reflectFigures(g));

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
  sec('декор пола');
  for (const it of list) {
    drawn++;
    if (it.kind === 'prop') {
      const p = it.o;
      // высокий декор перед героем становится полупрозрачным — бой не закрывается
      const c = p.def.cache;
      const hero = g.player;
      const cover = c && c.ay > 28 && hero && hero.y < p.y && Math.abs(hero.x - p.x) < c.w / 2 + 4 && hero.y > p.y - c.ay - 4;
      if (cover) ctx.globalAlpha = 0.45;
      drawProp(g, ctx, p);
      if (cover) ctx.globalAlpha = 1;
    } else if (it.kind === 'enemy') drawEnemy(g, ctx, it.o);
    else if (it.kind === 'hero') drawHeroSprite(g, ctx, it.o);
    else if (it.draw) it.draw(ctx, g);
  }

  sec('спрайты');
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
  sec('снаряды+частицы');
  for (const f of g.fx) drawFxItem(ctx, f);
  drawArtOver(g, ctx, cx, cy, W, H);
  room.def.drawOver?.(g, ctx, q);
  ctx.restore();
  sec('эффекты');

  ambientAsh(g, ctx);
  drawFog(g, ctx, cx, cy);
  drawLighting(g, ctx, cx, cy);
  drawRain(g, ctx);
  drawLeaves(g, ctx);
  drawVignette(g, ctx);
  // Взгляд Смотрителя: мир гаснет в холодный тон, интерактивное подсвечивается поверх
  if (g.gazeK > 0) {
    ctx.fillStyle = `rgba(6,10,24,${0.5 * g.gazeK})`;
    ctx.fillRect(0, 0, W, H);
  }
  sec('свет');

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
  // как в Diablo: на земле под объектом маркеров нет — светится сам объект,
  // а имя и действие пишутся табличкой над ним (HTML-слой, src/ui/overlay.js)
  if (p && !p.dead && !g.cinematic && !g.inCombat) drawActionIcons(g, ctx, p);
  if (p && !p.dead && !g.cinematic && g.gazeK > 0) drawGaze(g, ctx, p, cx, cy);
  if (p && !p.dead && !g.cinematic) drawThreads(g, ctx, p);
  if (p?.echoRec) drawEchoRec(g, ctx, p);
  if (p && !p.dead && !g.cinematic) drawTimers(g, ctx, p);
  drawNodeRunes(g, ctx);
  if (p && !p.dead && !g.cinematic) drawHighlights(g, ctx, p);
  g.ui.setPlates?.(p && !p.dead && !g.cinematic && !g.ui.mode ? plates(g, p, cx, cy) : []);
  g.ui.setTags?.(p && !p.dead && !g.cinematic && !g.ui.mode ? (g.gazeK > 0.5 ? gazeTags(g, p, cx, cy) : g.inCombat ? [] : nameTags(g, p, cx, cy)) : []);
  // раскладка подписей: друг на друга, на героя и HUD не налезают
  if (p && !p.dead) g.ui.layout?.({ hero: [(p.x - 9 - cx) / W, (p.y - 30 - cy) / H, (p.x + 9 - cx) / W, (p.y + 2 - cy) / H] });
  // реплики призраков в сценах прошлого
  g.ui.setBarks?.(!g.ui.mode ? (g.barkList || []).map((b) => ({ x: (b.x - cx) / W, y: (b.y - cy) / H, who: b.who, text: b.text })) : []);
  for (const t of g.texts) {
    const k = Math.min(1, (t.life / t.max) * 2);
    ctx.globalAlpha = k;
    if (/^[\d+\-×/]+$/.test(t.text)) {
      const s = t.big ? 2 : 1;
      const w = digitsWidth(t.text, s);
      drawDigits(ctx, Math.round(t.x - w / 2) + 1, Math.round(t.y) + 1, t.text, P.ink, s);
      drawDigits(ctx, Math.round(t.x - w / 2), Math.round(t.y), t.text, t.c, s);
    } else {
      ctx.font = `700 ${t.big ? 10 : 8}px "Alegreya Sans", sans-serif`;
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
  sec('метки+цифры');
  if (q.glitch) glitch(g, ctx);
  if (g.scene === 'play') drawHud(g, ctx);
  sec('HUD');
  frameStats.objects = drawn;
  frameStats.culled = culled;
}

const heroOpts = (g, p) => ({
  dir: p.dir, flip: p.flip, t: g.time, walk: p.walk, sway: p.sway, moving: p.moving, aim: p.aim,
  swing: p.swing ? p.swing.t : null, swingStep: p.swing?.step, glow: inPerfectWindow(p.combo), charges: p.charges.n,
});

const enemyOpts = (e) => ({
  phase: e.tl.phase, t: e.t, walk: e.walk, windup: e.state === 'windup', lunge: e.state === 'lunge',
  charge: e.charge, look: e.look, shield: e.kind === 'shadow' && !(e.exposed > 0),
});

// Кто отражается в лужах: герой и видимые враги на земле.
function reflectFigures(g) {
  if (g.quality.reflect < 2) return null;
  const out = [];
  const p = g.player;
  if (p && !p.dead && !(p.falling > 0)) {
    if (p.rewind) {
      // перемотка: бирюзовый след пути назад и полупрозрачный герой
      const r = p.rewind;
      out.push({
        y: p.y,
        draw: (c) => {
          c.fillStyle = P.teal;
          const from = Math.floor((r.t / r.dur) * (r.path.length - 1));
          for (let i = from; i < r.path.length; i += 3) c.fillRect(Math.round(r.path[i].x), Math.round(r.path[i].y) - 1, 1, 1);
          c.globalAlpha = 0.55;
          drawHeroC(c, p.x, p.y, heroOpts(g, p), P.teal);
          c.globalAlpha = 1;
        },
      });
    } else
      out.push({
        y: p.y,
        draw: (c) => {
          const o = heroOpts(g, p);
          figureEdge(c, g, (dx, dy, t) => drawHeroC(c, p.x + dx, p.y + dy, o, t));
          drawHeroC(c, p.x, p.y, o);
        },
      });
  }
  // запись Эха: на месте начала — полупрозрачная копия героя, там тень и появится
  if (p?.echoRec) {
    const r0 = p.echoRec;
    const f0 = r0.frames[0] || { ...r0.start, dir: p.dir, flip: p.flip, aim: p.aim };
    out.push({
      y: r0.start.y,
      draw: (c) => {
        c.globalAlpha = 0.35 + 0.1 * Math.sin(g.time * 6);
        drawHeroC(c, r0.start.x, r0.start.y, { dir: f0.dir, flip: f0.flip, t: g.time, aim: f0.aim, charges: 0 }, P.teal);
        c.globalAlpha = 1;
      },
    });
  }
  // Эхо: полупрозрачная бирюзовая тень героя
  const sh = g.echoShade;
  if (sh && !sh.done) {
    const ps = sh.pose;
    out.push({
      y: sh.y,
      draw: (c) => {
        c.globalAlpha = 0.5 * shadeFade(sh) + 0.15;
        drawHeroC(c, sh.x, sh.y, { dir: ps.dir, flip: ps.flip, t: g.time, walk: (sh.t * 2.2) % 1, moving: !sh.linger, aim: ps.aim, charges: 0 }, P.teal);
        c.globalAlpha = 1;
      },
    });
  }
  for (const e of g.enemies) {
    if (e.spawn > 0 || e.dead || e.draw || e.kind === 'echo' || !visible(e.x, e.y, 48)) continue;
    if (e.kind === 'framer' && isPhased(g, e)) continue;
    out.push({ y: e.y, draw: (c) => drawEnemyC(c, e.kind, e.x, e.y, enemyOpts(e)) });
  }
  return out;
}

function drawHeroSprite(g, ctx, p) {
  const o = heroOpts(g, p);
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
  // пиксельный шлейф уклонения: три силуэта по следу
  if (p.trail?.length) {
    p.trail.forEach((tp, i) => {
      ctx.globalAlpha = 0.18 + i * 0.14;
      drawHeroC(ctx, tp.x, tp.y, o, i === p.trail.length - 1 ? P.tealHi : P.blueLo);
    });
    ctx.globalAlpha = 1;
  }
  // контрсвет: тёплый в острове памяти, холодный стальной в Шраме; тонкий — полпикселя мира
  const warm = g.memIslands?.length && inIslands(g.memIslands, p.x, p.y);
  ctx.globalAlpha = 0.85;
  drawHeroC(ctx, p.x - 0.5, p.y - 0.5, o, warm ? P.amber : '#8fa3c8');
  ctx.globalAlpha = 1;
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

// Свет 32-битного кадра: тьма в половинном разрешении с мягкими масками (растягивается
// сглаженно), затем цветные ореолы огней сложением цветов — тёплые острова в холодной ночи.
// Число источников — по профилю, лишние гасятся по удалённости от героя.
function drawLighting(g, ctx, cx, cy) {
  const dark = g.room.def.dark ?? 0.45;
  frameStats.lights = 0;
  if (dark <= 0) return;
  const q = g.quality;
  const lc = lightCtx;
  const t = g.time;
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, W / 2, H / 2);
  // тьма с холодным лунным оттенком: тёплые огни на её фоне читаются ярче
  lc.fillStyle = g.room.def.darkColor || `rgba(6,10,30,${Math.min(0.92, dark * 1.12)})`;
  lc.fillRect(0, 0, W / 2, H / 2);
  lc.globalCompositeOperation = 'destination-out';
  const p = g.player;
  const list = [];
  if (p) list.push({ x: p.x, y: p.y - 8, r: 50, s: 0.8, hero: true });
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
    // высокий источник (фонарь на столбе) светит на землю под собой: центр — между огнём и основанием
    const ly = l.base != null ? (l.y + l.base) / 2 + 4 : l.y;
    const m = softMask((l.r * (l.hero ? 1 : 1.15)) / 2, l.s);
    const r = m.width / 2;
    lc.drawImage(m, (l.x - cx) / 2 - r, (ly - cy) / 2 - r);
  }
  frameStats.lights = list.length;
  lc.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, 0, 0, W, H);
  ctx.restore();
  if (!q.bloom) return;
  // цветной свет: широкое пятно на земле и яркое ядро у источника (лёгкое мерцание огня)
  ctx.globalCompositeOperation = 'lighter';
  for (const l of list) {
    if (l.hero) continue;
    const c = l.c === 'cold' ? 'cold' : l.c;
    const flick = c === 'amber' || c === 'fire' ? 0.9 + 0.1 * Math.sin(t * 11 + l.x) * Math.sin(t * 7.3 + l.y) : 1;
    ctx.globalAlpha = flick;
    // пятно на земле (эллипс в перспективе), ореол вокруг огня и яркое ядро
    const gy = l.base ?? l.y + 6;
    const wide = glow(Math.round(l.r * 1.2), c, c === 'cold' ? 0.12 : 0.36, 0.55);
    ctx.drawImage(wide, l.x - cx - wide.width / 2, gy - cy - wide.height / 2);
    if (l.base != null && l.base - l.y > 16) {
      const halo = glow(Math.round(l.r * 0.55), c, 0.22);
      ctx.drawImage(halo, l.x - cx - halo.width / 2, l.y - cy - halo.height / 2);
    }
    const core = glow(Math.max(5, Math.round(l.r * 0.18)), c, 0.85);
    ctx.drawImage(core, l.x - cx - core.width / 2, l.y - cy - core.height / 2);
  }
  // излучатели без собственного света: глаза врагов, снаряды
  for (const e of g.enemies) {
    if (e.spawn > 0 || e.dead || !visible(e.x, e.y, 60)) continue;
    const c = e.tl?.phase === PAST ? 'amber' : 'crimson';
    const gl = glow(6, c, 0.2);
    ctx.globalAlpha = 1;
    ctx.drawImage(gl, e.x - cx - 6, e.y - cy - (e.hitY ?? 9) - 12);
  }
  // подбираемое светится своим цветом — его видно в темноте
  const PK_GLOW = { ash: 'amber', shard: 'teal', heal: 'amber', fragment: 'amber', scrap: 'milk' };
  for (const pk of g.pickups) {
    if (!visible(pk.x, pk.y, 16, 8)) continue;
    const gl = glow(9, PK_GLOW[pk.kind] || 'amber', 0.45);
    ctx.drawImage(gl, pk.x - cx - 9, pk.y - cy - 15);
  }
  for (const e of g.enemies) {
    if (e.spawn > 0 || e.dead || e.draw || !visible(e.x, e.y, 30)) continue;
    const gr = glow(Math.round((SHADOW_W[e.kind] ?? 12) / 2 + 6), e.tl?.phase === PAST ? 'amber' : 'crimson', 0.3, 0.42);
    ctx.drawImage(gr, e.x - cx - gr.width / 2, e.y - cy - gr.height / 2);
  }
  for (const pr of g.projectiles) {
    const c = pr.tl?.phase === PAST ? 'amber' : 'crimson';
    const gl = glow(12, c, 0.4);
    ctx.drawImage(gl, pr.x - cx - 12, pr.y - cy - 12);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Редкие сбои кадра — мир «проходит через неисправный экран» (не на Low).
function glitch(g, ctx) {
  const amount = g.glitch ?? 0.02;
  if (Math.random() > amount) return;
  const y = Math.floor(Math.random() * H);
  const h = 1 + Math.floor(Math.random() * 4);
  const dx = Math.random() > 0.5 ? 2 : -2;
  ctx.drawImage(ctx.canvas, 0, y * RS, W * RS, h * RS, dx, y, W, h);
}
