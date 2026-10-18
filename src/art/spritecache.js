// Персонажи через атлас: параметры анимации квантуются в кадры, кадр печатается один раз.
import { createAtlas, blit } from './atlas.js';
import { drawHero, drawHollow, drawFramer, drawRinger, drawShadow, drawEater, drawMel } from './sprites.js';
import { P } from './palette.js';

export const atlas = createAtlas({ maxPages: 3 });
const OUTLINE = '#05060c';
const TAU = Math.PI * 2;

// Выводит кадр; variant: null — обычный, иначе цвет силуэта (вспышка, двойной контур, шлейф).
function put(ctx, key, w, h, ax, ay, draw, x, y, variant, outline = true) {
  const base = atlas.sprite(key, w, h, ax, ay, draw, { outline: outline ? OUTLINE : null });
  blit(ctx, variant ? atlas.tinted(key, base, variant) : base, x, y);
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
  put(ctx, q.key, 44, 44, 22, 38, (c, ax, ay) =>
    drawHero(c, ax, ay, {
      dir: o.dir, flip: o.flip, walk: q.walk / 6, sway: q.sway * 2.5, aim: (q.aim * Math.PI) / 4,
      swing: q.swing >= 0 ? q.swing * 0.04 : null, swingStep: o.swingStep, glow: o.glow, charges: o.charges ?? 3,
      moving: o.moving, t: q.hem * 0.35, noShadow: true,
    }), x, y, variant);
}

// ── враги ─────────────────────────────────────────────────────────────
const ENEMY = {
  hollow: { w: 24, h: 34, ax: 12, ay: 30, fn: drawHollow, q: (o) => ({ walk: Math.floor((o.walk || 0) * 4) / 4, t: (Math.floor((o.t || 0) * 12) % 4) / 12, windup: o.windup, lunge: o.lunge }) },
  framer: { w: 16, h: 18, ax: 8, ay: 15, fn: drawFramer, q: (o) => ({ t: (Math.floor((o.t || 0) * 10) & 1) / 10, look: o.look || 0 }) },
  ringer: { w: 22, h: 30, ax: 11, ay: 27, fn: drawRinger, q: (o) => ({ t: o.charge ? (Math.floor((o.t || 0) * 30) & 1) / 30 + 0.05 : 0, charge: o.charge }) },
  eater: { w: 28, h: 26, ax: 14, ay: 23, fn: drawEater, q: (o) => ({ t: (Math.floor((o.t || 0) * 8) % 10) / 8, windup: o.windup }) },
};

export function drawEnemyC(ctx, kind, x, y, o, variant = null) {
  if (kind === 'shadow') return drawShadowC(ctx, x, y, o, variant);
  const d = ENEMY[kind];
  const q = d.q(o);
  const key = `${kind}|${o.phase}|${JSON.stringify(q)}`;
  put(ctx, key, d.w, d.h, d.ax, d.ay, (c, ax, ay) => d.fn(c, ax, ay, { ...q, phase: o.phase, noShadow: true }), x, y, variant);
}

function drawShadowC(ctx, x, y, o, variant) {
  const speed = o.phase === 'past' ? 1 : 2.4;
  const n = 24;
  const f = Math.floor(((o.t || 0) * speed) / (TAU / n)) % n;
  const t = (f * (TAU / n)) / speed;
  const key = `shadow|${o.phase}|${f}|${o.shield ? 1 : 0}|${o.layer || ''}`;
  put(ctx, key, 44, 46, 22, 42, (c, ax, ay) => drawShadow(c, ax, ay, { phase: o.phase, t, shield: o.shield, layer: o.layer, noShadow: true }), x, y, variant, !o.layer);
}

export function drawMelC(ctx, x, y, o, variant = null) {
  const f = Math.floor((o.t || 0) * 4) % 16;
  const key = `mel|${o.version || 'w'}|${f}|${o.windup ? 1 : 0}`;
  put(ctx, key, 76, 84, 38, 80, (c, ax, ay) => drawMel(c, ax, ay, { t: f / 4, version: o.version, windup: o.windup, noShadow: true }), x, y, variant);
}

export const atlasStats = () => ({ frames: atlas.count(), pages: atlas.pages.length, bytes: atlas.memory(), baked: atlas.stats.baked });
export { P };
