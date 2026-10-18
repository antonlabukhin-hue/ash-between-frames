// NPC и фигуры-воспоминания — 32-битные кадры. Сигнатуры как у 16-битных:
// (ctx, x, y, o). Призраки рисуются непрозрачными, полупрозрачность даёт атлас
// (crisp keepAlpha) и альфа при выводе.
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';

const INK = '#05060c';
const VOID = '#04050a';

function shadowOval(ctx, x, y, rx, a = 0.45) {
  oval(ctx, x, y - 0.4, rx, Math.max(1, rx * 0.3), `rgba(3,4,10,${a})`);
}

// ── Тик: маленький проводник в латунной маске ───────────────────────────
export function drawTik32(ctx, x, y, o = {}) {
  const b = Math.sin((o.t || 0) * 3) * 0.6;
  shadowOval(ctx, x, y, 5.5);
  rect(ctx, x - 2.4, y - 3, 1.6, 3, '#1c1820');
  rect(ctx, x + 0.8, y - 3, 1.6, 3, '#1c1820');
  // пальтишко
  poly(ctx, [x - 3.4, y - 10.5, x + 3.4, y - 10.5, x + 4.6, y - 2.4, x - 4.6, y - 2.4], lin(ctx, x - 4, y - 10, x + 4, y - 2, [[0, '#8a6a4a'], [0.4, '#5a3f2c'], [1, '#2e2018']]));
  path(ctx, [x, y - 10, x, y - 3], '#2e2018', 0.4);
  for (let i = 0; i < 3; i++) oval(ctx, x + 0.9, y - 8.6 + i * 2, 0.4, 0.4, '#cfa75a');
  // латунная маска-голова
  oval(ctx, x, y - 13.5 + b, 5, 4.4, rad(ctx, x - 1.8, y - 15.5 + b, 0.4, 6.4, [[0, '#fff0b8'], [0.3, '#e6c06a'], [0.7, '#b08a3a'], [1, '#5a4014']]));
  oval(ctx, x - 1.9, y - 13.6 + b, 1.2, 1.4, VOID);
  oval(ctx, x + 1.9, y - 13.6 + b, 1.2, 1.4, VOID);
  rect(ctx, x - 2.1, y - 13.9 + b, 0.5, 0.5, '#a8fff0');
  path(ctx, [x - 1, y - 11.2 + b, x + 1, y - 11.2 + b], '#5a3a14', 0.5);
  path(ctx, [x - 3.8, y - 16 + b, x - 1.4, y - 17.4 + b], 'rgba(255,255,240,0.7)', 0.4);
  // заводной ключ
  path(ctx, [x + 4.6, y - 13 + b, x + 6.4, y - 13 + b], '#cfa75a', 0.6);
  oval(ctx, x + 7, y - 13 + b, 0.9, 1.5, '#e6c06a');
}

// ── Мара: хозяйка кухни ─────────────────────────────────────────────────
export function drawMara32(ctx, x, y, o = {}) {
  const t = o.t || 0;
  shadowOval(ctx, x, y, 6.5);
  poly(ctx, [x - 3, y - 15, x + 3, y - 15, x + 6, y - 0.6, x - 6, y - 0.6], lin(ctx, x - 6, y - 15, x + 6, y, [[0, '#7a5638'], [0.45, '#553a25'], [1, '#2a1c12']]));
  // фартук
  poly(ctx, [x - 2.6, y - 12.6, x + 2.6, y - 12.6, x + 3.4, y - 2, x - 3.4, y - 2], lin(ctx, x - 3, 0, x + 3, 0, [[0, '#fffaf0'], [0.6, '#ece4cf'], [1, '#b9ab8e']]));
  path(ctx, [x - 2.6, y - 12.4, x + 2.6, y - 12.4], '#aeb0bc', 0.45);
  // руки
  oval(ctx, x - 4.4, y - 10, 1.2, 2.8, '#553a25');
  oval(ctx, x + 4.4, y - 10, 1.2, 2.8, '#553a25');
  oval(ctx, x - 4.6, y - 7, 1, 0.9, '#d4b08e');
  oval(ctx, x + 4.6, y - 7, 1, 0.9, '#d4b08e');
  // лицо и платок
  oval(ctx, x, y - 18.4, 3, 3.2, lin(ctx, x - 3, 0, x + 3, 0, [[0, '#e8c8a4'], [1, '#a88466']]));
  poly(ctx, [x - 3.8, y - 18, x - 3.6, y - 21.6, x, y - 23, x + 3.6, y - 21.6, x + 3.8, y - 18, x + 2.6, y - 20.4, x - 2.6, y - 20.4], lin(ctx, x - 4, y - 23, x + 4, y - 18, [[0, '#e0506e'], [0.5, '#86163a'], [1, '#4a0c1e']]));
  poly(ctx, [x - 3.8, y - 18, x - 4.6, y - 14.6, x - 3, y - 16], '#86163a');
  const blink = Math.floor(t * 0.7) % 6 === 0 ? 0.2 : 0.7;
  rect(ctx, x - 1.6, y - 18.4, 0.8, blink, INK);
  rect(ctx, x + 0.8, y - 18.4, 0.8, blink, INK);
  path(ctx, [x - 0.8, y - 16.4, x + 0.8, y - 16.4], '#7a4a18', 0.4);
}

