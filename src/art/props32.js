// Объекты окружения — 32-битные кадры (форма в плотной сетке, пикселизация атласом).
// Правило читаемости: у каждого вида свой силуэт и свой материал — сундук окован латунью
// и поблёскивает (добыча), обломки — низкая груда серых камней, колонна — каннелюры и
// капитель, фонарь — кованый столб с огнём. Подписи сигнатур: (ctx, p, g), g = { time }.
import { poly, oval, path, rect, lin, rad, inside } from './hd.js';
import { drawGhost32 } from './npcs32.js';

const PAST = 'past';
const ph = (p) => p.tl?.phase;
const IRON = ['#0d0e14', '#1c1e28', '#353848', '#565a6e'];
const WOOD = ['#24180f', '#3a281a', '#553a25', '#77553a', '#9a7450'];
const STONE = ['#13151d', '#262a38', '#3d4459', '#56607a', '#7b88a3'];

function shadowOval(ctx, x, y, rx, a = 0.5) {
  oval(ctx, x, y - 0.5, rx, Math.max(1, rx * 0.28), `rgba(3,4,10,${a})`);
}

function star(ctx, x, y, r, c) {
  path(ctx, [x - r, y, x + r, y], c, 0.5);
  path(ctx, [x, y - r, x, y + r], c, 0.5);
  oval(ctx, x, y, 0.6, 0.6, '#ffffff');
}

// ── сундук: окованный, латунный замок, блик добычи ──────────────────────
export function drawChestHd(ctx, p, g) {
  if (p.open === 'gone') return;
  const x = p.x;
  const y = p.y;
  shadowOval(ctx, x, y, 10);
  // короб
  rect(ctx, x - 8.5, y - 9, 17, 9, lin(ctx, 0, y - 9, 0, y, [[0, WOOD[3]], [0.5, WOOD[2]], [1, WOOD[0]]]));
  inside(ctx, () => {
    for (let i = -6; i < 8; i += 3.4) path(ctx, [x + i, y - 9, x + i, y], 'rgba(20,12,6,0.5)', 0.35);
  });
  // крышка (полукруглая)
  if (p.open) {
    poly(ctx, [x - 8.5, y - 9, x + 8.5, y - 9, x + 8, y - 16, x - 8, y - 16], lin(ctx, 0, y - 16, 0, y - 9, [[0, WOOD[1]], [1, WOOD[3]]]));
    rect(ctx, x - 7.5, y - 10.4, 15, 1.6, '#0a0705');
    // внутри — отсвет золы и осколков
    oval(ctx, x, y - 9.6, 5, 0.8, 'rgba(255,190,90,0.7)');
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 8.5, y - 9);
    ctx.lineTo(x - 8.5, y - 11.5);
    ctx.quadraticCurveTo(x, y - 17, x + 8.5, y - 11.5);
    ctx.lineTo(x + 8.5, y - 9);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, y - 16, 0, y - 9, [[0, WOOD[4]], [0.35, WOOD[3]], [1, WOOD[1]]]);
    ctx.fill();
  }
  // латунные оковки и уголки
  for (const bx of [-6.2, 5]) rect(ctx, x + bx, y - (p.open ? 9 : 15.2), 1.3, p.open ? 9 : 15.2, lin(ctx, x + bx, 0, x + bx + 1.3, 0, [[0, '#f2d792'], [1, '#6a4c1c']]));
  rect(ctx, x - 8.5, y - 9.6, 17, 1.2, lin(ctx, 0, y - 9.6, 0, y - 8.4, [[0, '#f2d792'], [1, '#6a4c1c']]));
  rect(ctx, x - 8.5, y - 1.2, 17, 1.2, '#4a3414');
  if (!p.open) {
    rect(ctx, x - 1.6, y - 10.6, 3.2, 3.6, lin(ctx, x - 1.6, 0, x + 1.6, 0, [[0, '#f2d792'], [0.5, '#cfa75a'], [1, '#6a4c1c']]));
    rect(ctx, x - 0.4, y - 9.2, 0.8, 1.4, '#140c04');
    // блик-звёздочка: «тут добыча»
    const f = Math.floor((g.time || 0) * 6) % 4;
    if (f === 0) star(ctx, x + 6, y - 14, 1.8, '#ffe9b0');
    else if (f === 1) star(ctx, x + 6, y - 14, 1, '#ffe9b0');
  }
}

