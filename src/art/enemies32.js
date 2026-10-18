// Враги — 32-битные кадры (векторно в плотной сетке + пикселизация атласом).
// Параметры те же, что у 16-битных маляров в sprites.js. В Шраме (present) — пепельные
// ткани, провалы вместо лиц и малиновые огни; в Отпечатке (past) — тёплые живые цвета.
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';

const INK = '#05060c';
const VOID = '#04050a';

function ragHem(pts, xl, xr, y, t, teeth = 7, depth = 1.6) {
  for (let i = 0; i <= teeth; i++) {
    const k = i / teeth;
    const wave = Math.sin(i * 2.7 + t * 6) * 0.5;
    pts.push(xr + (xl - xr) * k, y + (i % 2 ? depth + wave : wave * 0.3));
  }
  return pts;
}

// ── Пустокожий ─────────────────────────────────────────────────────────
export function drawHollow32(ctx, x, y, o) {
  const past = o.phase === 'past';
  const t = o.t || 0;
  const step = Math.sin((o.walk || 0) * Math.PI * 2);
  const lean = o.windup ? -1 : 0;
  const reach = o.lunge ? 4 : 0;
  const R = past
    ? { hi: '#c08a52', base: '#8a5a2e', lo: '#5a3618', deep: '#3a2010', skin: '#d4b08e', skinLo: '#9a7658' }
    : { hi: '#8a8c9c', base: '#5c5e6e', lo: '#3a3b49', deep: '#22232e', skin: '#9fa2b2', skinLo: '#6a6c7c' };
  const cx = x + lean;
  // ноги-палки
  rect(ctx, x - 2.6, y - 7, 1.5, 6.5 - (step > 0.3 ? 1 : 0), '#1c1c26');
  rect(ctx, x + 1.1, y - 7, 1.5, 6.5 - (step < -0.3 ? 1 : 0), '#1c1c26');
  // ряса в лохмотьях
  const body = [cx - 3.4, y - 15.5, cx + 3.4, y - 15.5, cx + 5, y - 8];
  ragHem(body, cx - 5, cx + 5, y - 5, t, 8, 2);
  body.push(cx - 5, y - 8);
  poly(ctx, body, lin(ctx, cx - 5, y - 16, cx + 5, y - 4, [[0, R.hi], [0.4, R.base], [1, R.lo]]));
  inside(ctx, () => {
    path(ctx, [cx - 1.2, y - 14, cx - 2.2, y - 5], R.lo, 0.5);
    path(ctx, [cx + 1.8, y - 14, cx + 2.8, y - 5], R.deep, 0.5);
    oval(ctx, cx + 4, y - 6, 3.5, 4, 'rgba(10,10,20,0.35)');
    if (past) rect(ctx, cx - 4, y - 14.5, 8, 1.6, '#e0a040');
  });
  // длинные руки с когтями
  for (const s of [-1, 1]) {
    const ax = cx + s * (4.6 + reach);
    const top = y - 14.5;
    path(ctx, [cx + s * 3.4, top, ax, top + 4, ax + s * 0.4, top + 9], R.skinLo, 1.6);
    path(ctx, [cx + s * 3.4, top, ax, top + 4, ax + s * 0.4, top + 9], R.skin, 0.8);
    for (let c = -1; c <= 1; c++) path(ctx, [ax + s * 0.4, top + 9, ax + s * 0.4 + c * 0.8, top + 11], past ? R.skinLo : '#d8dbe6', 0.4);
  }
  // голова в капюшоне
  const hy = y - 18.6;
  poly(ctx, [cx - 3, hy - 1.6, cx + 0.6, hy - 6, cx + 3.2, hy - 1.4], R.base);
  oval(ctx, cx, hy, 3.6, 4, rad(ctx, cx - 1.4, hy - 2, 0.4, 5.4, [[0, R.hi], [0.5, R.base], [1, R.lo]]));
  if (past) {
    // у Отпечатка ещё есть лицо и шарф
    oval(ctx, cx, hy + 0.7, 2.3, 2.6, R.skin);
    inside(ctx, () => oval(ctx, cx + 1.4, hy + 1.6, 1.8, 2, R.skinLo));
    rect(ctx, cx - 1.3, hy + 0.2, 0.7, 0.7, INK);
    rect(ctx, cx + 0.6, hy + 0.2, 0.7, 0.7, INK);
    rect(ctx, cx - 0.6, hy + 1.9, 1.2, 0.4, '#7a4a18');
  } else {
    // вместо лица — провал Стирания и малиновые огни
    oval(ctx, cx, hy + 0.7, 2.5, 2.9, VOID);
    const eye = o.windup ? '#ff7a96' : '#e0284e';
    rect(ctx, cx - 1.5, hy + 0.2, 1, 0.6, eye);
    rect(ctx, cx + 0.5, hy + 0.2, 1, 0.6, eye);
    if (o.windup) {
      rect(ctx, cx - 1.25, hy + 0.3, 0.5, 0.4, '#ffffff');
      rect(ctx, cx + 0.75, hy + 0.3, 0.5, 0.4, '#ffffff');
    }
    // рассыпающиеся пиксели у щеки
    const g = Math.floor(t * 12) % 4;
    rect(ctx, cx + 3 + g * 0.5, hy + 1 + (g & 1), 0.5, 0.5, '#c8284a');
  }
}