// ── пёс ────────────────────────────────────────────────────────────────
export function drawDog32(ctx, x, y, o = {}) {
  const wag = Math.sin((o.t || 0) * 8);
  const C = o.past ? ['#ffd27a', '#c8842a', '#7a4a18'] : ['#c4c7d4', '#8a8d9c', '#4a4c5a'];
  shadowOval(ctx, x, y, 7);
  for (const lx of [-5.5, -3.5, 2.5, 4.4]) rect(ctx, x + lx, y - 4, 1.3, 4, lin(ctx, 0, y - 4, 0, y, [[0, C[1]], [1, C[2]]]));
  path(ctx, [x - 6, y - 6.4, x - 8.4, y - 8.4 + wag * 1.2], C[1], 1.2);
  oval(ctx, x - 0.6, y - 6.2, 6.2, 2.8, lin(ctx, 0, y - 9, 0, y - 3.4, [[0, C[0]], [0.5, C[1]], [1, C[2]]]));
  oval(ctx, x + 5.8, y - 9.2, 2.8, 2.5, lin(ctx, x + 3, y - 12, x + 8, y - 7, [[0, C[0]], [1, C[1]]]));
  oval(ctx, x + 8.2, y - 8.6, 1.6, 1.1, C[1]);
  oval(ctx, x + 9.4, y - 8.8, 0.6, 0.5, INK);
  poly(ctx, [x + 4, y - 10.6, x + 4.6, y - 13.4, x + 6, y - 11], C[2]);
  oval(ctx, x + 6.6, y - 9.8, 0.45, 0.45, INK);
}

