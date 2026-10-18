// Персонажи и враги «64 бита» (вариант C, docs/GAME_RESEARCH.md 3.4). Каркас фигур и анимаций —
// как у 32-битных маляров (те же клетки атласа, хитбоксы и кадры), поверх — детали мельче
// пикселя мира (0,25–0,5): ткань, швы, бинты, лица, гравировка, блики. Видны при плотной
// сетке (RS = 4). Подписи как у 32-битных: (ctx, x, y, o).
import { poly, oval, path, rect, lin, rad } from './hd.js';
import { drawHollow32, drawFramer32, drawRinger32, drawEater32 } from './enemies32.js';
import { drawTik32, drawDog32, drawBrassBoy32, drawStillOne32, drawShadow32, drawMel32 } from './npcs32.js';
import { drawGhost64 } from './npcs64.js';

const INK = '#05060c';
const dots = (ctx, n, x0, y0, w, h, c, seed = 1, s = 0.3) => {
  for (let i = 0; i < n; i++) {
    const a = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
    const b = Math.sin((i + 1) * 78.233 * seed) * 12345.678;
    rect(ctx, x0 + (a - Math.floor(a)) * w, y0 + (b - Math.floor(b)) * h, s, s, c);
  }
};

// ── Пустокожий ─────────────────────────────────────────────────────────
export function drawHollow64(ctx, x, y, o) {
  drawHollow32(ctx, x, y, o);
  const past = o.phase === 'past';
  const cx = x + (o.windup ? -1 : 0);
  const t = o.t || 0;
  // бинты на ногах
  for (let i = 0; i < 4; i++) {
    path(ctx, [x - 2.6, y - 6.4 + i * 1.5, x - 1.1, y - 5.6 + i * 1.5], past ? '#6a5a48' : '#3c3c4a', 0.3);
    path(ctx, [x + 1.1, y - 6 + i * 1.5, x + 2.6, y - 5.2 + i * 1.5], past ? '#6a5a48' : '#3c3c4a', 0.3);
  }
  // ткань: редкое переплетение, заплата со стежками, верёвочный пояс
  dots(ctx, 14, cx - 4, y - 15, 8, 9, past ? 'rgba(40,20,8,0.6)' : 'rgba(10,10,18,0.6)', 3);
  rect(ctx, cx - 3.4, y - 12.4, 2.2, 2.2, past ? '#6a4422' : '#4a4b58');
  for (let i = 0; i < 4; i++) rect(ctx, cx - 3.5 + i * 0.6, y - 12.6, 0.25, 0.4, past ? '#e0b070' : '#8a8c9c');
  path(ctx, [cx - 4.6, y - 10, cx + 4.6, y - 9.6], past ? '#9a8058' : '#4c4858', 0.5);
  oval(ctx, cx + 1.4, y - 9.6, 0.6, 0.5, past ? '#b89868' : '#5c5868');
  path(ctx, [cx + 1.4, y - 9.2, cx + 1.8, y - 7.4], past ? '#9a8058' : '#4c4858', 0.3);
  // рваные нитки у подола
  for (let i = 0; i < 6; i++) {
    const hx = cx - 4.4 + i * 1.8;
    path(ctx, [hx, y - 4.4 + (i % 2), hx + 0.2, y - 3.2 + (i % 2) + Math.sin(t * 6 + i) * 0.3], past ? '#5a3618' : '#2a2b36', 0.25);
  }
  // капюшон: шов и контровой блик
  const hy = y - 18.6;
  path(ctx, [cx + 0.6, hy - 5.6, cx + 0.2, hy - 2.6], past ? '#5a3618' : '#22232e', 0.3);
  path(ctx, [cx - 3.2, hy - 1.2, cx - 3.4, hy + 1.6], past ? 'rgba(255,220,170,0.5)' : 'rgba(190,195,215,0.5)', 0.3);
  if (past) {
    // лицо Отпечатка: брови, нос, губы
    path(ctx, [cx - 1.5, hy - 0.3, cx - 0.5, hy - 0.4], '#6a4a34', 0.25);
    path(ctx, [cx + 0.5, hy - 0.4, cx + 1.5, hy - 0.3], '#6a4a34', 0.25);
    rect(ctx, cx - 1.1, hy + 0.3, 0.3, 0.3, '#ffffff');
    path(ctx, [cx + 0.1, hy + 0.6, cx + 0.3, hy + 1.4], '#9a7658', 0.25);
    // шарф с полосками
    for (let i = 0; i < 4; i++) rect(ctx, cx - 3.6 + i * 2, y - 14.4, 0.8, 1.4, '#c8842a');
  } else {
    // провал лица: трещины Стирания и ореол огней
    // трещины расходятся от края провала, а не через глаза
    for (const [sx, sy, dx, dy] of [[-2.3, 1.6, -0.9, 1.2], [2.3, 1.6, 0.9, 1.1], [0.4, 3.4, 0.2, 1]]) path(ctx, [cx + sx, hy + sy, cx + sx + dx, hy + sy + dy], 'rgba(200,40,74,0.6)', 0.22);
    oval(ctx, cx - 1, hy + 0.5, 1.1, 0.7, 'rgba(255,90,122,0.3)');
    oval(ctx, cx + 1, hy + 0.5, 1.1, 0.7, 'rgba(255,90,122,0.3)');
    // кости плеч проступают сквозь ткань
    path(ctx, [cx - 3, y - 15.2, cx - 1, y - 14.6], 'rgba(200,204,220,0.45)', 0.3);
    path(ctx, [cx + 1, y - 14.6, cx + 3, y - 15.2], 'rgba(200,204,220,0.45)', 0.3);
  }
  // суставы когтей
  for (const s of [-1, 1]) {
    const ax = cx + s * (4.6 + (o.lunge ? 4 : 0));
    oval(ctx, ax + s * 0.4, y - 5.6, 0.45, 0.45, past ? '#e8c8a4' : '#c8cad8');
  }
}

