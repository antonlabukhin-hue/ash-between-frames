// Персонажи через атлас: параметры анимации квантуются в кадры, кадр печатается один раз.
import { createAtlas, blit } from './atlas.js';
import { drawHero, drawHollow, drawFramer, drawRinger, drawShadow, drawEater, drawMel } from './sprites.js';
import { P } from './palette.js';
import { createOverrides, heroOverrideKey, enemyOverrideKey } from './overrides.js';
import { RS } from '../core/frame.js';
import { drawHero32 } from './hero32.js';
import { drawHollow32, drawFramer32, drawRinger32, drawEater32 } from './enemies32.js';
import { drawShadow32, drawMel32 } from './npcs32.js';

import { hd } from './hdflag.js';

export { hd };
const HD_OPTS = { hd: true, crisp: true };

// 32-битная сетка: кадры хранятся в RS раз плотнее мира (страницы 2048×2048)
export const atlas = createAtlas({ maxPages: 3, rs: RS });
const OUTLINE = '#05060c';
const TAU = Math.PI * 2;

// Ручные PNG-кадры (public/sprites); после загрузки атлас пересобирается.
export const overrides = createOverrides();
export function loadSpriteOverrides(base) {
  return overrides.load(base, () => atlas.reset());
}

// Выводит кадр; variant: null — обычный, иначе цвет силуэта (вспышка, двойной контур, шлейф).
// ov — смысловой ключ ручного кадра: если он есть в манифесте, кодовый кадр не рисуется.
function put(ctx, key, w, h, ax, ay, draw, x, y, variant, outline = true, ov = null, flip = false, hdDraw = null) {
  const f = ov ? overrides.get(ov) : null;
  let base;
  if (f) {
    key = `ov|${ov}|${flip ? 'm' : ''}`;
    base = atlas.sprite(key, f.w, f.h, f.ax, f.ay, (c, bx, by) => {
      c.save();
      if (flip) {
        c.translate(bx, 0);
        c.scale(-1, 1);
        c.drawImage(f.img, f.x, f.y, f.w, f.h, -(f.w - f.ax), by - f.ay, f.w, f.h);
      } else c.drawImage(f.img, f.x, f.y, f.w, f.h, bx - f.ax, by - f.ay, f.w, f.h);
      c.restore();
    }, { outline: f.outline ? OUTLINE : null });
  } else if (hdDraw && hd.on) base = atlas.sprite(`hd|${key}`, w, h, ax, ay, hdDraw, { outline: outline ? OUTLINE : null, ...HD_OPTS });
  else base = atlas.sprite(key, w, h, ax, ay, draw, { outline: outline ? OUTLINE : null });
  blit(ctx, variant ? atlas.tinted(base.key, base, variant) : base, x, y);
}

