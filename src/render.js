// Отрисовка комнаты: пол, пустоты, объекты, персонажи по глубине, эффекты, свет, HUD.
import { W, H } from './core/renderer.js';
import { P, PHASE_COLOR } from './art/palette.js';
import { TILE, T } from './art/tiles.js';
import { tileAt } from './world/room.js';
import { px, line, disc, ring, drawHero, drawHollow, drawFramer, drawRinger, drawShadow, drawEater, whiteK } from './art/sprites.js';
import { propSortY, propCenter } from './world/props.js';
import { isPhased } from './enemies/enemies.js';
import { isShifted, isFading, PAST, channelProgress } from './timeline/timeline.js';
import { inPerfectWindow } from './combat/combo.js';
import { revealedAt } from './world/world.js';
import { drawHud, drawDigits, digitsWidth } from './ui/hud.js';
import { hash2 } from './core/math.js';

let lightCanvas = null;
let lightCtx = null;

function ensureLight() {
  if (lightCanvas && lightCanvas.width === W / 2) return;
  lightCanvas = document.createElement('canvas');
  lightCanvas.width = W / 2;
  lightCanvas.height = H / 2;
  lightCtx = lightCanvas.getContext('2d');
}

const ENEMY_DRAW = { hollow: drawHollow, framer: drawFramer, ringer: drawRinger, shadow: drawShadow, eater: drawEater };

// Двойной контур фазы: силуэт цвета фазы со сдвигом на пиксель.
function withOutline(ctx, color, fn) {
  const k = () => color;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    ctx.save();
    ctx.translate(dx, dy);
    fn(k);
    ctx.restore();
  }
  fn(null);
}

function drawVoidLayer(g, ctx, x0, y0, x1, y1) {
  const room = g.room;
  const t = g.time;
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
          voidSquares(ctx, x, y, tx, ty, t);
        }
        continue;
      }
      if (tile !== T.VOID) continue;
      voidSquares(ctx, x, y, tx, ty, t);
    }
  }
}