// ── обломки: низкая груда камней, не похожа ни на сундук, ни на стену ─────
export function drawRubbleHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  const id = p.id || 1;
  shadowOval(ctx, x, y, 9, 0.4);
  const stones = [[-6, -1.6, 3.4, 2], [-1.6, -2.4, 3.6, 2.8], [3.6, -1.4, 2.8, 1.8], [-3.6, -4.2, 2.6, 1.8], [1.4, -5, 2.2, 1.6], [6.4, -0.6, 1.6, 1]];
  stones.forEach(([dx, dy, rx, ry], i) => {
    const rot = ((id * 7 + i * 3) % 10) / 10 - 0.5;
    oval(ctx, x + dx, y + dy, rx, ry, lin(ctx, x + dx - rx, y + dy - ry, x + dx + rx, y + dy + ry, [[0, STONE[4]], [0.4, STONE[3]], [1, STONE[1]]]), rot);
    path(ctx, [x + dx - rx * 0.6, y + dy - ry * 0.5, x + dx + rx * 0.2, y + dy - ry * 0.8], 'rgba(200,210,235,0.35)', 0.35);
  });
  oval(ctx, x - 7.6, y - 0.4, 1, 0.6, '#3b4a2a');
}

// ── дорожный указатель ───────────────────────────────────────────────
export function drawSignHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  shadowOval(ctx, x, y, 6);
  rect(ctx, x - 1.1, y - 23, 2.2, 23, lin(ctx, x - 1, 0, x + 1, 0, [[0, WOOD[3]], [1, WOOD[0]]]));
  // доска-стрелка
  poly(ctx, [x - 13, y - 24.5, x + 12, y - 24.5, x + 16, y - 20, x + 12, y - 15.5, x - 13, y - 15.5], lin(ctx, 0, y - 24.5, 0, y - 15.5, [[0, past ? WOOD[4] : WOOD[3]], [0.5, past ? WOOD[3] : WOOD[2]], [1, WOOD[1]]]));
  inside(ctx, () => {
    path(ctx, [x - 13, y - 21.5, x + 16, y - 21.5], 'rgba(20,12,6,0.4)', 0.3);
    path(ctx, [x - 13, y - 18.5, x + 16, y - 18.5], 'rgba(20,12,6,0.4)', 0.3);
  });
  path(ctx, [x - 13, y - 24.3, x + 12, y - 24.3], past ? '#e0a040' : '#7a4a18', 0.4);
  oval(ctx, x - 11, y - 20, 0.5, 0.5, IRON[2]);
  // надпись: в прошлом — янтарь, в Шраме буквы выпадают и мигают
  const n = past ? 9 : 5 + (Math.floor(t * 9) % 4);
  for (let i = 0; i < n; i++) rect(ctx, x - 10.5 + i * 2.5, y - 21.4 + (i % 2) * 0.6, 1.6, 2.4, past ? '#ffd27a' : '#aeb0bc');
  if (!past) rect(ctx, x + 2 + ((t * 23) % 8), y - 21.6, 1.8, 3, '#c8284a');
  if (past) {
    drawGhost32(ctx, x - 26, y + 4, { t, hat: true, alpha: 0.55 });
    drawGhost32(ctx, x + 30, y + 10, { t: t + 1, dress: true, alpha: 0.5 });
  }
}

