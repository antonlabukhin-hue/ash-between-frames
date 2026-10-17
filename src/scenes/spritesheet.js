// Отладочный лист спрайтов (?sprites): персонажи крупно, обе фазы, кадры ходьбы и удара.
import { W, H } from '../core/renderer.js';
import { P } from '../art/palette.js';
import { drawHero, drawHollow, drawFramer, drawRinger, drawShadow, drawMel, drawTik, drawMara, drawDog, drawGhost, drawBrassBoy, drawGreatBell, drawEater } from '../art/sprites.js';

let buf = null;
function cell(ctx, x, y, w, h, scale, fn) {
  if (!buf) buf = document.createElement('canvas');
  buf.width = w;
  buf.height = h;
  const b = buf.getContext('2d');
  b.clearRect(0, 0, w, h);
  fn(b);
  ctx.drawImage(buf, 0, 0, w, h, x, y, w * scale, h * scale);
}

export function drawSpriteSheet(ctx, t) {
  ctx.fillStyle = P.stone0;
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const s = 2;
  const heroes = [
    { dir: 'down', walk: 0 }, { dir: 'down', walk: 0.25, moving: true }, { dir: 'side', walk: 0.5, moving: true }, { dir: 'side', flip: true, moving: true },
    { dir: 'up', walk: 0.75, moving: true }, { dir: 'down', swing: 0.08, swingStep: 1, aim: 0 }, { dir: 'side', swing: 0.1, swingStep: 3, aim: 0, glow: true },
  ];
  heroes.forEach((o, i) => cell(ctx, 4 + i * 34, 2, 17, 30, s, (b) => drawHero(b, 8, 28, { t, charges: 3, aim: Math.PI / 2, sway: o.moving ? Math.sin(t * 3) * 2 : 0, ...o })));
  const foes = [
    (b, ph) => drawHollow(b, 9, 28, { phase: ph, t, walk: (t * 2) % 1 }),
    (b, ph) => drawFramer(b, 9, 26, { phase: ph, t }),
    (b, ph) => drawRinger(b, 9, 28, { phase: ph, t }),
  ];
  foes.forEach((fn, i) => {
    cell(ctx, 4 + i * 64, 66, 18, 30, s, (b) => fn(b, 'present'));
    cell(ctx, 36 + i * 64, 66, 18, 30, s, (b) => fn(b, 'past'));
  });
  cell(ctx, 196, 60, 40, 40, 1.5, (b) => drawShadow(b, 20, 38, { phase: 'present', t, shield: true }));
  cell(ctx, 254, 56, 40, 40, 1.5, (b) => drawShadow(b, 20, 38, { phase: 'past', t }));
  cell(ctx, 310, 2, 70, 74, 1, (b) => drawMel(b, 35, 72, { t }));
  cell(ctx, 330, 160, 30, 26, 1.5, (b) => drawEater(b, 15, 24, { phase: 'present', t }));
  cell(ctx, 290, 176, 30, 26, 1.3, (b) => drawEater(b, 15, 24, { phase: 'past', t }));
  cell(ctx, 4, 128, 20, 40, 2, (b) => drawTik(b, 10, 30, { t }));
  cell(ctx, 44, 128, 20, 40, 2, (b) => drawMara(b, 10, 34, { t }));
  cell(ctx, 84, 128, 24, 40, 2, (b) => drawDog(b, 12, 34, { t }));
  cell(ctx, 132, 128, 20, 40, 2, (b) => drawGhost(b, 10, 34, { t, hat: true }));
  cell(ctx, 172, 128, 20, 40, 2, (b) => drawGhost(b, 10, 34, { t, dress: true, color: P.amberHi }));
  cell(ctx, 212, 120, 24, 48, 2, (b) => drawBrassBoy(b, 12, 46, { phase: 'past', t }));
  cell(ctx, 262, 120, 24, 48, 2, (b) => drawBrassBoy(b, 12, 46, { phase: 'present', t }));
  cell(ctx, 312, 96, 50, 50, 1.4, (b) => drawGreatBell(b, 25, 46, { phase: 'past', t }));
}