// ── Кадровик ───────────────────────────────────────────────────────────
export function drawFramer64(ctx, x, y, o) {
  drawFramer32(ctx, x, y, o);
  const past = o.phase === 'past';
  const look = o.look || 0;
  const hx = x;
  const hy = y - 26;
  // накидка на плечах — второй слой плаща
  poly(ctx, [x - 4.6, y - 21, x + 4.6, y - 21, x + 5.6, y - 17.4, x, y - 16.4, x - 5.6, y - 17.4], past ? '#6a4e34' : '#2e2622');
  path(ctx, [x - 5.4, y - 17.6, x + 5.4, y - 17.6], past ? '#b08a3a' : '#5a4a44', 0.3);
  // резные уголки рамы и блик на стекле
  for (const [dx, dy] of [[-4.4, -5.4], [3.6, -5.4], [-4.4, 3.6], [3.6, 3.6]]) rect(ctx, hx + dx, hy + dy, 0.8, 0.8, past ? '#fff4c0' : '#e8e2d4');
  path(ctx, [hx - 2.6, hy - 3.6, hx - 1, hy - 2], 'rgba(255,255,255,0.25)', 0.35);
  // зрачки
  rect(ctx, hx - 1.7 + look * 0.5, hy - 0.8, 0.45, 0.6, INK);
  rect(ctx, hx + 1.3 + look * 0.5, hy - 0.8, 0.45, 0.6, INK);
  // фонарь: прутья клетки, посох обмотан
  const sx = x + 6.5;
  for (const dx of [-0.6, 0.5, 1.6]) path(ctx, [sx + dx, y - 32.4, sx + dx * 0.9, y - 28.6], '#0d0e14', 0.25);
  for (let i = 0; i < 4; i++) path(ctx, [sx - 0.4, y - 12 - i * 2.6, sx + 0.9, y - 11.2 - i * 2.6], past ? '#b08a3a' : '#4a3a30', 0.3);
  // складки плаща
  for (const dx of [-4.4, 0.6, 4.4]) path(ctx, [x + dx * 0.7, y - 16, x + dx, y - 5], 'rgba(0,0,0,0.35)', 0.25);
}

