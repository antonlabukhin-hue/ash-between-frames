// Рен, Последний Смотритель — 32-битный кадр (дизайн по эталону): тёмно-синий капюшон и
// короткий плащ до середины бедра, светлая серо-голубая туника, кожаный пояс с латунной
// пряжкой, тёмные штаны, коричневые сапоги, кожаная перчатка на руке с мечом, длинный клинок.
// Пропорции не «чиби»: голова около 1/5 роста. Чёрная стеклянная маска с бирюзовыми
// глазами и браслет с зарядами — сюжетные детали — сохранены.
// Рисуется векторно в плотной сетке (src/art/hd.js), пикселизуется атласом.
// Параметры как у 16-битного drawHero: dir, flip, walk, sway, aim, swing, swingStep, glow, charges, moving, t.
// Свет — сверху слева (луна).
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';

const C = {
  hoodHi: '#5d7cb4',
  hood: '#34508a',
  hoodLo: '#1f3260',
  hoodDeep: '#121c3a',
  tunicHi: '#8ea2bc',
  tunic: '#5f7392',
  tunicLo: '#3a4862',
  pants: '#2a3348',
  pantsHi: '#3d4964',
  leather: '#6a4428',
  leatherHi: '#9a6a3c',
  leatherLo: '#3e2616',
  boot: '#4a2e1a',
  bootHi: '#7e5232',
  sole: '#1c1209',
  brass: '#b08a3a',
  brassHi: '#f0cf7a',
  amber: '#e0a040',
  void: '#04050a',
  glass: '#0c1020',
  glassHi: '#48557a',
  eye: '#6ff2e0',
  eyeHi: '#d8fff8',
  steel: '#c4ccd8',
  steelLo: '#66748a',
  edge: '#ffffff',
  grip: '#2a1c10',
  ink: '#05060c',
};

// Рваный низ плаща: зубцы колышутся во времени.
function hem(pts, xl, xr, y, t, sway, n = 8, depth = 1.5) {
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const wave = Math.sin(i * 2.3 + t * 7) * 0.45;
    pts.push(xr + (xl - xr) * k + sway * Math.sin(k * Math.PI) * 0.6, y + (i % 2 ? depth + wave : wave * 0.3));
  }
  return pts;
}

// Ноги: штаны и сапоги; шаг поднимает одну ногу, в профиль ноги расходятся.
function legs(ctx, x, y, step, side, f) {
  const lift1 = step > 0.3 ? 1.2 : 0;
  const lift2 = step < -0.3 ? 1.2 : 0;
  const spread = side ? step * 2.6 : 0;
  const L = side ? [[x - spread * f - 1.1, lift1, 0], [x + spread * f - 0.4, lift2, 0]] : [[x - 2.6, lift1, step * 1.2], [x + 0.9, lift2, -step * 1.2]];
  for (const [lx, lift0, dy] of L) {
    const lift = lift0 - dy;
    rect(ctx, lx, y - 11, 1.9, 8.2 - lift, lin(ctx, lx, 0, lx + 1.9, 0, [[0, C.pantsHi], [1, C.pants]]));
    // сапог: голенище, отворот, подошва
    rect(ctx, lx - 0.15, y - 4.6 - lift, 2.2, 4 , lin(ctx, lx, 0, lx + 2.2, 0, [[0, C.bootHi], [0.5, C.boot], [1, C.leatherLo]]));
    rect(ctx, lx - 0.3, y - 4.9 - lift, 2.5, 0.8, C.leatherHi);
    oval(ctx, lx + 1, y - 0.6 - lift, 1.5, 0.75, C.boot);
    rect(ctx, lx - 0.4, y - 0.5 - lift, 2.8, 0.5, C.sole);
  }
}