// ── призрак-воспоминание (Арно, Сена, торговцы) ─────────────────────────
export function drawGhost32(ctx, x, y, o = {}) {
  const t = o.t || 0;
  // цвет воспоминания: янтарь (по умолчанию), светлый янтарь (Сена), молочный (жители убежища)
  const C = o.color === '#ece4cf'
    ? { hi: '#ffffff', base: '#e2d8c0', mid: '#b4aa94', lo: '#6e6656', skin: '#fff6e6' }
    : o.color === '#ffd27a'
      ? { hi: '#fff8e0', base: '#ffd27a', mid: '#d89a34', lo: '#7a4a18', skin: '#fff0c8' }
      : { hi: '#ffe9b0', base: '#e0a040', mid: '#b8721f', lo: '#5a3014', skin: '#ffd9a0' };
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * (o.alpha ?? 0.75);
  const sway = Math.sin(t * 1.6) * 0.4; // дыхание и лёгкое покачивание
  const fill = (x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, [[0, C.hi], [0.35, C.base], [0.75, C.mid], [1, C.lo]]);
  const woman = !!o.dress;
  // ноги / юбка
  if (woman) {
    poly(ctx, [x - 2.4, y - 10, x + 2.4, y - 10, x + 5, y - 0.8, x + 2, y - 0.2, x - 2, y - 0.2, x - 5, y - 0.8], fill(x - 5, y - 10, x + 5, y));
    path(ctx, [x - 0.6, y - 9, x - 1.6, y - 1], C.mid, 0.4);
    path(ctx, [x + 1.4, y - 9, x + 2.6, y - 1.2], C.lo, 0.4);
  } else {
    poly(ctx, [x - 2.7, y - 9, x - 0.3, y - 9, x - 0.6, y - 1, x - 2.5, y - 1], fill(x - 3, y - 9, x, y));
    poly(ctx, [x + 0.3, y - 9, x + 2.7, y - 9, x + 2.5, y - 1, x + 0.6, y - 1], fill(x, y - 9, x + 3, y));
    oval(ctx, x - 1.8, y - 0.8, 1.6, 0.8, C.lo);
    oval(ctx, x + 1.8, y - 0.8, 1.6, 0.8, C.lo);
  }
  // туловище: пальто с полами или лиф платья
  const top = y - 16.6 + sway * 0.3;
  if (woman) poly(ctx, [x - 3.2, top, x + 3.2, top, x + 2.4, y - 10, x - 2.4, y - 10], fill(x - 3, top, x + 3, y - 10));
  else {
    poly(ctx, [x - 3.6, top, x + 3.6, top, x + 3.4, y - 6.6, x + 0.4, y - 7.4, x - 0.4, y - 7.4, x - 3.4, y - 6.6], fill(x - 4, top, x + 4, y - 6));
    path(ctx, [x, top + 1.5, x, y - 7.6], C.lo, 0.4);
    rect(ctx, x - 3.4, y - 10.4, 6.8, 0.8, C.lo); // пояс
  }
  // плечи и руки с кистями
  oval(ctx, x, top + 0.3, woman ? 3.5 : 3.9, 1.2, C.base);
  for (const s of [-1, 1]) {
    const wave = o.wave && s > 0;
    const ex = x + s * (woman ? 3.8 : 4.3);
    const hx = wave ? x + s * 5.6 : x + s * (woman ? 3.6 : 4.1);
    const hy = wave ? top - 3.2 + Math.sin(t * 8) * 0.8 : y - 8.6 + (s > 0 ? sway : -sway) * 0.4;
    path(ctx, [x + s * 3.3, top + 0.8, ex, top + 4.2, hx, hy], s < 0 ? C.base : C.mid, 1.5);
    oval(ctx, hx, hy + (wave ? -0.6 : 0.6), 0.8, 0.9, C.skin);
  }
  // шаль у женщины
  if (woman) poly(ctx, [x - 3.4, top + 0.4, x + 3.4, top + 0.4, x, top + 4.4], C.mid);
  // шея и голова
  rect(ctx, x - 0.8, top - 1.8, 1.6, 2, C.mid);
  const hy = top - 4 + sway * 0.2;
  oval(ctx, x, hy, 2.3, 2.6, lin(ctx, x - 2.4, 0, x + 2.4, 0, [[0, C.skin], [0.6, C.base], [1, C.mid]]));
  rect(ctx, x - 1.2, hy - 0.2, 0.6, 0.6, C.lo);
  rect(ctx, x + 0.6, hy - 0.2, 0.6, 0.6, C.lo);
  if (o.hat) {
    rect(ctx, x - 2.2, hy - 5.4, 4.4, 3.2, fill(x - 2, hy - 5, x + 2, hy - 2));
    rect(ctx, x - 2.2, hy - 2.9, 4.4, 0.6, C.lo);
    oval(ctx, x, hy - 2.1, 3.8, 0.75, C.mid);
  } else if (woman) {
    poly(ctx, [x - 2.5, hy + 0.4, x - 2.2, hy - 2.2, x, hy - 2.9, x + 2.2, hy - 2.2, x + 2.5, hy + 0.4, x + 1.6, hy - 1.2, x - 1.6, hy - 1.2], C.mid);
    oval(ctx, x + 1.4, hy - 2.8, 1.3, 1.1, C.mid);
  } else poly(ctx, [x - 2.4, hy - 0.4, x - 1.8, hy - 2.4, x + 1.8, hy - 2.4, x + 2.4, hy - 0.4, x + 1.4, hy - 1.4, x - 1.4, hy - 1.4], C.lo);
  // контровой свет слева сверху
  path(ctx, [x - 2.1, hy - 1.2, x - 2.3, hy + 0.6], C.hi, 0.35);
  path(ctx, [x - 3.5, top + 0.8, x - 3.3, y - 8], C.hi, 0.35);
  // память мерцает: редкие строки развёртки и тающий низ
  const sh = Math.floor(t * 6) % 4;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < 26; j += 4) rect(ctx, x - 6, y - 26 + j + sh, 12, 0.5, 'rgba(0,0,0,0.35)');
  for (let i = 0; i < 6; i++) if ((i + Math.floor(t * 8)) % 2) rect(ctx, x - 5 + i * 2, y - 1.4, 1, 1.4, '#000');
  ctx.restore();
  if (Math.floor(t * 10) % 9 < 2) rect(ctx, x - 5 + ((t * 37) % 10), y - 6 - (Math.floor(t * 10) % 9) * 3, 0.6, 0.6, '#fff8e0');
  ctx.globalAlpha = a0;
}

