// Персонажи «64 бита» — вариант на согласование (docs/GAME_RESEARCH.md 3.4). Та же фигура в
// логических пикселях, но детали мельче пикселя мира (0,25–0,5): при плотной сетке (?rs=4)
// они становятся видны — лицо, складки, руки, вещи в руках. У каждого свой силуэт и предмет:
// Мара — платок и каравай, Арно — широкополая шляпа и посох, Сена — шаль и фонарь.
// Включается флагом ?npc=64 (src/world/props.js); по умолчанию — прежние кадры.
import { poly, oval, path, rect, lin, rad } from './hd.js';

const INK = '#05060c';

function shadowOval(ctx, x, y, rx, a = 0.45) {
  oval(ctx, x, y - 0.4, rx, Math.max(1, rx * 0.3), `rgba(3,4,10,${a})`);
}

// ── Мара: хозяйка кухни с караваем ──────────────────────────────────────
export function drawMara64(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const br = Math.sin(t * 1.4) * 0.25; // дыхание
  shadowOval(ctx, x, y, 7);
  // юбка: широкая, со складками
  poly(ctx, [x - 3.4, y - 13, x + 3.4, y - 13, x + 6.6, y - 0.6, x + 3, y - 0.2, x - 3, y - 0.2, x - 6.6, y - 0.6], lin(ctx, x - 7, y - 13, x + 7, y, [[0, '#8a6244'], [0.45, '#5c3e28'], [1, '#2a1a10']]));
  for (const [a, b] of [[-3.6, -5.4], [-1, -1.6], [1.6, 2.4], [4, 5.4]]) path(ctx, [x + a * 0.55, y - 11.6, x + b, y - 0.8], 'rgba(20,10,6,0.55)', 0.35);
  path(ctx, [x - 6.4, y - 0.8, x + 6.4, y - 0.8], '#1c120c', 0.5);
  // фартук с карманом и завязками
  poly(ctx, [x - 2.8, y - 13.4, x + 2.8, y - 13.4, x + 3.8, y - 2.2, x - 3.8, y - 2.2], lin(ctx, x - 3, 0, x + 4, 0, [[0, '#fffaf0'], [0.55, '#ece4cf'], [1, '#a89a7e']]));
  path(ctx, [x - 0.6, y - 12.6, x - 1.2, y - 2.6], 'rgba(150,135,110,0.7)', 0.3);
  path(ctx, [x + 1.4, y - 12.4, x + 2.2, y - 2.6], 'rgba(150,135,110,0.7)', 0.3);
  rect(ctx, x - 1.6, y - 7.6, 3.2, 2, '#ddd2b8');
  path(ctx, [x - 1.6, y - 7.6, x + 1.6, y - 7.6], '#9c8e72', 0.3);
  path(ctx, [x - 3, y - 13.2, x - 4.6, y - 11.6], '#d8ccb0', 0.35);
  // лиф и шаль
  poly(ctx, [x - 3.6, y - 19.4 + br, x + 3.6, y - 19.4 + br, x + 3, y - 13, x - 3, y - 13], lin(ctx, x - 4, y - 19, x + 4, y - 13, [[0, '#6a3a4a'], [0.5, '#4a2434'], [1, '#2a1220']]));
  poly(ctx, [x - 4.2, y - 19.2 + br, x + 4.2, y - 19.2 + br, x + 1.2, y - 14.8, x - 1.2, y - 14.8], '#3a1a2a');
  for (let i = 0; i < 4; i++) rect(ctx, x - 3 + i * 2, y - 18.6 + br, 0.4, 0.4, '#c8a050');
  // руки держат каравай у пояса
  path(ctx, [x - 3.8, y - 18.4 + br, x - 4.6, y - 14.6, x - 2.6, y - 12.4], '#4a2434', 1.6);
  path(ctx, [x + 3.8, y - 18.4 + br, x + 4.6, y - 14.6, x + 2.6, y - 12.4], '#3a1a2a', 1.6);
  oval(ctx, x, y - 12, 3.4, 1.9, rad(ctx, x - 1, y - 13, 0.3, 3.8, [[0, '#ffd890'], [0.5, '#c88a3a'], [1, '#6a3a14']]));
  for (const dx of [-1.6, 0, 1.6]) path(ctx, [x + dx - 0.6, y - 12.8, x + dx + 0.6, y - 11.6], '#7a4818', 0.35);
  oval(ctx, x - 2.8, y - 12.2, 0.9, 0.8, '#d8b08c');
  oval(ctx, x + 2.8, y - 12.2, 0.9, 0.8, '#c49a76');
  // шея и голова
  rect(ctx, x - 0.9, y - 20.6 + br, 1.8, 1.6, '#b8906c');
  const hy = y - 23 + br;
  oval(ctx, x, hy, 2.9, 3.2, lin(ctx, x - 3, 0, x + 3, 0, [[0, '#f0d0ac'], [0.6, '#d6aa84'], [1, '#9a7454']]));
  // седые пряди из-под платка
  path(ctx, [x - 2.6, hy - 0.6, x - 2.9, hy + 1.4], '#c8c4c0', 0.5);
  path(ctx, [x + 2.6, hy - 0.6, x + 2.8, hy + 1.2], '#a8a4a0', 0.5);
  // лицо: брови, глаза, нос, румянец, рот
  const blink = Math.floor(t * 0.7) % 6 === 0 ? 0.15 : 0.55;
  path(ctx, [x - 1.8, hy - 0.9, x - 0.7, hy - 1.1], '#6a4a34', 0.3);
  path(ctx, [x + 0.7, hy - 1.1, x + 1.8, hy - 0.9], '#6a4a34', 0.3);
  rect(ctx, x - 1.5, hy - 0.4, 0.7, blink, INK);
  rect(ctx, x + 0.8, hy - 0.4, 0.7, blink, INK);
  path(ctx, [x + 0.1, hy - 0.1, x + 0.4, hy + 1, x - 0.1, hy + 1.1], '#a87a58', 0.3);
  oval(ctx, x - 1.6, hy + 1, 0.6, 0.35, 'rgba(220,110,100,0.45)');
  oval(ctx, x + 1.6, hy + 1, 0.6, 0.35, 'rgba(220,110,100,0.45)');
  path(ctx, [x - 0.7, hy + 1.8, x, hy + 2.05, x + 0.7, hy + 1.8], '#8a4a3a', 0.35);
  // малиновый платок с узором и узлом сзади
  poly(ctx, [x - 3.4, hy + 0.4, x - 3.2, hy - 2.6, x, hy - 4.2, x + 3.2, hy - 2.6, x + 3.4, hy + 0.4, x + 2.4, hy - 1.6, x - 2.4, hy - 1.6], lin(ctx, x - 4, hy - 4, x + 4, hy, [[0, '#ee6a84'], [0.5, '#a01c44'], [1, '#4a0c1e']]));
  for (const [dx, dy] of [[-1.6, -2.4], [0, -3.2], [1.6, -2.4], [-0.8, -1.8], [0.8, -1.8]]) rect(ctx, x + dx, hy + dy, 0.35, 0.35, '#ffd0d8');
  poly(ctx, [x + 2.8, hy - 1.4, x + 4.8, hy + 0.6, x + 3.8, hy + 2.4, x + 2.6, hy + 0.2], '#86163a');
  // контровой свет
  path(ctx, [x - 2.8, hy - 1.4, x - 3, hy + 0.4], 'rgba(255,240,220,0.55)', 0.3);
}