// ── Кадровик: кадр плёнки на ножках ───────────────────────────────────
export function drawFramer32(ctx, x, y, o) {
  const past = o.phase === 'past';
  const t = o.t || 0;
  const leg = Math.floor(t * 10) & 1;
  const B = past
    ? { hi: '#f2d792', base: '#b08a3a', lo: '#6a4c1c', glass: '#3a2810', glow: '#ffd27a' }
    : { hi: '#e0506e', base: '#8a1a3c', lo: '#4a0c1e', glass: '#14060c', glow: '#ff5a7a' };
  // ножки-зажимы
  for (const [lx, up] of [[-4, leg], [-1.8, 0], [1.2, 0], [3.4, 1 - leg]]) path(ctx, [x + lx, y - 3.5, x + lx + (lx < 0 ? -0.6 : 0.6), y - up * 0.8], INK, 0.8);
  // рамка с фаской
  rect(ctx, x - 5.5, y - 11.6, 11, 8.6, INK);
  rect(ctx, x - 5, y - 11.1, 10, 7.6, lin(ctx, x - 5, y - 11, x + 5, y - 3.5, [[0, B.hi], [0.45, B.base], [1, B.lo]]));
  rect(ctx, x - 3.6, y - 10, 7.2, 5.4, B.glass);
  // перфорация
  for (let i = 0; i < 4; i++) {
    rect(ctx, x - 4.8, y - 10.6 + i * 1.8, 0.8, 0.9, '#ece4cf');
    rect(ctx, x + 4, y - 10.6 + i * 1.8, 0.8, 0.9, '#ece4cf');
  }
  // глаз в кадре
  const look = o.look || 0;
  oval(ctx, x, y - 7.3, 2.4, 1.6, '#ece4cf');
  oval(ctx, x + look * 0.9, y - 7.3, 1, 1.3, VOID);
  rect(ctx, x + look * 0.9 - 0.7, y - 8.2, 0.5, 0.5, '#ffffff');
  inside(ctx, () => rect(ctx, x - 3.6, y - 10, 7.2, 0.5, B.glow));
}

