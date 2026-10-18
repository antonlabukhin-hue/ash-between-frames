// Рен, Последний Смотритель — 32-битный кадр. Рисуется векторно в плотной сетке
// (src/art/hd.js), затем пикселизуется атласом. Те же параметры, что у 16-битного
// drawHero: dir, flip, walk, sway, aim, swing, swingStep, glow, charges, moving, t.
// Свет — сверху слева (луна): светлый край плаща слева, глубокая тень справа снизу.
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';

const C = {
  hi: '#7d93c4',
  cloak: '#4d649a',
  mid: '#36497b',
  lo: '#232f58',
  deep: '#141a33',
  lining: '#2b2140',
  tunic: '#161a2b',
  tunicHi: '#2a3150',
  brass: '#b08a3a',
  brassHi: '#f0cf7a',
  amber: '#e0a040',
  void: '#04050a',
  glass: '#0c1020',
  glassHi: '#48557a',
  eye: '#6ff2e0',
  eyeHi: '#d8fff8',
  boot: '#17161e',
  bootHi: '#3b3947',
  glove: '#25232e',
  steel: '#b8c3d2',
  steelLo: '#5f6c80',
  edge: '#ffffff',
  grip: '#3a2818',
  ink: '#05060c',
};

// Плащ: плечи → бока → рваный подол зубцами (колышется во времени) → обратно.
function cloak(ctx, sl, sr, ml, mr, hl, hr, hy, t, sway, fill) {
  const pts = [sl[0], sl[1], sr[0], sr[1], mr[0], mr[1]];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = hr + (hl - hr) * k + sway * (0.4 + 0.6 * Math.sin(k * Math.PI));
    const wave = Math.sin(i * 2.3 + t * 7) * 0.5 + Math.sin(i * 0.9 - t * 3) * 0.4;
    const y = hy + (i % 2 ? 1.4 + wave : -0.3 + wave * 0.4);
    pts.push(x, y);
  }
  pts.push(ml[0], ml[1]);
  poly(ctx, pts, fill);
}

function legs(ctx, x, y, step, side, f) {
  const lift1 = step > 0.3 ? 1 : 0;
  const lift2 = step < -0.3 ? 1 : 0;
  const spread = side ? step * 2.2 : 0;
  const lx = side ? x - spread * f - 0.8 : x - 2.4;
  const rx = side ? x + spread * f - 0.2 : x + 1.2;
  for (const [lxx, lift] of [[lx, lift1], [rx, lift2]]) {
    rect(ctx, lxx, y - 7, 2, 6 - lift, lin(ctx, lxx, 0, lxx + 2, 0, [[0, '#2c3350'], [1, '#161b30']]));
    oval(ctx, lxx + 1, y - 1.1 - lift, 1.5, 1, C.boot);
    oval(ctx, lxx + 0.7, y - 1.5 - lift, 0.7, 0.35, C.bootHi);
  }
}

function sword(ctx, x, y, o) {
  const a = o.aim ?? Math.PI / 2;
  let hand = [x + Math.cos(a) * 5, y - 9 + Math.sin(a) * 3];
  let ang = a;
  if (o.swing != null) {
    const span = o.swingStep === 3 ? Math.PI * 1.6 : 2.4;
    const dirS = o.swingStep === 2 ? -1 : 1;
    ang = a + dirS * (-span / 2 + span * Math.min(1, o.swing / 0.16));
  } else {
    const side = o.dir === 'side' ? (o.flip ? -1 : 1) : o.dir === 'up' ? -1 : 1;
    hand = [x + side * 6, y - 8.5];
    ang = Math.PI / 2 - side * (o.moving ? 0.9 : 0.55);
  }
  const len = o.swing != null ? 12 : 10;
  const cx = Math.cos(ang);
  const sy = Math.sin(ang) * 0.8;
  const nx = -sy;
  const ny = cx;
  const [hx, hy] = hand;
  const tx = hx + cx * len;
  const ty = hy + sy * len;
  const bx = hx + cx * 1.6;
  const by = hy + sy * 1.6;
  const w = 0.75;
  // клинок: сужается к острию, светлая кромка с одной стороны
  poly(ctx, [bx + nx * w, by + ny * w, tx, ty, bx - nx * w, by - ny * w], o.glow ? '#ffd27a' : lin(ctx, bx + nx, by + ny, bx - nx, by - ny, [[0, C.steel], [0.5, '#e4eaf2'], [1, C.steelLo]]));
  path(ctx, [bx + nx * 0.35, by + ny * 0.35, tx, ty], o.glow ? '#fff4d0' : C.edge, 0.4);
  // гарда, рукоять, навершие
  path(ctx, [bx + nx * 1.7, by + ny * 1.7, bx - nx * 1.7, by - ny * 1.7], C.brass, 0.8);
  path(ctx, [bx + nx * 1.5, by + ny * 1.5, bx + nx * 0.4, by + ny * 0.4], C.brassHi, 0.35);
  path(ctx, [hx, hy, hx - cx * 1.4, hy - sy * 1.4], C.grip, 0.9);
  oval(ctx, hx - cx * 1.8, hy - sy * 1.8, 0.65, 0.65, C.brassHi);
  // перчатка
  oval(ctx, hx - cx * 0.4, hy - sy * 0.4, 1.1, 1, C.glove);
  if (o.glow) {
    oval(ctx, tx, ty, 1.6, 1.6, '#ffd27a');
    oval(ctx, tx, ty, 0.8, 0.8, '#ffffff');
  }
}