// ── камень памяти ─────────────────────────────────────────────────────
export function drawMemoryStoneHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  if (past) {
    // кольцо защиты на земле
    ctx.save();
    ctx.strokeStyle = 'rgba(224,160,64,0.45)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 52, 26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    shadowOval(ctx, x, y, 10);
    poly(ctx, [x - 7, y, x - 6, y - 24, x - 2, y - 29, x + 4, y - 27, x + 7, y - 22, x + 7, y], lin(ctx, x - 7, 0, x + 7, 0, [[0, STONE[4]], [0.3, STONE[3]], [0.8, STONE[2]], [1, STONE[1]]]));
    const gl = 0.6 + Math.sin(t * 3) * 0.4;
    for (let i = 0; i < 4; i++) {
      const ry = y - 22 + i * 5;
      rect(ctx, x - 2 + (i & 1) * 1.6, ry, 2.6, 1.6, `rgba(255,210,122,${gl})`);
      rect(ctx, x - 1.6 + (i & 1) * 1.6, ry + 0.4, 1.4, 0.8, '#fff4d0');
    }
    oval(ctx, x - 5, y - 1, 2.4, 1.2, '#33462a');
  } else {
    drawRubbleHd(ctx, p);
    oval(ctx, x, y - 5, 1.4, 0.9, '#b8721f');
    oval(ctx, x, y - 5, 0.6, 0.5, '#ffd27a');
  }
}

// ── фонарь на столбе (вылазки) ───────────────────────────────────────
export function drawLanternHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  shadowOval(ctx, x, y, 5);
  rect(ctx, x - 2.4, y - 2.4, 4.8, 2.4, IRON[2]);
  rect(ctx, x - 0.9, y - 27, 1.8, 25, lin(ctx, x - 1, 0, x + 1, 0, [[0, IRON[3]], [1, IRON[0]]]));
  poly(ctx, [x - 4, y - 34, x + 4, y - 34, x + 3.4, y - 26, x - 3.4, y - 26], IRON[0]);
  if (past) {
    poly(ctx, [x - 3.2, y - 33, x + 3.2, y - 33, x + 2.7, y - 27, x - 2.7, y - 27], rad(ctx, x, y - 30, 0.3, 4, [[0, '#fff8e0'], [0.4, '#ffd27a'], [1, '#b8721f']]));
  } else {
    poly(ctx, [x - 3.2, y - 33, x + 3.2, y - 33, x + 2.7, y - 27, x - 2.7, y - 27], '#0d2a2c');
    const s = Math.floor(t * 12) % 5;
    if (s < 2) path(ctx, [x - 2.5, y - 32 + s, x + 2, y - 28 - s], '#a8fff0', 0.5);
  }
  path(ctx, [x, y - 33, x, y - 27], IRON[0], 0.4);
  poly(ctx, [x - 5, y - 34, x, y - 37.5, x + 5, y - 34], lin(ctx, x - 5, 0, x + 5, 0, [[0, IRON[3]], [1, IRON[0]]]));
}

// ── ручной фонарь привратника: стоит на земле или висит в руке героя (p.carried) ──
export function drawHandLanternHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.carried ? p.y - 9 : p.y;
  const t = g.time || 0;
  if (!p.carried) shadowOval(ctx, x, y, 4);
  // дужка и крышка
  path(ctx, [x - 2.6, y - 11, x - 1.6, y - 14, x + 1.6, y - 14, x + 2.6, y - 11], IRON[0], 0.7);
  poly(ctx, [x - 3.6, y - 11, x + 3.6, y - 11, x + 2.6, y - 9.4, x - 2.6, y - 9.4], lin(ctx, x - 4, 0, x + 4, 0, [[0, IRON[3]], [1, IRON[0]]]));
  // стекло
  if (past) {
    const fl = 0.3 + Math.sin(t * 9) * 0.06;
    poly(ctx, [x - 2.8, y - 9.4, x + 2.8, y - 9.4, x + 2.8, y - 2.4, x - 2.8, y - 2.4], rad(ctx, x, y - 6, fl, 4.4, [[0, '#fff8e0'], [0.45, '#ffd27a'], [1, '#b8721f']]));
  } else {
    poly(ctx, [x - 2.8, y - 9.4, x + 2.8, y - 9.4, x + 2.8, y - 2.4, x - 2.8, y - 2.4], '#0d2a2c');
    const s = Math.floor(t * 12) % 5;
    if (s < 2) path(ctx, [x - 2, y - 8 + s, x + 1.6, y - 4 - s], '#a8fff0', 0.5);
  }
  path(ctx, [x - 2.8, y - 9.4, x - 2.8, y - 2.4], IRON[1], 0.6);
  path(ctx, [x + 2.8, y - 9.4, x + 2.8, y - 2.4], IRON[0], 0.6);
  path(ctx, [x, y - 9.4, x, y - 2.4], IRON[0], 0.35);
  // донце
  rect(ctx, x - 3.4, y - 2.4, 6.8, 1.6, IRON[2]);
}