// ── Звонарь ───────────────────────────────────────────────────────────
export function drawRinger32(ctx, x, y, o) {
  const past = o.phase === 'past';
  const t = o.t || 0;
  const R = past
    ? { hi: '#fff4e0', base: '#e2d6ba', lo: '#a89c86', deep: '#6e6656', trim: '#b8721f', eye: '#ffd27a' }
    : { hi: '#9a9cac', base: '#6a6c7c', lo: '#454655', deep: '#2a2b36', trim: '#86163a', eye: '#ff5a7a' };
  // ряса колоколом
  const robe = [x - 3, y - 18, x + 3, y - 18, x + 7.6, y - 3];
  ragHem(robe, x - 7.6, x + 7.6, y - 2.4, t, 10, 1.2);
  robe.push(x - 7.6, y - 3);
  poly(ctx, robe, lin(ctx, x - 7, y - 18, x + 7, y - 1, [[0, R.hi], [0.35, R.base], [0.8, R.lo], [1, R.deep]]));
  inside(ctx, () => {
    for (const dx of [-3.6, -1, 1.6, 4.2]) path(ctx, [x + dx * 0.4, y - 16, x + dx, y - 2], R.lo, 0.45);
    rect(ctx, x - 8, y - 3.4, 16, 1, R.trim);
    oval(ctx, x + 5, y - 5, 4, 5, 'rgba(10,10,20,0.3)');
  });
  // капюшон
  const hy = y - 21;
  poly(ctx, [x - 3.6, hy - 1, x, hy - 5.6, x + 3.6, hy - 1], R.base);
  oval(ctx, x, hy, 4, 4, rad(ctx, x - 1.5, hy - 2, 0.4, 5.5, [[0, R.hi], [0.5, R.base], [1, R.lo]]));
  oval(ctx, x, hy + 0.8, 2.6, 2.9, VOID);
  rect(ctx, x - 1.1, hy + 0.6, 2.2, 0.6, R.eye);
  // руки и колокол
  const ring = o.charge ? Math.sin(t * 40) * 1.2 : 0;
  const bx = x + ring;
  oval(ctx, x - 4.4, y - 11.5, 1.4, 2.6, R.lo);
  oval(ctx, x + 4.4, y - 11.5, 1.4, 2.6, R.lo);
  poly(ctx, [bx - 2.4, y - 12.4, bx + 2.4, y - 12.4, bx + 3.4, y - 7.4, bx - 3.4, y - 7.4], lin(ctx, bx - 3, 0, bx + 3, 0, [[0, '#6a4c1c'], [0.3, '#f2d792'], [0.6, '#b08a3a'], [1, '#3a2810']]));
  oval(ctx, bx, y - 12.6, 1.6, 0.7, '#f2d792');
  rect(ctx, bx - 4, y - 7.6, 8, 0.9, '#cfa75a');
  oval(ctx, bx, y - 6.4, 0.7, 0.7, '#7a4a18');
}

// ── Пожиратель Сцен ────────────────────────────────────────────────────
export function drawEater32(ctx, x, y, o) {
  const past = o.phase === 'past';
  const t = o.t || 0;
  const chew = o.windup ? 4 : (Math.sin(t * 5) + 1) * 1.5;
  const B = past
    ? { hi: '#ffd27a', base: '#b8721f', lo: '#7a4a18', mouth: '#4a2a10' }
    : { hi: '#5d6378', base: '#2c3042', lo: '#171a26', mouth: VOID };
  for (const s of [-1, 1]) {
    path(ctx, [x + s * 6, y - 8, x + s * 9, y - 4, x + s * 8.5, y], INK, 2);
    path(ctx, [x + s * 3, y - 7, x + s * 4, y], INK, 1.6);
  }
  // горб
  oval(ctx, x, y - 13, 11, 8, lin(ctx, x - 8, y - 21, x + 8, y - 6, [[0, B.hi], [0.3, B.base], [1, B.lo]]));
  inside(ctx, () => {
    for (let i = 0; i < 5; i++) path(ctx, [x - 8 + i * 4, y - 20, x - 9 + i * 4.4, y - 8], B.lo, 0.5);
  });
  // пасть-кадр
  rect(ctx, x - 7.2, y - 14.4, 14.4, 8.4 + chew, INK);
  rect(ctx, x - 6.4, y - 13.6, 12.8, 6.8 + chew, B.mouth);
  if (!past) {
    for (let i = 0; i < 6; i++) {
      poly(ctx, [x - 5.8 + i * 2.2, y - 13.6, x - 4.6 + i * 2.2, y - 13.6, x - 5.2 + i * 2.2, y - 11.4], '#ece4cf');
      poly(ctx, [x - 5.8 + i * 2.2, y - 6.8 + chew, x - 4.6 + i * 2.2, y - 6.8 + chew, x - 5.2 + i * 2.2, y - 9 + chew], '#ece4cf');
    }
    oval(ctx, x, y - 10 + chew / 2, 2.4, 1.2, '#c8284a');
  }
  for (let i = 0; i < 4; i++) {
    rect(ctx, x - 9.6, y - 18.6 + i * 3, 0.9, 0.9, '#ece4cf');
    rect(ctx, x + 8.7, y - 18.6 + i * 3, 0.9, 0.9, '#ece4cf');
  }
  const eye = past ? INK : '#ff5a7a';
  oval(ctx, x - 3.2, y - 17.6, 1.1, 1.1, eye);
  oval(ctx, x + 3.2, y - 17.6, 1.1, 1.1, eye);
}