// Дрейфующие квадраты Стирания в пустоте.
function voidSquares(ctx, x, y, tx, ty, t) {
  for (let i = 0; i < 3; i++) {
    const r = hash2(tx * 3 + i, ty * 7, 11);
    const speed = 4 + r * 8;
    const yy = (y + 16 - ((t * speed + r * 16) % 16)) | 0;
    const xx = (x + hash2(tx, ty * 5 + i, 3) * 15) | 0;
    const c = r > 0.8 ? P.crimson1 : r > 0.4 ? P.crimson0 : '#0d0a18';
    ctx.fillStyle = c;
    ctx.fillRect(xx, yy, r > 0.85 ? 2 : 1, r > 0.85 ? 2 : 1);
  }
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

function drawEnemy(g, ctx, e) {
  if (e.draw) {
    e.draw(ctx, e, g);
    return;
  }
  const fn = ENEMY_DRAW[e.kind];
  const o = {
    phase: e.tl.phase, t: e.t, walk: e.walk, windup: e.state === 'windup', lunge: e.state === 'lunge',
    charge: e.charge, look: e.look, shield: e.kind === 'shadow' && !(e.exposed > 0),
  };
  if (e.spawn > 0) {
    // собирается из квадратов
    const k = 1 - e.spawn / 0.6;
    for (let i = 0; i < 16; i++) {
      const r = hash2(e.id, i, 1);
      const a = r * Math.PI * 2;
      const d = (1 - k) * 18;
      px(ctx, e.x + Math.cos(a) * d - 1, e.y - 8 + Math.sin(a) * d * 0.7 - hash2(i, e.id, 2) * 10, 2, 2, i % 2 ? P.crimson : P.ink);
    }
    return;
  }
  if (e.kind === 'echo') {
    ctx.globalAlpha = 0.6 + Math.sin(e.t * 20) * 0.2;
    drawHero(ctx, e.x, e.y, { dir: 'down', t: e.t, aim: e.face, k: () => (Math.random() > 0.15 ? P.crimson : P.crimsonHi), charges: 0 });
    ctx.globalAlpha = 1;
    return;
  }
  if (e.kind === 'framer' && isPhased(g, e)) {
    // пропущенный кадр: почти невидим
    if (Math.floor(e.t * 30) % 5 === 0) {
      ctx.globalAlpha = 0.25;
      fn(ctx, e.x + (Math.random() - 0.5) * 3, e.y, { ...o, k: () => P.crimson });
      ctx.globalAlpha = 1;
    }
    return;
  }
  const flash = e.flash > 0;
  const shifted = isShifted(e.tl);
  const fading = isFading(e.tl) && Math.floor(g.time * 10) % 2 === 0;
  if (shifted && !fading) {
    withOutline(ctx, PHASE_COLOR[e.tl.phase], (k) => fn(ctx, e.x, e.y, { ...o, k: flash ? whiteK : k || undefined }));
  } else {
    fn(ctx, e.x, e.y, { ...o, k: flash ? whiteK : undefined });
  }
  if (e.kind === 'shadow') fn(ctx, e.x, e.y, { ...o, layer: 'front', k: flash ? whiteK : undefined });
  if (e.burn > 0 && Math.floor(g.time * 12) % 2) px(ctx, e.x - 2 + Math.random() * 4, e.y - 18 - Math.random() * 6, 1, 2, P.amberHi);
  if (e.tl.flash > 0.5) ring(ctx, e.x, e.y - 8, 10 * (1 - e.tl.flash) + 6, PHASE_COLOR[e.tl.phase]);
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

export function renderWorld(g, ctx) {
  const room = g.room;
  ctx.fillStyle = P.void;
  ctx.fillRect(0, 0, W, H);
  if (!room) return;
  ensureLight();
  const shake = g.cam.shakeT > 0 && g.save.settings.screenShake ? g.cam.shakeA : 0;
  const cx = Math.round(g.cam.x + (Math.random() - 0.5) * shake * 2);
  const cy = Math.round(g.cam.y + (Math.random() - 0.5) * shake * 2);
  ctx.save();
  ctx.translate(-cx, -cy);
  ctx.drawImage(g.roomCanvas, 0, 0);
  const x0 = Math.max(0, Math.floor(cx / TILE));
  const y0 = Math.max(0, Math.floor(cy / TILE));
  drawVoidLayer(g, ctx, x0, y0, x0 + W / TILE + 1, y0 + H / TILE + 1);

  // зоны стирания
  for (const z of g.voidZones) {
    if (!z.active) {
      const k = 1 - z.warn;
      ring(ctx, z.x, z.y, z.r * (0.4 + k * 0.6), Math.floor(g.time * 12) % 2 ? P.crimsonHi : P.crimson, 0.7, 2);
    } else {
      ctx.fillStyle = P.void;
      for (let yy = -z.r; yy <= z.r; yy++) {
        const w = Math.sqrt(z.r * z.r - yy * yy);
        ctx.fillRect(Math.round(z.x - w), Math.round(z.y + yy * 0.7), Math.round(w * 2), 1);
      }
      for (let i = 0; i < 8; i++) {
        const a = hash2(i, z.x | 0, 1) * Math.PI * 2 + g.time;
        px(ctx, z.x + Math.cos(a) * z.r * 0.8, z.y + Math.sin(a) * z.r * 0.55, 2, 2, P.crimson);
      }
    }
  }

  room.def.drawFloor?.(g, ctx);

  // плоские объекты
  const flat = g.props.filter((p) => p.def.flat && !p.hidden).sort((a, b) => a.y - b.y);
  for (const p of flat) p.def.draw(ctx, p, g);
  for (const pk of g.pickups) drawPickup(ctx, pk, g.time);

  // сортировка по глубине
  const list = [];
  for (const p of g.props) if (!p.def.flat && !p.hidden) list.push({ y: propSortY(p), kind: 'prop', o: p });
  for (const e of g.enemies) list.push({ y: e.y, kind: 'enemy', o: e });
  if (g.player && !g.player.dead) list.push({ y: g.player.y, kind: 'hero', o: g.player });
  for (const extra of g.drawables) list.push(extra);
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.kind === 'prop') {
      const p = it.o;
      p.def.draw(ctx, p, g);
      if (isShifted(p.tl) && p.tl.switchable && !p.def.flat) {
        const [mx, my] = propCenter(p);
        const fading = isFading(p.tl) && Math.floor(g.time * 10) % 2 === 0;
        if (!fading) ring(ctx, mx, p.y - 1, 9, PHASE_COLOR[p.tl.phase], 0.4, 2);
        void my;
      }
    } else if (it.kind === 'enemy') drawEnemy(g, ctx, it.o);
    else if (it.kind === 'hero') drawHeroSprite(g, ctx, it.o);
    else if (it.draw) it.draw(ctx, g);
  }

  for (const pr of g.projectiles) drawProjectile(g, ctx, pr);
  for (const f of g.fx) drawFxItem(ctx, f);
  room.def.drawOver?.(g, ctx);
  ctx.restore();

  drawLighting(g, ctx, cx, cy);

  // поверх света: метки, полоски здоровья, цифры
  ctx.save();
  ctx.translate(-cx, -cy);
  for (const e of g.enemies) {
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
    const k = Math.min(1, t.life / t.max * 2);
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
    ctx.fillStyle = `rgba(200,40,74,${p.hurtFlash * 1.2})`;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillRect(0, 0, 3, H);
    ctx.fillRect(W - 3, 0, 3, H);
  }
  if (p && p.hp / p.maxHp < 0.3 && !p.dead) {
    ctx.fillStyle = `rgba(74,12,30,${0.18 + Math.sin(g.time * 4) * 0.08})`;
    ctx.fillRect(0, 0, W, 2);
    ctx.fillRect(0, H - 2, W, 2);
  }
  glitch(g, ctx);
  if (g.scene === 'play' || g.scene === 'hub') drawHud(g, ctx);
}

