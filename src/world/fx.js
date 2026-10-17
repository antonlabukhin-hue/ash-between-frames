// Частицы, кольца, всплывающие числа. Всё лежит в g.fx / g.texts.
import { P } from '../art/palette.js';

export function addParticle(g, p) {
  if (g.fx.length > 600) g.fx.shift();
  g.fx.push({ kind: 'sq', life: 0.6, max: 0.6, size: 1, grav: 0, drag: 0.9, ...p });
}

// Рассыпание на квадраты — смерть врагов и стирание.
export function burst(g, x, y, colors, n = 14, speed = 60, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    const life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
    addParticle(g, {
      x: x + (Math.random() - 0.5) * (o.spread ?? 8),
      y: y + (Math.random() - 0.5) * (o.spread ?? 8),
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (o.up ?? 0),
      c: colors[i % colors.length],
      size: o.size ?? (Math.random() > 0.6 ? 2 : 1),
      life,
      max: life,
      grav: o.grav ?? 0,
      drag: o.drag ?? 0.88,
    });
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
  for (const f of g.fx) {
    f.life -= dt;
    if (f.kind === 'sq') {
      f.vx *= Math.pow(f.drag, dt * 60);
      f.vy *= Math.pow(f.drag, dt * 60);
      f.vy += f.grav * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
  }
  g.fx = g.fx.filter((f) => f.life > 0);
  for (const t of g.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.9, dt * 60);
  }
  g.texts = g.texts.filter((t) => t.life > 0);
}