// ── котёл на треноге: в прошлом цел и кипит (пар), в Шраме — ржавый, с дырой ──
export function drawKettleHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const boil = past && p.boil;
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  shadowOval(ctx, x, y, 7, 0.35);
  // угли под котлом
  for (let i = 0; i < 4; i++) oval(ctx, x - 3 + i * 2, y - 1, 1.3, 0.8, boil ? (i % 2 ? '#ff9a3c' : '#c8501e') : '#2a2226');
  // тренога
  path(ctx, [x - 7, y, x, y - 17], WOOD[2], 1);
  path(ctx, [x + 7, y, x, y - 17], WOOD[1], 1);
  path(ctx, [x, y - 17, x, y - 12], IRON[1], 0.5);
  // котёл
  oval(ctx, x, y - 8, 5.2, 4, lin(ctx, x - 5, 0, x + 5, 0, past ? [[0, '#5a5f73'], [0.5, '#3a3d4c'], [1, '#1c1e28']] : [[0, '#6a3a24'], [0.6, '#3a2418'], [1, '#1c1210']]));
  oval(ctx, x, y - 11.6, 4.6, 1.2, past ? '#1c1e28' : '#24160e');
  if (!past) {
    oval(ctx, x + 2, y - 7, 1.1, 0.9, '#05060a'); // дыра
    path(ctx, [x - 3, y - 9, x - 1, y - 6], '#8a4a2a', 0.4);
  }
  if (boil) {
    oval(ctx, x, y - 11.6, 3.6, 0.8, '#e8f0ff');
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.8 + i / 3) % 1;
      oval(ctx, x - 1 + Math.sin(k * 6 + i) * 2, y - 14 - k * 12, 1.4 + k * 2, 1 + k * 1.4, `rgba(220,230,245,${0.55 * (1 - k)})`);
    }
  }
}

// ── заслонка погреба (плоская): в Шраме — заколочена, в прошлом — поднята паром ──
export function drawHatchHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.y;
  const w = p.w;
  const h = p.h;
  rect(ctx, x, y, w, h, STONE[1]);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, '#07080c');
  if (past) {
    // ступени вниз и тёплый свет снизу
    for (let i = 0; i < 3; i++) rect(ctx, x + 3, y + 3 + i * 3, w - 6, 1.4, STONE[2 - (i > 1 ? 1 : 0)]);
    rect(ctx, x + 3, y + h - 3, w - 6, 1.5, 'rgba(255,170,90,0.45)');
    // поднятая крышка стоит ребром над проёмом
    poly(ctx, [x, y + 1, x + w, y + 1, x + w - 2, y - 6, x + 2, y - 6], lin(ctx, 0, y - 6, 0, y + 1, [[0, WOOD[3]], [1, WOOD[1]]]));
    path(ctx, [x + 2, y - 2.5, x + w - 2, y - 2.5], IRON[2], 0.6);
  } else {
    poly(ctx, [x + 1, y + 1, x + w - 1, y + 1, x + w - 1, y + h - 1, x + 1, y + h - 1], lin(ctx, 0, y, 0, y + h, [[0, WOOD[2]], [1, WOOD[0]]]));
    for (let i = 1; i < 4; i++) path(ctx, [x + 1, y + (h * i) / 4, x + w - 1, y + (h * i) / 4], WOOD[0], 0.5);
    path(ctx, [x + 2, y + 2, x + w - 2, y + h - 2], IRON[2], 0.9);
    path(ctx, [x + w - 2, y + 2, x + 2, y + h - 2], IRON[2], 0.9);
    const s = Math.floor((g.time || 0) * 5) % 4;
    if (s === 0) path(ctx, [x + w / 2 - 2, y + h / 2, x + w / 2 + 2, y + h / 2 + 1], '#86163a', 0.5);
  }
}