function drawHeroSprite(g, ctx, p) {
  if (p.falling > 0) {
    const k = p.falling / 0.5;
    ctx.globalAlpha = k;
    drawHero(ctx, p.x, p.y + (1 - k) * 8, { dir: p.dir, flip: p.flip, t: g.time, charges: p.charges.n });
    ctx.globalAlpha = 1;
    return;
  }
  const blink = p.invuln > 0 && p.dodge <= 0 && Math.floor(g.time * 20) % 2 === 0;
  if (blink) return;
  const o = {
    dir: p.dir, flip: p.flip, t: g.time, walk: p.walk, sway: p.sway, moving: p.moving, aim: p.aim,
    swing: p.swing ? p.swing.t : null, swingStep: p.swing?.step, glow: inPerfectWindow(p.combo), charges: p.charges.n,
  };
  if (p.dodge > 0) {
    // шлейф рывка
    ctx.globalAlpha = 0.35;
    drawHero(ctx, p.x - p.dodgeDir[0] * 8, p.y - p.dodgeDir[1] * 6, { ...o, k: () => P.blueLo });
    ctx.globalAlpha = 1;
  }
  if (p.doubleOutline > 0) {
    // двойной контур при смене состояния
    drawHero(ctx, p.x - 2, p.y, { ...o, k: () => P.amber });
    drawHero(ctx, p.x + 2, p.y, { ...o, k: () => P.crimson });
  }
  if (p.echo > 0) {
    ctx.globalAlpha = 0.5;
    drawHero(ctx, p.x + Math.sin(g.time * 30), p.y, { ...o, k: () => P.tealHi });
    ctx.globalAlpha = 1;
  }
  drawHero(ctx, p.x, p.y, { ...o, k: p.hurtFlash > 0.1 ? whiteK : undefined });
  if (p.channel) {
    const pr = channelProgress(p.channel);
    ring(ctx, p.x, p.y - 2, 6 + pr * 6, pr > 0.95 ? P.milk : P.teal, 0.5, 2);
  }
}

function drawLighting(g, ctx, cx, cy) {
  const dark = g.room.def.dark ?? 0.45;
  if (dark <= 0) return;
  const lc = lightCtx;
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, W / 2, H / 2);
  lc.fillStyle = `rgba(4,5,14,${dark})`;
  lc.fillRect(0, 0, W / 2, H / 2);
  lc.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a = 1) => {
    const sx = (x - cx) / 2;
    const sy = (y - cy) / 2;
    const sr = r / 2;
    if (sx < -sr || sy < -sr || sx > W / 2 + sr || sy > H / 2 + sr) return;
    const grd = lc.createRadialGradient(sx, sy, 0, sx, sy, sr);
    grd.addColorStop(0, `rgba(0,0,0,${a})`);
    grd.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = grd;
    lc.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  };
  const p = g.player;
  if (p) hole(p.x, p.y - 8, 90, 0.85);
  for (const l of g.lights) hole(l.x, l.y, l.r * 2, 1);
  for (const e of g.enemies) if (e.kind === 'ringer' && e.charge) hole(e.x, e.y - 8, 40, 0.6);
  for (const pr of g.projectiles) hole(pr.x, pr.y, pr.kind === 'ring' ? 30 : 24, 0.5);
  lc.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(lightCanvas, 0, 0, W, H);
  // тёплое свечение янтарных источников
  ctx.globalCompositeOperation = 'lighter';
  for (const l of g.lights) {
    if (l.c !== 'amber') continue;
    const sx = l.x - cx;
    const sy = l.y - cy;
    const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, l.r);
    grd.addColorStop(0, 'rgba(120,70,20,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(sx - l.r, sy - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Редкие сбои кадра — мир «проходит через неисправный экран».
function glitch(g, ctx) {
  const amount = g.glitch ?? 0.02;
  if (Math.random() > amount) return;
  const y = Math.floor(Math.random() * H);
  const h = 1 + Math.floor(Math.random() * 4);
  const dx = Math.round((Math.random() - 0.5) * 8);
  ctx.drawImage(ctx.canvas, 0, y, W, h, dx, y, W, h);
}