// ── Звонарь ────────────────────────────────────────────────────────────
export function drawRinger64(ctx, x, y, o) {
  drawRinger32(ctx, x, y, o);
  const past = o.phase === 'past';
  const t = o.t || 0;
  // вышивка по подолу и верёвочный пояс с кистью
  for (let i = 0; i < 9; i++) {
    const hx = x - 6.8 + i * 1.7;
    path(ctx, [hx, y - 4.6, hx + 0.85, y - 5.4, hx + 1.7, y - 4.6], past ? '#e8a040' : '#c8284a', 0.25);
  }
  path(ctx, [x - 3.4, y - 13, x + 3.4, y - 12.6], past ? '#a07840' : '#4a3a48', 0.5);
  path(ctx, [x - 1, y - 12.8, x - 1.4, y - 9.6], past ? '#a07840' : '#4a3a48', 0.35);
  oval(ctx, x - 1.4, y - 9.4, 0.5, 0.6, past ? '#d8a860' : '#86163a');
  // глубина капюшона и кромка
  const hy = y - 21;
  path(ctx, [x - 3.4, hy + 1.6, x - 2.6, hy - 2.4, x, hy - 3.6], past ? 'rgba(255,250,240,0.6)' : 'rgba(170,175,195,0.5)', 0.3);
  // колокол: гравировка, блик, язык
  const bx = x + (o.charge ? Math.sin(t * 40) * 1.2 : 0);
  for (let i = 0; i < 3; i++) path(ctx, [bx - 2.6 - i * 0.3, y - 11.2 + i * 1.3, bx + 2.6 + i * 0.3, y - 11.2 + i * 1.3], 'rgba(60,40,10,0.6)', 0.22);
  path(ctx, [bx - 1, y - 12, bx - 1.6, y - 8], 'rgba(255,250,220,0.7)', 0.3);
  // пальцы на ручке колокола
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) rect(ctx, x + s * 4.4 - 0.5 + i * 0.4, y - 9.4, 0.25, 0.6, past ? '#e8d4b4' : '#9fa2b2');
}

// ── Пожиратель Сцен ────────────────────────────────────────────────────
export function drawEater64(ctx, x, y, o) {
  drawEater32(ctx, x, y, o);
  const past = o.phase === 'past';
  const chew = o.windup ? 4 : (Math.sin((o.t || 0) * 5) + 1) * 1.5;
  // пластины горба с бликом
  for (let i = 0; i < 4; i++) {
    const px = x - 6 + i * 4;
    path(ctx, [px - 1.6, y - 19 + Math.abs(i - 1.5) * 0.8, px, y - 20.4 + Math.abs(i - 1.5) * 0.8, px + 1.6, y - 19 + Math.abs(i - 1.5) * 0.8], past ? 'rgba(255,240,200,0.6)' : 'rgba(140,150,180,0.5)', 0.3);
  }
  // зубы с тенью, язык
  if (!past) {
    for (let i = 0; i < 6; i++) path(ctx, [x - 5 + i * 2.2, y - 13.4, x - 5.1 + i * 2.2, y - 11.8], 'rgba(120,110,100,0.6)', 0.22);
    oval(ctx, x - 0.6, y - 10.4 + chew / 2, 1, 0.45, '#ff7a96');
  }
  // блики глаз и суставы ног
  rect(ctx, x - 3.6, y - 18, 0.4, 0.4, '#ffffff');
  rect(ctx, x + 2.8, y - 18, 0.4, 0.4, '#ffffff');
  for (const s of [-1, 1]) oval(ctx, x + s * 9, y - 4, 0.6, 0.6, past ? '#7a4a18' : '#2c3042');
}

// ── Тик ────────────────────────────────────────────────────────────────
export function drawTik64(ctx, x, y, o = {}) {
  drawTik32(ctx, x, y, o);
  const b = Math.sin((o.t || 0) * 3) * 0.6;
  // заклёпки по краю маски, шестерёнка на щеке
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
    rect(ctx, x + Math.cos(a + Math.PI) * 4.4 - 0.2, y - 13.5 + b + Math.sin(a + Math.PI) * 3.8 - 0.2, 0.4, 0.4, '#fff0b8');
  }
  oval(ctx, x + 3, y - 12 + b, 0.9, 0.9, '#8a6424');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    rect(ctx, x + 3 + Math.cos(a) * 1.05 - 0.15, y - 12 + b + Math.sin(a) * 1.05 - 0.15, 0.3, 0.3, '#e6c06a');
  }
  rect(ctx, x + 1.6, y - 14 + b, 0.35, 0.35, '#ffffff');
  // воротник и стежки пальтишка
  poly(ctx, [x - 3.4, y - 10.5, x, y - 9, x + 3.4, y - 10.5, x + 2.4, y - 8.6, x, y - 8, x - 2.4, y - 8.6], '#7a5a3c');
  for (let i = 0; i < 4; i++) rect(ctx, x - 3.8 + i * 0.2, y - 7.4 + i * 1.2, 0.25, 0.5, '#a8845a');
  // ушко заводного ключа
  oval(ctx, x + 7, y - 13 + b, 0.45, 0.8, '#5a4014');
}