// Браслет: четыре самоцвета — заряды (бирюза, четвёртый — янтарь).
function bracelet(ctx, bx, by, charges) {
  rect(ctx, bx - 1.4, by - 0.7, 2.8, 1.6, C.ink);
  rect(ctx, bx - 1.2, by - 0.5, 2.4, 1.2, '#1e2236');
  for (let i = 0; i < 4; i++) {
    const lit = i < charges;
    rect(ctx, bx - 1.1 + i * 0.6, by - 0.3, 0.5, 0.8, lit ? (i === 3 ? C.amber : C.eye) : '#0b0d18');
  }
}

function hood(ctx, x, y, dir, f) {
  const side = dir === 'side';
  const hx = side ? x + f * 0.6 : x;
  const hy = y - 20.6;
  // складка-капюшон с острым концом назад и вверх
  const peak = side ? [hx - f * 4.6, hy - 2.6] : [hx + 0.4, hy - 5.6];
  poly(ctx, [hx - 3.4, hy - 2.4, peak[0], peak[1], hx + 3.4, hy - 2.6, hx, hy], C.mid);
  oval(ctx, hx, hy, 4.4, 4.7, rad(ctx, hx - 1.6, hy - 2.4, 0.5, 6.5, [[0, C.hi], [0.45, C.cloak], [1, C.lo]]));
  if (dir === 'up') {
    // затылок: шов и тень от плаща
    path(ctx, [hx, hy - 4.2, hx + 0.3, hy + 3.6], C.lo, 0.5);
    inside(ctx, () => oval(ctx, hx + 2.2, hy + 2.2, 3.4, 3, 'rgba(10,14,32,0.45)'));
    return;
  }
  const fx = side ? hx + f * 2.1 : hx;
  const rx = side ? 1.7 : 2.8;
  // проём лица и маска чёрного стекла
  oval(ctx, fx, hy + 0.5, rx + 0.4, 3.4, C.lo);
  oval(ctx, fx, hy + 0.7, rx, 3.1, C.void);
  oval(ctx, fx + (side ? f * 0.2 : 0), hy + 0.9, rx - 0.5, 2.6, C.glass);
  oval(ctx, fx - (side ? -f * 0.2 : 0.9), hy - 0.9, side ? 0.6 : 1, 0.4, C.glassHi);
  // глаза-огоньки
  const eyes = side ? [fx + f * 0.7] : [fx - 1.25, fx + 1.25];
  for (const ex of eyes) {
    rect(ctx, ex - 0.5, hy + 0.6, 1, 0.5, C.eye);
    rect(ctx, ex - 0.25, hy + 0.6, 0.5, 0.5, C.eyeHi);
  }
}