// ── призраки-воспоминания: свой силуэт и предмет у каждого ──────────────
// o.hat — Арно (широкополая шляпа, длинное пальто, посох); o.dress — Сена (шаль, фонарь).
export function drawGhost64(ctx, x, y, o = {}) {
  const t = o.t || 0;
  const C = o.color === '#ece4cf'
    ? { hi: '#ffffff', base: '#e2d8c0', mid: '#b4aa94', lo: '#6e6656', skin: '#fff6e6' }
    : o.color === '#ffd27a'
      ? { hi: '#fff4d0', base: '#e8b860', mid: '#b07a30', lo: '#4e2c10', skin: '#ffe6b8' }
      : { hi: '#ffe9b0', base: '#d89a48', mid: '#a8682a', lo: '#4a2810', skin: '#ffd9a0' };
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * (o.alpha ?? 0.8);
  const sway = Math.sin(t * 1.6) * 0.35;
  const fill = (x0, y0, x1, y1) => lin(ctx, x0, y0, x1, y1, [[0, C.hi], [0.35, C.base], [0.75, C.mid], [1, C.lo]]);
  if (o.dress) {
    // Сена: длинная юбка, шаль на плечах, в руке — фонарь
    poly(ctx, [x - 2.6, y - 12, x + 2.6, y - 12, x + 5.4, y - 0.6, x + 2, y - 0.2, x - 2, y - 0.2, x - 5.4, y - 0.6], fill(x - 5, y - 12, x + 5, y));
    for (const [a, b] of [[-1.2, -3], [1.2, 2.8]]) path(ctx, [x + a, y - 11, x + b, y - 1], C.lo, 0.35);
    const top = y - 19 + sway * 0.3;
    poly(ctx, [x - 3, top, x + 3, top, x + 2.6, y - 12, x - 2.6, y - 12], fill(x - 3, top, x + 3, y - 12));
    poly(ctx, [x - 4.2, top + 0.4, x + 4.2, top + 0.4, x + 3.4, top + 3.4, x, top + 6, x - 3.4, top + 3.4], C.lo);
    for (let i = -3; i <= 3; i += 1.5) path(ctx, [x + i, top + 3.6 - Math.abs(i) * 0.4, x + i * 0.9, top + 5.2 - Math.abs(i) * 0.6], C.mid, 0.35); // бахрома шали
    path(ctx, [x - 3.6, top + 1, x - 4.2, top + 5, x - 3.4, y - 11], C.base, 1.3);
    // фонарь в правой руке
    path(ctx, [x + 3.6, top + 1, x + 4.8, top + 5, x + 5.2, y - 10.6], C.mid, 1.3);
    path(ctx, [x + 5.2, y - 10.4, x + 5.2, y - 9.2], C.lo, 0.35);
    rect(ctx, x + 4.2, y - 9.2, 2, 2.6, C.lo);
    oval(ctx, x + 5.2, y - 7.9, 2.6, 2.6, 'rgba(255,190,90,0.28)'); // свет фонаря
    rect(ctx, x + 4.5, y - 8.9, 1.4, 2, rad(ctx, x + 5.2, y - 7.9, 0.2, 1.4, [[0, '#fffbe8'], [1, '#ffb040']]));
    const hy = top - 3.6 + sway * 0.2;
    rect(ctx, x - 0.7, top - 1.4, 1.4, 1.6, C.mid);
    oval(ctx, x, hy, 2.3, 2.6, lin(ctx, x - 2.4, 0, x + 2.4, 0, [[0, C.skin], [0.6, C.base], [1, C.mid]]));
    rect(ctx, x - 1.2, hy - 0.1, 0.5, 0.5, C.lo);
    rect(ctx, x + 0.7, hy - 0.1, 0.5, 0.5, C.lo);
    path(ctx, [x - 0.5, hy + 1.4, x + 0.5, hy + 1.4], C.lo, 0.3);
    // платок, концы которого спадают на плечо
    poly(ctx, [x - 2.7, hy + 0.6, x - 2.4, hy - 2.2, x, hy - 3.2, x + 2.4, hy - 2.2, x + 2.7, hy + 0.6, x + 1.8, hy - 1.2, x - 1.8, hy - 1.2], C.mid);
    poly(ctx, [x - 2.6, hy + 0.2, x - 3.8, hy + 3.6, x - 2.6, hy + 3.2], C.lo);
    path(ctx, [x - 2.2, hy - 1.4, x - 2.4, hy + 0.4], C.hi, 0.3);
  } else {
    // Арно: длинное пальто до колен, посох, широкополая шляпа
    poly(ctx, [x - 2.4, y - 8, x - 0.4, y - 8, x - 0.6, y - 1, x - 2.4, y - 1], fill(x - 3, y - 8, x, y));
    poly(ctx, [x + 0.4, y - 8, x + 2.4, y - 8, x + 2.4, y - 1, x + 0.6, y - 1], fill(x, y - 8, x + 3, y));
    oval(ctx, x - 1.7, y - 0.8, 1.6, 0.8, C.lo);
    oval(ctx, x + 1.7, y - 0.8, 1.6, 0.8, C.lo);
    const top = y - 19.4 + sway * 0.3;
    poly(ctx, [x - 3.8, top, x + 3.8, top, x + 4.4, y - 5.4, x + 0.6, y - 6.4, x - 0.6, y - 6.4, x - 4.4, y - 5.4], fill(x - 4, top, x + 4, y - 5));
    path(ctx, [x, top + 1.4, x, y - 6.6], C.lo, 0.4);
    for (let i = 0; i < 3; i++) oval(ctx, x + 0.9, top + 2.6 + i * 2.4, 0.35, 0.35, C.hi);
    rect(ctx, x - 3.8, top + 6.6, 7.6, 0.8, C.lo); // пояс
    // шарф
    poly(ctx, [x - 2.4, top - 0.4, x + 2.4, top - 0.4, x + 1.6, top + 1.4, x - 1.6, top + 1.4], C.mid);
    poly(ctx, [x + 1, top + 1, x + 2.4, top + 5, x + 1.4, top + 5.2], C.mid);
    // левая рука свободна, правая держит посох
    path(ctx, [x - 3.6, top + 1, x - 4.4, top + 5, x - 4, y - 9.4], C.base, 1.4);
    oval(ctx, x - 4, y - 9, 0.8, 0.9, C.skin);
    path(ctx, [x + 3.6, top + 1, x + 4.6, top + 4.6, x + 5.4, top + 6.4], C.mid, 1.4);
    oval(ctx, x + 5.6, top + 6.6, 0.8, 0.9, C.skin);
    path(ctx, [x + 6, top - 1.6, x + 6.6, y - 0.4], C.lo, 0.7);
    oval(ctx, x + 6, top - 1.8, 0.6, 0.6, C.mid);
    const hy = top - 3.6 + sway * 0.2;
    rect(ctx, x - 0.8, top - 1.4, 1.6, 1.6, C.mid);
    oval(ctx, x, hy, 2.4, 2.6, lin(ctx, x - 2.4, 0, x + 2.4, 0, [[0, C.skin], [0.6, C.base], [1, C.mid]]));
    rect(ctx, x - 1.2, hy, 0.5, 0.5, C.lo);
    rect(ctx, x + 0.7, hy, 0.5, 0.5, C.lo);
    path(ctx, [x - 1.2, hy + 1.6, x + 1.2, hy + 1.6], C.lo, 0.35); // усы
    // широкополая шляпа
    oval(ctx, x, hy - 1.8, 4.8, 0.9, C.lo);
    poly(ctx, [x - 2.4, hy - 1.8, x - 2, hy - 4.6, x + 2, hy - 4.6, x + 2.4, hy - 1.8], fill(x - 2, hy - 5, x + 2, hy - 2));
    rect(ctx, x - 2.3, hy - 2.6, 4.6, 0.6, C.mid);
    path(ctx, [x - 3.4, top + 1, x - 3.2, y - 7], C.hi, 0.3);
  }
  // память мерцает: строки развёртки и тающий низ
  const sh = Math.floor(t * 6) % 4;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < 28; j += 4) rect(ctx, x - 7, y - 28 + j + sh, 14, 0.4, 'rgba(0,0,0,0.3)');
  for (let i = 0; i < 6; i++) if ((i + Math.floor(t * 8)) % 2) rect(ctx, x - 5 + i * 2, y - 1.2, 1, 1.2, '#000');
  ctx.restore();
  ctx.globalAlpha = a0;
}