function sword(ctx, x, y, o, shoulder) {
  const a = o.aim ?? Math.PI / 2;
  let hand;
  let ang;
  if (o.swing != null) {
    // взмах: от −70° до +70° относительно прицела, третий удар — почти полный оборот
    const span = o.swingStep === 3 ? Math.PI * 1.6 : 2.4;
    const dirS = o.swingStep === 2 ? -1 : 1;
    ang = a + dirS * (-span / 2 + span * Math.min(1, o.swing / 0.16));
    hand = [shoulder[0] + Math.cos(a) * 4, shoulder[1] + 3 + Math.sin(a) * 2.5];
  } else {
    // в покое — опущен у бедра, остриём вниз и наружу (как на эталоне)
    const side = o.dir === 'side' ? (o.flip ? -1 : 1) : o.dir === 'up' ? -1 : 1;
    hand = [x + side * 5.4, y - 10];
    ang = Math.PI / 2 - side * (o.moving ? 0.85 : 0.5);
  }
  const len = o.swing != null ? 14 : 12.5;
  const cx = Math.cos(ang);
  const sy = Math.sin(ang) * 0.82;
  const nx = -sy;
  const ny = cx;
  const [hx, hy] = hand;
  const tx = hx + cx * len;
  const ty = hy + sy * len;
  const bx = hx + cx * 1.7;
  const by = hy + sy * 1.7;
  const w = 0.7;
  poly(ctx, [bx + nx * w, by + ny * w, tx + nx * 0.15, ty + ny * 0.15, tx, ty, bx - nx * w, by - ny * w], o.glow ? '#ffd27a' : lin(ctx, bx + nx, by + ny, bx - nx, by - ny, [[0, C.steel], [0.5, '#eef2f8'], [1, C.steelLo]]));
  path(ctx, [bx + nx * 0.3, by + ny * 0.3, tx, ty], o.glow ? '#fff4d0' : C.edge, 0.35);
  path(ctx, [bx, by, bx + cx * len * 0.6, by + sy * len * 0.6], 'rgba(60,70,90,0.6)', 0.25); // дол
  // гарда, рукоять в коже, навершие
  path(ctx, [bx + nx * 2, by + ny * 2, bx - nx * 2, by - ny * 2], C.brass, 0.8);
  path(ctx, [bx + nx * 1.8, by + ny * 1.8, bx + nx * 0.4, by + ny * 0.4], C.brassHi, 0.35);
  path(ctx, [hx, hy, hx - cx * 1.6, hy - sy * 1.6], C.grip, 0.9);
  oval(ctx, hx - cx * 2, hy - sy * 2, 0.7, 0.7, C.brassHi);
  // кожаная перчатка с крагой
  oval(ctx, hx - cx * 0.3, hy - sy * 0.3, 1.2, 1.1, C.leather);
  path(ctx, [hx - cx * 0.3 - 0.6, hy - sy * 0.3 - 0.6, hx - cx * 0.3 + 0.2, hy - sy * 0.3 - 0.8], C.leatherHi, 0.3);
  if (o.glow) {
    oval(ctx, tx, ty, 1.7, 1.7, '#ffd27a');
    oval(ctx, tx, ty, 0.8, 0.8, '#ffffff');
  }
}

// Браслет на свободной руке: четыре самоцвета — заряды (бирюза, четвёртый — янтарь).
function bracelet(ctx, bx, by, charges) {
  rect(ctx, bx - 1.3, by - 0.7, 2.6, 1.5, C.ink);
  rect(ctx, bx - 1.1, by - 0.5, 2.2, 1.1, '#1e2236');
  for (let i = 0; i < 4; i++) rect(ctx, bx - 1 + i * 0.55, by - 0.3, 0.45, 0.75, i < charges ? (i === 3 ? C.amber : C.eye) : '#0b0d18');
}

function arm(ctx, from, to, sleeve, hand) {
  path(ctx, [from[0], from[1], (from[0] + to[0]) / 2 + 0.3, (from[1] + to[1]) / 2, to[0], to[1]], sleeve, 1.6);
  oval(ctx, to[0], to[1] + 0.4, 0.9, 0.9, hand);
}