// ── жители площади (воспоминания): v — 0 шляпа и машет, 1 платье, 2 кивает, 3 корзина ──
export function drawVillager32(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const f = Math.floor(t * 3) % 4;
  const v = o.v ?? 0;
  drawGhost32(ctx, x, y, { t, hat: v === 0, dress: v === 1 || v === 3, wave: v === 0 && f % 2 === 1, alpha: 0.85 });
  if (v === 3) {
    rect(ctx, x - 7.4, y - 12, 5, 3.6, lin(ctx, 0, y - 12, 0, y - 8, [[0, '#9a7450'], [1, '#3a281a']]));
    path(ctx, [x - 7, y - 12, x - 4.9, y - 14.6, x - 2.8, y - 12], '#77553a', 0.5);
  }
}

// Силуэт в Шраме: стоит спиной и не двигается — тёмный, с малиновым краем.
export function drawStillOne32(ctx, x, y) {
  shadowOval(ctx, x, y, 5, 0.5);
  rect(ctx, x - 2.8, y - 7, 2, 7, '#100e16');
  rect(ctx, x + 0.8, y - 7, 2, 7, '#100e16');
  poly(ctx, [x - 4.6, y - 18, x + 4.6, y - 18, x + 5, y - 6, x - 5, y - 6], lin(ctx, x - 5, 0, x + 5, 0, [[0, '#2a2236'], [0.5, '#16131e'], [1, '#0a080e']]));
  oval(ctx, x, y - 21, 3, 3.2, '#16131e');
  path(ctx, [x - 5, y - 17, x - 5.2, y - 7], '#86163a', 0.5);
  path(ctx, [x + 5, y - 15, x + 5.2, y - 9], '#4a0c1e', 0.5);
}

// ── Латунный Мальчик: статуя на постаменте (в Шраме — разрушена) ─────────
export function drawBrassBoy32(ctx, x, y, o = {}) {
  const past = o.phase === 'past';
  rect(ctx, x - 10, y - 8, 20, 8, lin(ctx, x - 10, 0, x + 10, 0, [[0, '#7b88a3'], [0.3, '#4a5168'], [1, '#1d212d']]));
  rect(ctx, x - 11, y - 9, 22, 1.4, '#8a93ae');
  rect(ctx, x - 11, y - 0.8, 22, 0.8, INK);
  const B = past ? ['#fff0b8', '#e6c06a', '#b08a3a', '#6a4c1c'] : ['#cfa75a', '#9c7832', '#6a4c1c', '#3a2810'];
  const g = (x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, [[0, B[0]], [0.35, B[1]], [0.75, B[2]], [1, B[3]]]);
  if (!past) {
    rect(ctx, x - 3, y - 16, 2, 8, g(x - 3, 0, x - 1, 0));
    rect(ctx, x + 1, y - 13, 2, 5, g(x + 1, 0, x + 3, 0));
    poly(ctx, [x - 8, y - 9, x - 4.6, y - 11, x - 3.6, y - 9], B[2]);
    poly(ctx, [x + 4.6, y - 9, x + 6.4, y - 12, x + 7.2, y - 9], B[2]);
    path(ctx, [x - 3, y - 16.2, x - 1, y - 17.4, x + 1, y - 16, x + 3, y - 13.2], '#c8284a', 0.6);
    return;
  }
  const b = Math.sin((o.t || 0) * 2) * 0.5;
  rect(ctx, x - 3, y - 16, 2, 8, g(x - 3, 0, x - 1, 0));
  rect(ctx, x + 1, y - 16, 2, 8, g(x + 1, 0, x + 3, 0));
  oval(ctx, x - 2.4, y - 8.6, 1.8, 0.8, B[3]);
  oval(ctx, x + 2.4, y - 8.6, 1.8, 0.8, B[3]);
  rect(ctx, x - 4, y - 19 + b, 8, 4, B[3]);
  rect(ctx, x - 4.4, y - 27 + b, 8.8, 8.4, g(x - 4, y - 27, x + 4, y - 19));
  path(ctx, [x - 0.6, y - 27 + b, x - 0.6, y - 19 + b], B[3], 0.45);
  oval(ctx, x + 1, y - 25 + b, 0.45, 0.45, '#fff8e0');
  oval(ctx, x + 1, y - 22 + b, 0.45, 0.45, '#fff8e0');
  rect(ctx, x - 4.4, y - 27.4 + b, 8.8, 1, '#ece4cf');
  for (const s of [-1, 1]) {
    oval(ctx, x + s * 5.2, y - 23 + b, 1.2, 3.6, g(x + s * 5 - 1, 0, x + s * 5 + 1, 0));
    oval(ctx, x + s * 5.2, y - 23 + b, 1.3, 0.5, B[3]);
  }
  oval(ctx, x, y - 30.6 + b, 3.2, 3.6, rad(ctx, x - 1.2, y - 32 + b, 0.4, 4.6, [[0, B[0]], [0.5, B[1]], [1, B[3]]]));
  rect(ctx, x - 1.6, y - 31 + b, 0.7, 0.7, VOID);
  rect(ctx, x + 0.9, y - 31 + b, 0.7, 0.7, VOID);
  path(ctx, [x - 0.8, y - 28.8 + b, x + 0.8, y - 28.8 + b], B[3], 0.4);
  poly(ctx, [x - 3.8, y - 32.6 + b, x - 3, y - 35.4 + b, x + 3, y - 35.4 + b, x + 3.8, y - 32.6 + b], B[3]);
  poly(ctx, [x + 2, y - 33 + b, x + 6, y - 33.4 + b, x + 5, y - 32.2 + b, x + 2, y - 32.2 + b], B[3]);
  path(ctx, [x + 4.4, y - 29 + b, x + 6.6, y - 29 + b], B[0], 0.6);
  path(ctx, [x + 6.6, y - 31.6 + b, x + 6.6, y - 26.6 + b], B[0], 0.6);
}

