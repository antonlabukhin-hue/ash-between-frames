// Частицы (пул g.particles), кольца, удары, всплывающие числа (g.fx / g.texts).
import { P } from '../art/palette.js';
import { spawnParticle, updateParticles } from './particles.js';

export function addParticle(g, p) {
  const life = p.life ?? 0.6;
  spawnParticle(g.particles, p.x, p.y, p.vx ?? 0, p.vy ?? 0, life, p.c, p.size ?? 1, p.grav ?? 0, p.drag ?? 0.9);
}

// Рассыпание на квадраты — смерть врагов и стирание. Количество масштабируется профилем качества.
export function burst(g, x, y, colors, n = 14, speed = 60, o = {}) {
  const count = Math.max(1, Math.round(n * (g.quality?.particleMul ?? 1)));
  const pool = g.particles;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    const life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
    const ok = spawnParticle(
      pool,
      x + (Math.random() - 0.5) * (o.spread ?? 8),
      y + (Math.random() - 0.5) * (o.spread ?? 8),
      Math.cos(a) * s,
      Math.sin(a) * s - (o.up ?? 0),
      life,
      colors[i % colors.length],
      o.size ?? (Math.random() > 0.6 ? 2 : 1),
      o.grav ?? 0,
      o.drag ?? 0.88,
    );
    if (!ok) break;
  }
}

export function ringFx(g, x, y, r0, r1, c, life = 0.35, squash = 0.6) {
  g.fx.push({ kind: 'ring', x, y, r0, r1, c, life, max: life, squash });
}

export function slashFx(g, x, y, angle, span, radius, c, life = 0.12) {
  g.fx.push({ kind: 'slash', x, y, angle, span, radius, c, life, max: life });
}

export function boltFx(g, x0, y0, x1, y1, c = P.tealHi) {
  g.fx.push({ kind: 'bolt', x0, y0, x1, y1, c, life: 0.18, max: 0.18, seed: Math.random() * 100 });
}

export function addText(g, x, y, text, c = P.milk, o = {}) {
  g.texts.push({ x, y, text: String(text), c, life: o.life ?? 0.8, max: o.life ?? 0.8, vy: o.vy ?? -22, big: !!o.big });
}

export function updateFx(g, dt) {
  updateParticles(g.particles, dt);
  for (const f of g.fx) f.life -= dt;
  g.fx = g.fx.filter((f) => f.life > 0);
  for (const t of g.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.9, dt * 60);
  }
  g.texts = g.texts.filter((t) => t.life > 0);
}