// ── костёр ────────────────────────────────────────────────────────────
export function drawCampfireHd(ctx, p, g) {
  const past = ph(p) === PAST;
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const sx = x + Math.cos(a) * 6.5;
    const sy = y - 2.5 + Math.sin(a) * 2.6;
    oval(ctx, sx, sy, 1.8, 1.2, lin(ctx, sx - 2, sy - 1, sx + 2, sy + 1, [[0, STONE[4]], [1, STONE[1]]]));
  }
  path(ctx, [x - 5, y - 2, x + 4, y - 5], WOOD[2], 1.6);
  path(ctx, [x - 4, y - 5, x + 5, y - 2], WOOD[3], 1.6);
  if (past) {
    // языки пламени: три слоя от тёмно-оранжевого к белому
    const flame = (s, c) => {
      const pts = [x - 4.5 * s, y - 3];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        const h = (6 + Math.sin(t * 9 + i * 1.7) * 2.2 + Math.sin(k * Math.PI) * 6) * s;
        pts.push(x - 4.5 * s + 9 * s * k, y - 3 - h * (i % 2 ? 1 : 0.55));
      }
      pts.push(x + 4.5 * s, y - 3);
      poly(ctx, pts, c);
    };
    flame(1, '#b8421c');
    flame(0.75, '#e0a040');
    flame(0.45, '#ffd27a');
    oval(ctx, x, y - 4.5, 1.2, 2, '#fff8e0');
  } else {
    oval(ctx, x, y - 3.5, 3.4, 1.2, '#55576a');
    const e = Math.floor(t * 3) % 4;
    oval(ctx, x - 2 + e, y - 3.8, 0.6, 0.5, '#e0a040');
    oval(ctx, x + 1, y - 3.2, 0.5, 0.4, e % 2 ? '#7a4a18' : '#b8721f');
  }
}

// ── колонна ───────────────────────────────────────────────────────────
export function drawPillarHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  const h = p.tall ?? 40;
  shadowOval(ctx, x + 2, y, 12);
  rect(ctx, x - 9, y - 4, 18, 4, lin(ctx, 0, y - 4, 0, y, [[0, STONE[3]], [1, STONE[1]]]));
  rect(ctx, x - 6.5, y - h, 13, h - 4, lin(ctx, x - 6.5, 0, x + 6.5, 0, [[0, STONE[4]], [0.25, STONE[3]], [0.7, STONE[2]], [1, STONE[0]]]));
  inside(ctx, () => {
    for (let i = -4; i <= 4; i += 2.6) path(ctx, [x + i, y - h, x + i, y - 4], 'rgba(10,12,20,0.45)', 0.4);
    oval(ctx, x - 3, y - 8, 3, 2.4, 'rgba(51,70,42,0.7)');
  });
  if (p.broken) {
    poly(ctx, [x - 6.5, y - h, x - 4, y - h - 3, x - 1, y - h + 1, x + 2, y - h - 2, x + 6.5, y - h + 2, x + 6.5, y - h + 4, x - 6.5, y - h + 4], STONE[2]);
    path(ctx, [x - 6.5, y - h, x - 4, y - h - 3, x - 1, y - h + 1, x + 2, y - h - 2, x + 6.5, y - h + 2], 'rgba(200,210,235,0.4)', 0.4);
  } else {
    rect(ctx, x - 9, y - h - 4, 18, 4, lin(ctx, 0, y - h - 4, 0, y - h, [[0, STONE[4]], [1, STONE[1]]]));
    path(ctx, [x - 9, y - h - 3.6, x + 9, y - h - 3.6], 'rgba(220,225,245,0.45)', 0.4);
  }
}