function hood(ctx, hx, hy, dir, f) {
  const side = dir === 'side';
  // капюшон: остроконечный, ниспадает на плечи
  const peak = side ? [hx - f * 3.4, hy - 3.6] : [hx + 0.3, hy - 4.8];
  poly(ctx, [hx - 3.1, hy - 1.6, peak[0], peak[1], hx + 3.1, hy - 1.8, hx, hy], C.hoodLo);
  oval(ctx, hx, hy, 3.3, 3.7, rad(ctx, hx - 1.2, hy - 1.8, 0.4, 5, [[0, C.hoodHi], [0.5, C.hood], [1, C.hoodLo]]));
  if (dir === 'up') {
    path(ctx, [hx, hy - 3.4, hx + 0.2, hy + 2.8], C.hoodLo, 0.45);
    inside(ctx, () => oval(ctx, hx + 1.8, hy + 1.8, 2.6, 2.4, 'rgba(10,14,32,0.45)'));
    return;
  }
  const fx = side ? hx + f * 1.7 : hx;
  const rx = side ? 1.3 : 2.1;
  oval(ctx, fx, hy + 0.5, rx + 0.35, 2.6, C.hoodDeep);
  oval(ctx, fx, hy + 0.7, rx, 2.3, C.void);
  oval(ctx, fx + (side ? f * 0.15 : 0), hy + 0.9, rx - 0.45, 1.9, C.glass);
  oval(ctx, fx - (side ? -f * 0.15 : 0.7), hy - 0.5, side ? 0.45 : 0.75, 0.3, C.glassHi);
  const eyes = side ? [fx + f * 0.55] : [fx - 0.95, fx + 0.95];
  for (const ex of eyes) {
    rect(ctx, ex - 0.45, hy + 0.5, 0.9, 0.45, C.eye);
    rect(ctx, ex - 0.2, hy + 0.5, 0.45, 0.45, C.eyeHi);
  }
}