// ── герой ─────────────────────────────────────────────────────────────
export function heroKey(o) {
  const walk = o.moving ? Math.floor((o.walk || 0) * 6) % 6 : 0;
  const sway = Math.max(-1, Math.min(1, Math.round((o.sway || 0) / 2.5)));
  const aim = ((Math.round((o.aim ?? Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
  const swing = o.swing != null ? Math.min(4, Math.floor(o.swing / 0.04)) : -1;
  const hem = Math.floor((o.t || 0) * 6) % 3;
  return { walk, sway, aim, swing, hem, key: `hero|${o.dir}|${o.flip ? 1 : 0}|${walk}|${sway}|${aim}|${swing}|${o.swingStep || 0}|${o.glow ? 1 : 0}|${o.charges ?? 3}|${o.moving ? 1 : 0}|${hem}` };
}

export function drawHeroC(ctx, x, y, o, variant = null) {
  const q = heroKey(o);
  const args = {
    dir: o.dir, flip: o.flip, walk: q.walk / 6, sway: q.sway * 2.5, aim: (q.aim * Math.PI) / 4,
    swing: q.swing >= 0 ? q.swing * 0.04 : null, swingStep: o.swingStep, glow: o.glow, charges: o.charges ?? 3,
    moving: o.moving, t: q.hem * 0.35, noShadow: true,
  };
  put(ctx, q.key, 44, 44, 22, 38, (c, ax, ay) => drawHero(c, ax, ay, args), x, y, variant, true,
    heroOverrideKey(o, q), o.dir === 'side' && o.flip, (c, ax, ay) => drawHero32(c, ax, ay, args));
}

// ── враги ─────────────────────────────────────────────────────────────
const ENEMY = {
  hollow: { w: 24, h: 34, ax: 12, ay: 30, fn: drawHollow, hd: drawHollow32, label: (q) => (q.lunge ? 'lunge' : q.windup ? 'windup' : `walk${Math.round(q.walk * 4)}`), q: (o) => ({ walk: Math.floor((o.walk || 0) * 4) / 4, t: (Math.floor((o.t || 0) * 12) % 4) / 12, windup: o.windup, lunge: o.lunge }) },
  framer: { w: 30, h: 40, ax: 14, ay: 37, fn: drawFramer, hd: drawFramer32, label: (q) => `f${Math.round(q.t * 10)}${q.look ? `l${q.look}` : ''}`, q: (o) => ({ t: (Math.floor((o.t || 0) * 10) & 1) / 10, look: o.look || 0 }) },
  ringer: { w: 22, h: 30, ax: 11, ay: 27, fn: drawRinger, hd: drawRinger32, label: (q) => (q.charge ? `charge${Math.round((q.t - 0.05) * 30)}` : 'idle'), q: (o) => ({ t: o.charge ? (Math.floor((o.t || 0) * 30) & 1) / 30 + 0.05 : 0, charge: o.charge }) },
  eater: { w: 28, h: 26, ax: 14, ay: 23, fn: drawEater, hd: drawEater32, label: (q) => (q.windup ? 'bite' : `f${Math.round(q.t * 8)}`), q: (o) => ({ t: (Math.floor((o.t || 0) * 8) % 10) / 8, windup: o.windup }) },
};

export function drawEnemyC(ctx, kind, x, y, o, variant = null) {
  if (kind === 'shadow') return drawShadowC(ctx, x, y, o, variant);
  const d = ENEMY[kind];
  const q = d.q(o);
  const key = `${kind}|${o.phase}|${JSON.stringify(q)}`;
  const args = { ...q, phase: o.phase, noShadow: true };
  put(ctx, key, d.w, d.h, d.ax, d.ay, (c, ax, ay) => d.fn(c, ax, ay, args), x, y, variant, true, enemyOverrideKey(kind, o.phase, d.label(q)),
    false, d.hd ? (c, ax, ay) => d.hd(c, ax, ay, args) : null);
}

function drawShadowC(ctx, x, y, o, variant) {
  const speed = o.phase === 'past' ? 1 : 2.4;
  const n = 24;
  const f = Math.floor(((o.t || 0) * speed) / (TAU / n)) % n;
  const t = (f * (TAU / n)) / speed;
  const key = `shadow|${o.phase}|${f}|${o.shield ? 1 : 0}|${o.layer || ''}`;
  const args = { phase: o.phase, t, shield: o.shield, layer: o.layer, noShadow: true };
  put(ctx, key, 44, 46, 22, 42, (c, ax, ay) => drawShadow(c, ax, ay, args), x, y, variant, !o.layer, enemyOverrideKey('shadow', o.phase, `f${f}${o.layer ? 'front' : ''}`),
    false, (c, ax, ay) => drawShadow32(c, ax, ay, args));
}

export function drawMelC(ctx, x, y, o, variant = null) {
  const f = Math.floor((o.t || 0) * 4) % 16;
  const key = `mel|${o.version || 'w'}|${f}|${o.windup ? 1 : 0}`;
  const args = { t: f / 4, version: o.version, windup: o.windup, noShadow: true };
  put(ctx, key, 76, 84, 38, 80, (c, ax, ay) => drawMel(c, ax, ay, args), x, y, variant, true, `mel/${o.version || 'w'}/f${f - (f % 4)}`,
    false, (c, ax, ay) => drawMel32(c, ax, ay, args));
}

export const atlasStats = () => ({ frames: atlas.count(), pages: atlas.pages.length, bytes: atlas.memory(), baked: atlas.stats.baked });
export { P };

// Описание всех стандартных кадров для выгрузки шаблонов художнику (scripts/export-sprites.mjs).
export function exportFrameSpecs() {
  const specs = [];
  for (const dir of ['down', 'up', 'side']) {
    for (let w = 0; w < 6; w++) specs.push({ ov: `hero/${dir}/walk${w}`, w: 44, h: 44, ax: 22, ay: 38, draw: (c, ax, ay) => drawHero(c, ax, ay, { dir, walk: w / 6, moving: true, aim: Math.PI / 2, charges: 3, noShadow: true }) });
    for (let st = 1; st <= 3; st++) for (let sw = 0; sw < 5; sw++) specs.push({ ov: `hero/${dir}/swing${st}_${sw}`, w: 44, h: 44, ax: 22, ay: 38, draw: (c, ax, ay) => drawHero(c, ax, ay, { dir, swing: sw * 0.04, swingStep: st, aim: dir === 'up' ? -Math.PI / 2 : dir === 'side' ? 0 : Math.PI / 2, charges: 3, noShadow: true }) });
  }
  for (const phase of ['present', 'past']) {
    for (let w = 0; w < 4; w++) specs.push({ ov: enemyOverrideKey('hollow', phase, `walk${w}`), ...ENEMY.hollow, draw: (c, ax, ay) => drawHollow(c, ax, ay, { phase, walk: w / 4, noShadow: true }) });
    specs.push({ ov: enemyOverrideKey('hollow', phase, 'windup'), ...ENEMY.hollow, draw: (c, ax, ay) => drawHollow(c, ax, ay, { phase, windup: true, noShadow: true }) });
    specs.push({ ov: enemyOverrideKey('hollow', phase, 'lunge'), ...ENEMY.hollow, draw: (c, ax, ay) => drawHollow(c, ax, ay, { phase, lunge: true, noShadow: true }) });
    for (let f = 0; f < 2; f++) specs.push({ ov: enemyOverrideKey('framer', phase, `f${f}`), ...ENEMY.framer, draw: (c, ax, ay) => drawFramer(c, ax, ay, { phase, t: f / 10, noShadow: true }) });
    specs.push({ ov: enemyOverrideKey('ringer', phase, 'idle'), ...ENEMY.ringer, draw: (c, ax, ay) => drawRinger(c, ax, ay, { phase, noShadow: true }) });
    for (let f = 0; f < 2; f++) specs.push({ ov: enemyOverrideKey('ringer', phase, `charge${f}`), ...ENEMY.ringer, draw: (c, ax, ay) => drawRinger(c, ax, ay, { phase, charge: true, t: f / 30 + 0.05, noShadow: true }) });
  }
  for (const v of ['w', 'imprint', 'scar']) for (let f = 0; f < 16; f += 4) specs.push({ ov: `mel/${v}/f${f}`, w: 76, h: 84, ax: 38, ay: 80, draw: (c, ax, ay) => drawMel(c, ax, ay, { t: f / 4, version: v === 'w' ? undefined : v, noShadow: true }) });
  return specs;
}

// Упаковать стандартные кадры в один PNG-лист с манифестом (контур уже запечён).
export function exportSheet() {
  const ex = createAtlas({ pageSize: 1024, maxPages: 1 });
  const frames = {};
  for (const sp of exportFrameSpecs()) {
    const e = ex.sprite(sp.ov, sp.w, sp.h, sp.ax, sp.ay, sp.draw, { outline: OUTLINE });
    frames[sp.ov] = [e.sx, e.sy, e.w, e.h, e.ax, e.ay];
  }
  const page = ex.pages[0].canvas;
  return { png: page.toDataURL('image/png'), manifest: { version: 1, sheets: [{ image: 'characters.png', outline: false, frames }] } };
}