// ── Звонкая Тень: вытянутое существо без лица и кольцо колокольчиков ──────
export function drawShadow32(ctx, x, y, o) {
  const past = o.phase === 'past';
  const t = o.t || 0;
  const n = 6;
  const bells = (front) => {
    for (let i = 0; i < n; i++) {
      const a = t * (past ? 1 : 2.4) + (i / n) * Math.PI * 2;
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      const bx = x + Math.cos(a) * 13;
      const by = y - 18 + Math.sin(a) * 5;
      const c = o.shield ? ['#fff0b8', '#cfa75a', '#6a4c1c'] : ['#aeb0bc', '#55576a', '#24252e'];
      poly(ctx, [bx - 1.4, by - 2, bx + 1.4, by - 2, bx + 2.4, by + 1.2, bx - 2.4, by + 1.2], lin(ctx, bx - 2, 0, bx + 2, 0, [[0, c[2]], [0.35, c[0]], [1, c[2]]]));
      oval(ctx, bx, by + 1.5, 0.5, 0.5, c[2]);
    }
  };
  if (o.layer === 'front') {
    bells(true);
    return;
  }
  bells(false);
  // тело-шлейф
  const pts = [x - 3, y - 34];
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    pts.push(x + 3 + k * 5 + Math.sin(t * 4 + k * 4) * k, y - 34 + k * 31);
  }
  for (let i = 0; i <= 7; i++) pts.push(x + 8 - i * (16 / 7), y - 3 + (i % 2 ? 2.5 : 0) + Math.sin(t * 6 + i) * 0.6);
  for (let i = 10; i >= 0; i--) {
    const k = i / 10;
    pts.push(x - 3 - k * 5 + Math.sin(t * 4 + k * 4 + 1) * k, y - 34 + k * 31);
  }
  poly(ctx, pts, lin(ctx, x - 8, y - 34, x + 8, y, past ? [[0, '#55607e'], [0.5, '#2a3150'], [1, '#121628']] : [[0, '#2a2733'], [0.5, '#0d0c14'], [1, '#04050a']]));
  inside(ctx, () => {
    path(ctx, [x - 1, y - 28, x - 3, y - 5], 'rgba(120,130,170,0.25)', 0.5);
    path(ctx, [x + 2, y - 28, x + 4, y - 5], 'rgba(0,0,0,0.4)', 0.6);
  });
  // лицо — пустой бледный овал
  oval(ctx, x, y - 30.4, 2.4, 3.4, past ? rad(ctx, x - 0.6, y - 31.4, 0.2, 3.4, [[0, '#fff8e0'], [1, '#e0a040']]) : rad(ctx, x - 0.6, y - 31.4, 0.2, 3.4, [[0, '#ffffff'], [1, '#aeb0bc']]));
  if (o.shield) {
    ctx.strokeStyle = 'rgba(230,192,106,0.5)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([1.5, 1.5]);
    ctx.beginPath();
    ctx.ellipse(x, y - 18, 15, 6.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Брат Мел — звонарь без башни (босс) ─────────────────────────────────
// version: 'imprint' (весь молочно-золотой) | 'scar' (весь малиновый) | целый (пополам).
export function drawMel32(ctx, x, y, o) {
  const t = o.t || 0;
  const v = o.version;
  const hover = Math.sin(t * 1.6) * 1.5;
  const yy = y - 4 + hover;
  const MILK = [[0, '#fffaf0'], [0.4, '#ece4cf'], [1, '#9a8e74']];
  const RED = [[0, '#e0506e'], [0.4, '#86163a'], [1, '#2a0610']];
  const robe = (side) => {
    const s = side; // -1 левая, 1 правая
    const pts = [x, yy - 52, x + s * 5, yy - 52];
    for (let i = 0; i <= 8; i++) pts.push(x + s * (5 + i * 2), yy - 52 + i * 5.5);
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      pts.push(x + s * (21 - k * 21), yy - 8 + (i % 2 ? 3 + Math.sin(t * 2 + i) * 1.4 : 0));
    }
    const stops = v === 'imprint' ? MILK : v === 'scar' ? RED : s < 0 ? MILK : RED;
    poly(ctx, pts, lin(ctx, x + s * 2, yy - 52, x + s * 20, yy - 6, stops));
  };
  oval(ctx, x, y - 0.6, 17, 4, 'rgba(3,4,10,0.5)');
  robe(-1);
  robe(1);
  inside(ctx, () => {
    for (let i = -16; i <= 16; i += 4) path(ctx, [x + i * 0.3, yy - 48, x + i, yy - 9], 'rgba(10,6,10,0.3)', 0.6);
    if (!v) for (let i = 0; i < 30; i++) rect(ctx, x + 1 + ((i * 7) % 18), yy - 46 + ((i * 13) % 38), 0.8, 0.8, '#04050a');
  });
  // золотые цепи наискось
  for (let i = 0; i < 8; i++) oval(ctx, x - 13 + i * 2.2, yy - 41 + i * 3, 1, 0.6, '#e6c06a');
  // капюшон и пустота лица
  const hood = v === 'scar' ? RED : MILK;
  poly(ctx, [x - 7.5, yy - 50, x - 2, yy - 66, x + 2, yy - 66, x + 7.5, yy - 50], lin(ctx, x - 7, yy - 66, x + 7, yy - 50, hood));
  oval(ctx, x, yy - 56, 5, 6, VOID);
  if (o.windup) {
    oval(ctx, x, yy - 57, 2.8, 2.8, '#ff5a7a');
    oval(ctx, x, yy - 57, 1.4, 1.4, '#ffffff');
  }
  // нимбы
  ctx.lineWidth = 0.6;
  if (v !== 'scar') {
    ctx.strokeStyle = '#e0a040';
    ctx.setLineDash([1.6, 1.2]);
    ctx.beginPath();
    ctx.arc(x, yy - 57, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (v !== 'imprint') {
    ctx.strokeStyle = '#c8284a';
    ctx.setLineDash([1, 2]);
    ctx.beginPath();
    ctx.arc(x + 2, yy - 55, 14, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // руки с колокольчиками на цепях
  const sl = Math.sin(t * 2) * 3;
  const sr = Math.sin(t * 2 + 1) * 3;
  path(ctx, [x - 14, yy - 38, x - 20 + sl, yy - 22], '#b08a3a', 0.7);
  path(ctx, [x + 14, yy - 38, x + 20 + sr, yy - 24], '#b08a3a', 0.7);
  smallBell(ctx, x - 20 + sl, yy - 22, false);
  smallBell(ctx, x + 20 + sr, yy - 24, v !== 'imprint');
}

function smallBell(ctx, x, y, scar) {
  const c = scar ? ['#ff5a7a', '#86163a', '#2a0610'] : ['#fff0b8', '#b08a3a', '#3a2810'];
  poly(ctx, [x - 2, y, x + 2, y, x + 3.4, y + 5, x - 3.4, y + 5], lin(ctx, x - 3, 0, x + 3, 0, [[0, c[2]], [0.35, c[0]], [0.7, c[1]], [1, c[2]]]));
  rect(ctx, x - 4, y + 5, 8, 0.9, c[0]);
  oval(ctx, x, y + 6.2, 0.7, 0.7, c[2]);
}