export function drawHero32(ctx, x, y, o) {
  const t = o.t || 0;
  const dir = o.dir || 'down';
  const side = dir === 'side';
  const back = dir === 'up';
  const f = o.flip ? -1 : 1;
  const walk = o.walk || 0;
  const step = o.moving ? Math.sin(walk * Math.PI * 2) : 0;
  const bob = Math.abs(step) > 0.5 ? -0.5 : 0;
  const sway = o.sway || 0;
  const by = y + bob;
  const sh = by - 18.6; // линия плеч
  const swordBehind = back || (o.aim != null && Math.sin(o.aim) < -0.3);
  const swordShoulder = side ? [x + f * 1.5, sh + 1] : back ? [x - 3.6, sh + 1] : [x + 3.6, sh + 1];

  // плащ сзади (на виде спереди — края за плечами)
  if (!back) {
    const bk = side ? -f : 0;
    const pts = [x - 4.2 + bk * 1.5, sh - 0.4, x + 4.2 + bk * 1.5, sh - 0.4, x + 6.2 + bk * 3, by - 9];
    hem(pts, x - 6.2 + bk * 3 + sway * 0.4, x + 6.2 + bk * 3 + sway * 0.4, by - 6, t, sway, 9, 1.8);
    pts.push(x - 6.2 + bk * 3, by - 9);
    poly(ctx, pts, lin(ctx, x - 5, sh, x + 5, by - 7, [[0, C.hood], [1, C.hoodDeep]]));
  }
  if (swordBehind) sword(ctx, x, by, o, swordShoulder);
  legs(ctx, x, y, step, side, f);

  // туника: от плеч до середины бедра, пояс
  const tw = side ? 2.6 : 3.4;
  poly(ctx, [x - tw, sh + 0.4, x + tw, sh + 0.4, x + tw - 0.6, by - 11.4, x + tw + 0.5, by - 8.2, x - tw - 0.5, by - 8.2, x - tw + 0.6, by - 11.4], lin(ctx, x - 4, sh, x + 4, by - 8, [[0, C.tunicHi], [0.45, C.tunic], [1, C.tunicLo]]));
  inside(ctx, () => {
    path(ctx, [x, sh + 2, x, by - 8.6], C.tunicLo, 0.35);
    path(ctx, [x - tw + 0.6, sh + 1, x - tw - 0.2, by - 9], C.tunicHi, 0.3);
  });
  rect(ctx, x - tw - 0.4, by - 11.6, tw * 2 + 0.8, 1.1, lin(ctx, 0, by - 11.6, 0, by - 10.5, [[0, C.leatherHi], [1, C.leatherLo]]));
  if (!back) rect(ctx, x - 0.55 + (side ? f * 1 : 0), by - 11.8, 1.1, 1.4, C.brassHi);
  // сумка на поясе
  oval(ctx, x + (side ? -f * 2.2 : -2.6), by - 10.2, 1.1, 1.3, C.leather);

  // плащ на спине (вид сзади): накрывает плечи и спину до бедра
  if (back) {
    const pts = [x - 4.2, sh - 0.4, x + 4.2, sh - 0.4, x + 5.6, by - 10];
    hem(pts, x - 5.6 + sway * 0.4, x + 5.6 + sway * 0.4, by - 8.2, t, sway, 9, 1.8);
    pts.push(x - 5.6, by - 10);
    poly(ctx, pts, lin(ctx, x - 6, sh, x + 6, by - 7, [[0, C.hoodHi], [0.3, C.hood], [0.8, C.hoodLo], [1, C.hoodDeep]]));
    inside(ctx, () => {
      path(ctx, [x - 1.6, sh + 2, x - 2.8 + sway * 0.4, by - 8.4], C.hoodLo, 0.45);
      path(ctx, [x + 2, sh + 2, x + 3.4 + sway * 0.4, by - 8.4], C.hoodDeep, 0.5);
      path(ctx, [x - 4, sh + 1, x - 5.2 + sway * 0.4, by - 9], C.hoodHi, 0.35);
      // знак Смотрителей — маленькое янтарное солнце между лопаток
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = C.amber;
      ctx.beginPath();
      ctx.arc(x, sh + 4.4, 1.5, 0, Math.PI * 2);
      ctx.stroke();
      oval(ctx, x, sh + 4.4, 0.5, 0.5, C.brassHi);
    });
  }

  // руки: свободная (с браслетом) и с мечом
  const free = side ? [x - f * 0.8, by - 11] : back ? [x + 4.4, by - 11.4] : [x - 4.4, by - 11.4];
  const freeSh = side ? [x - f * 0.6, sh + 1] : back ? [x + 3.6, sh + 1] : [x - 3.6, sh + 1];
  arm(ctx, freeSh, free, side ? C.tunicLo : C.tunic, C.leather);
  bracelet(ctx, (freeSh[0] + free[0]) / 2 + (side ? 0 : back ? 0.3 : -0.3), by - 13.4, o.charges ?? 3);
  if (o.swing == null) {
    const rest = side ? [x + f * 5, by - 10.2] : back ? [x - 5, by - 10.2] : [x + 5, by - 10.2];
    arm(ctx, swordShoulder, rest, C.tunic, C.leather);
  }

  // наплечье капюшона и голова
  oval(ctx, x - (side ? f * 0.3 : 0), sh + 0.4, side ? 3.4 : 4.4, 1.9, lin(ctx, x - 4, sh - 1, x + 4, sh + 2, [[0, C.hoodHi], [0.5, C.hood], [1, C.hoodLo]]));
  hood(ctx, x + (side ? f * 0.4 : 0), sh - 3.1, dir, f);
  if (!swordBehind) sword(ctx, x, by, o, swordShoulder);
}