// ── свечи ─────────────────────────────────────────────────────────────
export function drawCandlesHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  oval(ctx, x, y - 0.5, 6, 1.4, 'rgba(3,4,10,0.45)');
  for (let i = 0; i < 3; i++) {
    const cx = x - 4 + i * 4;
    const h = 4 + ((i * 3) % 4);
    rect(ctx, cx - 1, y - h, 2, h, lin(ctx, cx - 1, 0, cx + 1, 0, [[0, '#fff4e0'], [1, '#b9ab8e']]));
    oval(ctx, cx + 0.4, y - h + 1.4, 0.4, 1, '#e2d6ba');
    const f = Math.sin(t * 9 + i * 2) * 0.3;
    oval(ctx, cx + f * 0.5, y - h - 1.4, 0.8, 1.6, '#ffb040');
    oval(ctx, cx + f * 0.5, y - h - 1.1, 0.45, 0.9, '#fff8e0');
  }
}

// ── печь ──────────────────────────────────────────────────────────────
export function drawStoveHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  const t = g.time || 0;
  shadowOval(ctx, x, y, 16);
  rect(ctx, x - 3.5, y - 40, 7, 15, lin(ctx, x - 3.5, 0, x + 3.5, 0, [[0, '#5a3a2a'], [1, '#2a1a12']]));
  rect(ctx, x - 14, y - 26, 28, 26, lin(ctx, x - 14, 0, x + 14, 0, [[0, '#7a4a32'], [0.4, '#5a3424'], [1, '#2a1810']]));
  inside(ctx, () => {
    for (let j = 0; j < 7; j++) {
      const yy = y - 26 + j * 3.8;
      path(ctx, [x - 14, yy, x + 14, yy], 'rgba(20,10,6,0.6)', 0.4);
      for (let i = -14 + (j & 1) * 3; i < 14; i += 6) path(ctx, [x + i, yy, x + i, yy + 3.8], 'rgba(20,10,6,0.5)', 0.35);
    }
  });
  rect(ctx, x - 15, y - 27.5, 30, 2.4, '#8a6a52');
  // устье с огнём
  ctx.beginPath();
  ctx.roundRect(x - 8, y - 16, 16, 12, [6, 6, 0, 0]);
  ctx.fillStyle = '#0a0503';
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const hh = 3 + (Math.sin(t * 7 + i) + 1) * 2;
    oval(ctx, x - 5 + i * 2, y - 5 - hh / 2, 1.2, hh / 2, i % 2 ? '#e0a040' : '#ffd27a');
  }
  oval(ctx, x, y - 5, 6, 1.5, 'rgba(255,200,100,0.8)');
}

// ── стол с картой вылазок ─────────────────────────────────────────────
export function drawTableHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  shadowOval(ctx, x, y, 18);
  for (const lx of [-14, 12]) rect(ctx, x + lx, y - 9, 2, 9, lin(ctx, x + lx, 0, x + lx + 2, 0, [[0, WOOD[2]], [1, WOOD[0]]]));
  rect(ctx, x - 16.5, y - 15, 33, 6, lin(ctx, 0, y - 15, 0, y - 9, [[0, WOOD[4]], [0.3, WOOD[3]], [1, WOOD[1]]]));
  path(ctx, [x - 16.5, y - 14.7, x + 16.5, y - 14.7], '#cfa75a', 0.35);
  // карта и фишки
  poly(ctx, [x - 9, y - 15.5, x + 4, y - 15.8, x + 4.5, y - 11.6, x - 8.6, y - 11.4], '#e2d6ba');
  path(ctx, [x - 7, y - 14, x - 3, y - 13, x + 2, y - 14.4], '#7a4a18', 0.35);
  oval(ctx, x - 5, y - 13.6, 0.8, 0.8, '#c8284a');
  oval(ctx, x + 1, y - 12.6, 0.8, 0.8, '#e0a040');
  oval(ctx, x + 8, y - 13, 1.6, 1, '#cfa75a');
}