// ── пёс ────────────────────────────────────────────────────────────────
export function drawDog64(ctx, x, y, o = {}) {
  drawDog32(ctx, x, y, o);
  const C = o.past ? ['#ffe4a0', '#c8842a', '#7a4a18'] : ['#e4e6ee', '#8a8d9c', '#3a3c48'];
  // шерсть прядями
  for (let i = 0; i < 7; i++) path(ctx, [x - 5 + i * 1.6, y - 8.4 + (i % 2) * 0.4, x - 5.4 + i * 1.6, y - 6.8], C[i % 2 ? 2 : 0], 0.22);
  // ошейник с медным жетоном
  path(ctx, [x + 3.6, y - 10.2, x + 4.6, y - 7.2], '#6a2a1a', 0.7);
  oval(ctx, x + 4.6, y - 6.8, 0.6, 0.6, '#e6c06a');
  // ухо изнутри, блик глаза и носа, подушечки лап
  poly(ctx, [x + 4.4, y - 10.8, x + 4.8, y - 12.6, x + 5.6, y - 11], 'rgba(200,120,110,0.5)');
  rect(ctx, x + 6.7, y - 10, 0.3, 0.3, '#ffffff');
  rect(ctx, x + 9.4, y - 9.1, 0.3, 0.25, '#9aa0b0');
  for (const lx of [-5.5, -3.5, 2.5, 4.4]) rect(ctx, x + lx, y - 0.5, 1.3, 0.4, C[2]);
}

// ── Латунный Мальчик ───────────────────────────────────────────────────
export function drawBrassBoy64(ctx, x, y, o = {}) {
  drawBrassBoy32(ctx, x, y, o);
  const past = o.phase === 'past';
  // табличка на постаменте и фактура камня
  rect(ctx, x - 4, y - 6.4, 8, 3, '#2a2e3c');
  for (let i = 0; i < 3; i++) path(ctx, [x - 3.2, y - 5.6 + i * 0.8, x + 3.2 - i * 0.8, y - 5.6 + i * 0.8], '#8a93ae', 0.2);
  dots(ctx, 10, x - 10, y - 8, 20, 7, 'rgba(10,12,20,0.5)', 5);
  if (!past) {
    for (const [a, b] of [[-2, -14], [1.6, -11]]) path(ctx, [x + a, y + b, x + a + 0.6, y + b + 2.4], '#3a2810', 0.25);
    return;
  }
  const b = Math.sin((o.t || 0) * 2) * 0.5;
  // козырёк кепки, пуговицы, блики глаз, строчка на куртке
  path(ctx, [x + 2, y - 32.6 + b, x + 5.6, y - 32.8 + b], '#fff0b8', 0.25);
  for (let i = 0; i < 3; i++) rect(ctx, x - 0.2, y - 26 + b + i * 2.2, 0.4, 0.4, '#fff8e0');
  rect(ctx, x - 1.4, y - 31 + b, 0.3, 0.3, '#fff8e0');
  rect(ctx, x + 1.1, y - 31 + b, 0.3, 0.3, '#fff8e0');
  path(ctx, [x - 4, y - 21 + b, x + 4, y - 21 + b], 'rgba(60,40,10,0.6)', 0.22);
}

// ── жители-воспоминания (площадь) ──────────────────────────────────────
export function drawVillager64(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const v = o.v ?? 0;
  drawGhost64(ctx, x, y, { t, hat: v === 0, dress: v === 1 || v === 3, color: v === 1 ? '#ffd27a' : undefined, alpha: 0.85 });
  if (v === 3) {
    rect(ctx, x - 7.4, y - 12, 5, 3.6, lin(ctx, 0, y - 12, 0, y - 8, [[0, '#9a7450'], [1, '#3a281a']]));
    for (let i = 0; i < 4; i++) path(ctx, [x - 7.2 + i * 1.3, y - 12, x - 7.2 + i * 1.3, y - 8.4], '#5a3f28', 0.22);
    path(ctx, [x - 7, y - 12, x - 4.9, y - 14.6, x - 2.8, y - 12], '#77553a', 0.5);
    oval(ctx, x - 5, y - 12.4, 1.2, 0.6, '#c88a3a'); // хлеб в корзине
  }
}