export function drawHero32(ctx, x, y, o) {
  const t = o.t || 0;
  const dir = o.dir || 'down';
  const side = dir === 'side';
  const f = o.flip ? -1 : 1;
  const walk = o.walk || 0;
  const step = o.moving ? Math.sin(walk * Math.PI * 2) : 0;
  const bob = Math.abs(step) > 0.5 ? -0.5 : 0;
  const sway = o.sway || 0;
  const by = y + bob;

  const swordBehind = dir === 'up' || (o.aim != null && Math.sin(o.aim) < -0.3);
  if (swordBehind) sword(ctx, x, by, o);
  legs(ctx, x, y, step, side, f);

  const fill = lin(ctx, x - 7, by - 18, x + 6, by - 3, [[0, C.hi], [0.3, C.cloak], [0.7, C.mid], [1, C.lo]]);
  if (side) {
    // профиль: шлейф отстаёт назад
    const back = -f;
    cloak(ctx, [x + back * 3, by - 17.4], [x - back * 2.6, by - 17.4], [x + back * 6.4, by - 10], [x - back * 3.6, by - 10],
      x + back * (9 + Math.abs(sway) * 0.8), x - back * 4, by - 4.2, t, back * Math.abs(sway) * 0.6, fill);
    inside(ctx, () => {
      path(ctx, [x + back * 1.2, by - 15, x + back * 4.5, by - 5], C.lo, 0.5);
      path(ctx, [x + back * 3.2, by - 14, x + back * 7.2, by - 5], C.deep, 0.45);
      path(ctx, [x - back * 1.8, by - 16, x - back * 2.6, by - 6], C.hi, 0.4);
      oval(ctx, x + back * 6, by - 4, 6, 3, 'rgba(12,16,36,0.45)');
    });
    // тело под плащом, пояс
    poly(ctx, [x - back * 0.4, by - 15.5, x - back * 2.6, by - 15, x - back * 3, by - 6, x - back * 0.8, by - 6], C.tunic);
    rect(ctx, x - (f > 0 ? 0 : 2.8), by - 9.8, 2.8, 0.8, C.brass);
    rect(ctx, x + f * 1.6 - 0.4, by - 9.8, 0.8, 0.8, C.brassHi);
  } else {
    cloak(ctx, [x - 4.4, by - 17.4], [x + 4.4, by - 17.4], [x - 6.4, by - 10], [x + 6.4, by - 10], x - 8 + sway * 0.4, x + 7.6 + sway * 0.4, by - 4.2, t, sway, fill);
    inside(ctx, () => {
      // складки: тени и световой край
      path(ctx, [x - 2.2, by - 15, x - 4 + sway * 0.6, by - 4.6], C.lo, 0.5);
      path(ctx, [x + 2.4, by - 15, x + 4.6 + sway * 0.6, by - 4.6], C.lo, 0.5);
      path(ctx, [x + 4.6, by - 14, x + 7 + sway * 0.6, by - 4.6], C.deep, 0.6);
      path(ctx, [x - 4.6, by - 15, x - 6.6 + sway * 0.6, by - 6], C.hi, 0.4);
      oval(ctx, x + 5, by - 6, 5, 4, 'rgba(12,16,36,0.4)');
    });
    if (dir === 'up') {
      // знак на спине — янтарный круг с крестом
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = C.amber;
      ctx.beginPath();
      ctx.arc(x, by - 11, 2.2, 0, Math.PI * 2);
      ctx.stroke();
      path(ctx, [x, by - 14.6, x, by - 7.4], C.amber, 0.5, 'butt');
      path(ctx, [x - 3.6, by - 11, x + 3.6, by - 11], C.amber, 0.5, 'butt');
      oval(ctx, x, by - 11, 0.7, 0.7, C.brassHi);
    } else {
      // разрез плаща: тёмная туника, пояс с пряжкой, пустая рамка на шее
      poly(ctx, [x - 1.3, by - 16.2, x + 1.3, by - 16.2, x + 1.9 + sway * 0.3, by - 5, x - 1.9 + sway * 0.3, by - 5], lin(ctx, x - 2, 0, x + 2, 0, [[0, C.tunicHi], [0.5, C.tunic], [1, '#0b0d18']]));
      rect(ctx, x - 1.9, by - 10.2, 3.8, 0.9, C.brass);
      rect(ctx, x - 0.45, by - 10.3, 0.9, 1.1, C.brassHi);
      rect(ctx, x - 1.1, by - 16.8, 2.2, 2.2, C.amber);
      rect(ctx, x - 1.1, by - 16.8, 2.2, 0.5, C.brassHi);
      rect(ctx, x - 0.5, by - 16.2, 1, 1, C.void);
    }
  }

  // наплечная пелерина
  const mx = side ? x - f * 0.4 : x;
  oval(ctx, mx, by - 16.4, side ? 4.2 : 5.3, 2.7, lin(ctx, mx - 5, by - 19, mx + 5, by - 14, [[0, C.hi], [0.5, C.cloak], [1, C.lo]]));
  path(ctx, [mx - (side ? 3.8 : 5), by - 15.4, mx, by - 13.9, mx + (side ? 3.8 : 5), by - 15.4], C.lo, 0.45);

  // рука с браслетом (правая; в профиль — передняя)
  const ax = side ? x + f * 2.6 : dir === 'up' ? x - 5 : x + 5.2;
  oval(ctx, ax, by - 12.4, 1.5, 3.2, side ? C.cloak : C.mid);
  bracelet(ctx, ax, by - 10.4, o.charges ?? 3);

  hood(ctx, x, by, dir, f);
  if (!swordBehind) sword(ctx, x, by, o);
}