export function drawWindowHd(ctx, p, g) {
  const x = p.x;
  const y = p.y;
  ctx.beginPath();
  ctx.roundRect(x - 10, y - 15, 20, 15, [6, 6, 0, 0]);
  ctx.fillStyle = '#05060c';
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 9, y - 14, 18, 13, [5, 5, 0, 0]);
  ctx.fillStyle = lin(ctx, 0, y - 14, 0, y - 1, [[0, p.bell ? '#2a3150' : '#0b1024'], [1, p.bell ? '#3d4760' : '#1b2340']]);
  ctx.fill();
  oval(ctx, x + 4, y - 9, 2, 2, '#ece4cf');
  if (p.bell && Math.floor(g.time || 0) % 9 === 0) oval(ctx, x - 4, y - 5, 1.6, 1.6, '#e0a040');
  path(ctx, [x, y - 14, x, y - 1], '#05060c', 0.7);
  path(ctx, [x - 9, y - 7, x + 9, y - 7], '#05060c', 0.7);
  rect(ctx, x - 11, y - 1, 22, 1.4, STONE[3]);
}

export function drawPortraitsHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  const n = p.count ?? 4;
  for (let i = 0; i < 5; i++) {
    const fx = x - 22 + i * 10;
    rect(ctx, fx, y - 12, 8, 10, lin(ctx, fx, y - 12, fx + 8, y - 2, [[0, '#f2d792'], [0.5, '#b08a3a'], [1, '#6a4c1c']]));
    rect(ctx, fx + 1, y - 11, 6, 8, i < n ? '#2a3150' : '#04050a');
    if (i < n) {
      oval(ctx, fx + 4, y - 8.4, 1.4, 1.6, '#c9a88a');
      oval(ctx, fx + 4, y - 4.6, 2.4, 1.6, '#4d649a');
    }
  }
}

export function drawShelfHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  rect(ctx, x - 14, y - 4, 28, 2, lin(ctx, 0, y - 4, 0, y - 2, [[0, WOOD[3]], [1, WOOD[0]]]));
  for (let i = 0; i < (p.cups ?? 3); i++) {
    const cx = x - 10 + i * 6;
    ctx.beginPath();
    ctx.roundRect(cx - 2, y - 8.5, 4, 4.5, [0, 0, 1.4, 1.4]);
    ctx.fillStyle = i % 2 ? lin(ctx, cx - 2, 0, cx + 2, 0, [[0, '#ffffff'], [1, '#aeb0bc']]) : lin(ctx, cx - 2, 0, cx + 2, 0, [[0, '#e0a040'], [1, '#7a4a18']]);
    ctx.fill();
    path(ctx, [cx + 2, y - 7.5, cx + 3, y - 6.8, cx + 2, y - 5.6], '#ece4cf', 0.4);
  }
}

export function drawBoxHd(ctx, p) {
  const x = p.x;
  const y = p.y;
  shadowOval(ctx, x, y, 8);
  rect(ctx, x - 6.5, y - 10.5, 13, 10.5, lin(ctx, x - 6, y - 10, x + 6, y, [[0, WOOD[4]], [0.4, WOOD[2]], [1, WOOD[0]]]));
  inside(ctx, () => {
    path(ctx, [x - 6.5, y - 10.5, x + 6.5, y], WOOD[0], 0.9);
    rect(ctx, x - 6.5, y - 10.5, 13, 0.9, WOOD[1]);
    rect(ctx, x - 6.5, y - 0.9, 13, 0.9, WOOD[0]);
  });
  poly(ctx, [x - 3, y - 12, x + 3, y - 12.4, x + 2, y - 10.4, x - 2.6, y - 10.6], '#ece4cf');
}

// ── закрытый проход: решётка из стираемых квадратов (рисуется каждый кадр) ──
export function drawGateHd(ctx, p, g) {
  if (!p.closed) return;
  const t = g.time || 0;
  for (let i = 0; i < p.w; i += 2) {
    for (let j = 0; j < p.h; j += 2) {
      const r = hashLite(i + Math.floor(t * 6), j, p.id);
      if (r > 0.5) {
        ctx.fillStyle = r > 0.88 ? '#ff5a7a' : r > 0.7 ? '#c8284a' : '#4a0c1e';
        ctx.fillRect(p.x + i, p.y + j, 1.5, 1.5);
      }
    }
  }
}

function hashLite(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