// ── силуэт спиной (Шрам) ───────────────────────────────────────────────
export function drawStillOne64(ctx, x, y, o = {}) {
  drawStillOne32(ctx, x, y, o);
  for (const dx of [-2.6, 0, 2.6]) path(ctx, [x + dx * 0.8, y - 17, x + dx, y - 7], 'rgba(0,0,0,0.5)', 0.25);
  for (let i = 0; i < 4; i++) path(ctx, [x - 1.6 + i, y - 23.6, x - 1.8 + i * 1.1, y - 21.4], '#2a2236', 0.22);
  path(ctx, [x - 3, y - 22.4, x - 3.2, y - 19.8], 'rgba(200,40,74,0.6)', 0.25);
}

// ── Звонкая Тень ───────────────────────────────────────────────────────
export function drawShadow64(ctx, x, y, o) {
  drawShadow32(ctx, x, y, o);
  if (o.layer === 'front') return;
  const past = o.phase === 'past';
  const t = o.t || 0;
  // рёбра шлейфа как у колокола и пустые глазницы
  for (let i = 0; i < 5; i++) {
    const k = (i + 1) / 6;
    const w = 3 + k * 5;
    path(ctx, [x - w, y - 34 + k * 31, x, y - 33 + k * 31 + 0.6, x + w, y - 34 + k * 31], past ? 'rgba(160,175,215,0.35)' : 'rgba(80,76,96,0.45)', 0.25);
  }
  oval(ctx, x - 0.9, y - 31, 0.5, 0.8, past ? 'rgba(122,74,24,0.6)' : 'rgba(80,82,96,0.7)');
  oval(ctx, x + 0.9, y - 31, 0.5, 0.8, past ? 'rgba(122,74,24,0.6)' : 'rgba(80,82,96,0.7)');
  // колокольчики: язычок и блик
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = t * (past ? 1 : 2.4) + (i / n) * Math.PI * 2;
    if (Math.sin(a) > 0) continue;
    const bx = x + Math.cos(a) * 13;
    const by = y - 18 + Math.sin(a) * 5;
    path(ctx, [bx - 0.6, by - 1.6, bx - 1, by + 0.8], 'rgba(255,255,240,0.6)', 0.25);
  }
}

// ── Брат Мел ───────────────────────────────────────────────────────────
export function drawMel64(ctx, x, y, o) {
  drawMel32(ctx, x, y, o);
  const t = o.t || 0;
  const v = o.version;
  const yy = y - 4 + Math.sin(t * 1.6) * 1.5;
  // вышитые полосы по подолу и кромка капюшона
  for (let i = 0; i < 14; i++) {
    const hx = x - 19 + i * 2.8;
    const red = v === 'scar' || (!v && hx > x);
    path(ctx, [hx, yy - 10.6, hx + 1.4, yy - 12, hx + 2.8, yy - 10.6], red ? 'rgba(255,90,122,0.7)' : 'rgba(255,230,160,0.7)', 0.3);
  }
  path(ctx, [x - 7.5, yy - 50, x - 2, yy - 66, x + 2, yy - 66, x + 7.5, yy - 50], v === 'scar' ? '#ff7a96' : '#e6c06a', 0.35);
  // звенья цепи с бликом
  for (let i = 0; i < 8; i++) {
    const cx = x - 13 + i * 2.2;
    const cy = yy - 41 + i * 3;
    oval(ctx, cx, cy, 0.5, 0.3, '#5a4014');
    rect(ctx, cx - 0.6, cy - 0.5, 0.3, 0.3, '#fff0b8');
  }
  // во тьме капюшона — отсвет двух огней
  oval(ctx, x - 1.6, yy - 57, 0.6, 0.4, 'rgba(255,200,120,0.35)');
  oval(ctx, x + 1.6, yy - 57, 0.6, 0.4, 'rgba(255,90,122,0.35)');
}
