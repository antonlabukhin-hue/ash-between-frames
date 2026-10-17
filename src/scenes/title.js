// Титульная сцена: слева — янтарное прошлое, в центре — луна и колокольня на нитях,
// справа — малиновое Стирание, рассыпающееся на пиксели. Рен смотрит на это со спины.
import { W, H } from '../core/renderer.js';
import { P } from '../art/palette.js';
import { drawHero, px, line, ring } from '../art/sprites.js';
import { mulberry32, hash2, clamp } from '../core/math.js';

let bg = null;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// Небо: три палитры по горизонтали, дизеринг Байера.
function sky(ctx) {
  const img = ctx.createImageData(W, H);
  const left = ['#f2c76e', '#d99a3e', '#8a5a2a', '#3b2a22'].map(hex);
  const mid = ['#9aa0b4', '#5d6378', '#2c3042', '#151827'].map(hex);
  const right = ['#ff6a6a', '#c8284a', '#6a0f2a', '#1a0610'].map(hex);
  for (let y = 0; y < H; y++) {
    const ty = clamp(y / 150, 0, 1);
    for (let x = 0; x < W; x++) {
      const tx = x / W;
      const b = BAYER[(y & 3) * 4 + (x & 3)] / 16;
      const pal = tx < 0.38 ? left : tx > 0.66 ? right : mid;
      const blendL = clamp((0.38 - tx) / 0.06 + 0.5, 0, 1);
      const blendR = clamp((tx - 0.66) / 0.06 + 0.5, 0, 1);
      let p = pal;
      if (tx >= 0.32 && tx < 0.44) p = b < blendL ? left : mid;
      if (tx >= 0.6 && tx < 0.72) p = b < blendR ? right : mid;
      const f = ty * 3;
      const i0 = Math.floor(f);
      const i1 = Math.min(3, i0 + 1);
      const c = f - i0 > b ? p[i1] : p[i0];
      const o = (y * W + x) * 4;
      img.data[o] = c[0];
      img.data[o + 1] = c[1];
      img.data[o + 2] = c[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function clouds(ctx, rnd) {
  for (let i = 0; i < 26; i++) {
    const x = rnd() * W;
    const y = 8 + rnd() * 60;
    const w = 20 + rnd() * 50;
    const c = x < W * 0.38 ? 'rgba(255,220,150,0.35)' : x > W * 0.66 ? 'rgba(80,10,30,0.45)' : 'rgba(40,44,62,0.55)';
    ctx.fillStyle = c;
    for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(x + k * 4 - w / 2), Math.round(y + Math.sin(k) * 2), Math.round(w - k * 6), 3);
  }
}

function moon(ctx) {
  const cx = 196;
  const cy = 46;
  const r = 30;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const shade = hash2(x >> 2, y >> 2, 3);
      ctx.fillStyle = shade > 0.8 ? '#bfc2cc' : shade > 0.65 ? '#d6d8de' : '#eceef2';
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

function eclipse(ctx) {
  const cx = 334;
  const cy = 44;
  for (let a = 0; a < 360; a += 1.5) {
    const rr = a / 57.3;
    px(ctx, cx + Math.cos(rr) * 17, cy + Math.sin(rr) * 17, 1, 1, '#ff3a5a');
  }
  for (let y = -16; y <= 16; y++) {
    const w = Math.sqrt(256 - y * y);
    ctx.fillStyle = '#1a0610';
    ctx.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

function spire(ctx, x, base, w, h, c, cap) {
  ctx.fillStyle = c;
  ctx.fillRect(x, base - h, w, h);
  const n = Math.ceil(w / 2) + 1;
  for (let i = 0; i < n; i++) {
    const ww = Math.max(1, w - (n - 1 - i) * 2);
    ctx.fillRect(Math.round(x + (w - ww) / 2), Math.round(base - h - (n - i) * 2), ww, 2);
  }
  if (cap) px(ctx, x + Math.floor(w / 2), base - h - n * 2 - 3, 1, 3, cap);
}

function leftCastle(ctx, rnd) {
  // скалы с водопадами
  ctx.fillStyle = '#6e4a2a';
  for (let x = 0; x < 140; x++) {
    const top = 96 + Math.sin(x / 9) * 5 + (x > 100 ? (x - 100) * 0.5 : 0);
    ctx.fillRect(x, top, 1, H - top);
  }
  ctx.fillStyle = '#8f6a3c';
  for (let x = 0; x < 140; x += 3) ctx.fillRect(x, 97 + Math.sin(x / 9) * 5, 2, 2);
  for (const wx of [18, 46, 92]) {
    for (let y = 100; y < 170; y++) px(ctx, wx + (y % 3 === 0 ? 1 : 0), y, 2, 1, y % 5 ? '#e8e2d0' : '#b9c2d0');
  }
  // замок
  const c1 = '#d8b070';
  const c2 = '#a87a44';
  ctx.fillStyle = c2;
  ctx.fillRect(18, 70, 90, 28);
  ctx.fillStyle = c1;
  for (let i = 0; i < 12; i++) ctx.fillRect(20 + i * 7, 66 + (i % 3) * 2, 5, 8);
  spire(ctx, 50, 72, 8, 34, c1, '#fff2c0');
  spire(ctx, 34, 74, 6, 20, c2);
  spire(ctx, 72, 74, 6, 24, c1);
  spire(ctx, 92, 76, 5, 16, c2);
  spire(ctx, 120, 92, 5, 26, '#7a5a3a');
  // арки акведука
  ctx.fillStyle = '#9a7048';
  ctx.fillRect(96, 86, 44, 4);
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(98 + i * 9, 90, 3, 12);
  }
  // осенние деревья
  for (let i = 0; i < 40; i++) {
    const x = rnd() * 130;
    const y = 96 + rnd() * 40;
    ctx.fillStyle = rnd() > 0.5 ? '#d89a34' : '#a86a1c';
    ctx.fillRect(Math.round(x), Math.round(y), 4, 3);
  }
}

function centerTower(ctx, t) {
  // нити
  ctx.fillStyle = P.void;
  for (const x of [176, 190, 214, 226]) for (let y = 0; y < 70; y++) if ((y + x) % 3) ctx.fillRect(x + Math.round(Math.sin(y / 9) * 2), y, 1, 1);
  // остров
  const bob = Math.round(Math.sin(t * 0.8) * 2);
  ctx.fillStyle = '#2a2e3e';
  for (let i = 0; i < 26; i++) ctx.fillRect(170 + i, 112 + bob, 64 - i * 2 > 0 ? 64 - i * 2 : 1, 1);
  for (let y = 0; y < 34; y++) {
    const w = Math.max(2, 60 - y * 1.8);
    ctx.fillRect(Math.round(202 - w / 2), 112 + y + bob, Math.round(w), 1);
  }
  // башня
  ctx.fillStyle = '#3a3e52';
  ctx.fillRect(186, 58 + bob, 32, 56);
  ctx.fillStyle = '#4a4f66';
  ctx.fillRect(188, 58 + bob, 4, 56);
  ctx.fillStyle = '#2a2e3e';
  ctx.fillRect(194, 66 + bob, 16, 30);
  spire(ctx, 196, 60 + bob, 12, 10, '#3a3e52', '#aeb0bc');
  spire(ctx, 184, 62 + bob, 5, 8, '#3a3e52');
  spire(ctx, 215, 62 + bob, 5, 8, '#3a3e52');
  // колокол
  ctx.fillStyle = P.brass;
  for (let i = 0; i < 14; i++) {
    const w = 6 + Math.floor((i / 14) ** 1.6 * 10);
    ctx.fillRect(202 - w / 2, 72 + i + bob, w, 1);
  }
  ctx.fillStyle = P.brassHi;
  ctx.fillRect(194, 86 + bob, 16, 1);
  // кольцо-орбита
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const x = 202 + Math.cos(a + t * 0.1) * 58;
    const y = 82 + bob + Math.sin(a + t * 0.1) * 12;
    if (Math.sin(a + t * 0.1) < 0 || Math.abs(x - 202) > 18) px(ctx, x, y, 2, 1, '#5d6378');
  }
  // капли-водопад
  for (let y = 146; y < 180; y += 2) px(ctx, 201, y + bob + ((t * 30) % 2), 1, 1, '#b9c2d0');
}

function floatingIslands(ctx, t) {
  const isl = [[140, 70, 14], [158, 100, 8], [252, 92, 12], [270, 64, 9], [244, 128, 7], [150, 140, 10]];
  isl.forEach(([x, y, s], i) => {
    const b = Math.round(Math.sin(t * 0.9 + i) * 1.5);
    const right = x > 230;
    ctx.fillStyle = right ? '#3a1420' : '#33374a';
    ctx.fillRect(x - s, y + b, s * 2, 3);
    for (let k = 0; k < s; k++) ctx.fillRect(x - s + k, y + 3 + k + b, (s - k) * 2, 1);
    if (s > 9) {
      ctx.fillStyle = right ? '#5a1a2a' : '#4a4f66';
      ctx.fillRect(x - 3, y - 10 + b, 6, 10);
      spire(ctx, x - 3, y - 10 + b, 6, 4, right ? '#5a1a2a' : '#4a4f66');
    }
  });
}

function rightRuins(ctx, rnd) {
  ctx.fillStyle = '#1a0610';
  for (let x = 250; x < W; x++) {
    const top = 100 + Math.sin(x / 7) * 4 - (x > 340 ? (x - 340) * 0.8 : 0);
    ctx.fillRect(x, top, 1, H - top);
  }
  ctx.fillStyle = '#2a0812';
  spire(ctx, 300, 104, 10, 46, '#2a0812');
  spire(ctx, 352, 98, 14, 70, '#2a0812');
  ctx.fillRect(330, 60, 40, 44);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#4a0c1e';
    ctx.fillRect(338 + i * 10, 70, 5, 18);
  }
  // арки
  ctx.fillStyle = '#2a0812';
  ctx.fillRect(262, 100, 40, 4);
  for (let i = 0; i < 4; i++) ctx.fillRect(264 + i * 11, 104, 3, 14);
  // раскалённые щели
  for (let i = 0; i < 60; i++) {
    const x = 250 + rnd() * 134;
    const y = 120 + rnd() * 60;
    px(ctx, x, y, 2, 1, rnd() > 0.5 ? '#ff3a5a' : '#c8284a');
  }
  // мёртвое дерево
  ctx.fillStyle = '#0a0306';
  ctx.fillRect(352, 118, 3, 40);
  line(ctx, 353, 128, 340, 112, '#0a0306', 2);
  line(ctx, 353, 124, 368, 108, '#0a0306', 2);
  line(ctx, 344, 116, 338, 104, '#0a0306');
}

function foreground(ctx, rnd) {
  // каменная дорога
  for (let y = 160; y < H; y++) {
    const w = 120 + (y - 160) * 4;
    for (let x = 192 - w / 2; x < 192 + w / 2; x += 1) {
      const r = hash2(x >> 3, y >> 2, 5);
      ctx.fillStyle = (x >> 3) % 2 === (y >> 2) % 2 ? (r > 0.5 ? '#2c2f3d' : '#24263a') : '#1d1f2a';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // лужи с отражением неба
  ctx.fillStyle = 'rgba(224,160,64,0.35)';
  ctx.fillRect(150, 190, 30, 2);
  ctx.fillStyle = 'rgba(200,40,74,0.3)';
  ctx.fillRect(230, 200, 26, 2);
  // парапет слева
  ctx.fillStyle = '#2c2f3d';
  ctx.fillRect(0, 160, 120, 10);
  ctx.fillStyle = '#3d4152';
  ctx.fillRect(0, 160, 120, 2);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#2c2f3d';
    ctx.fillRect(4 + i * 20, 150, 8, 12);
    ctx.fillStyle = '#3d4152';
    ctx.fillRect(4 + i * 20, 148, 8, 2);
  }
  // справа — обломки
  ctx.fillStyle = '#1d1f2a';
  ctx.fillRect(300, 176, 26, 30);
  ctx.fillStyle = '#2c2f3d';
  ctx.fillRect(300, 176, 26, 3);
  for (let i = 0; i < 30; i++) px(ctx, 270 + rnd() * 110, 190 + rnd() * 26, 2, 2, rnd() > 0.5 ? '#c8284a' : '#3a0812');
  // листья
  for (let i = 0; i < 40; i++) px(ctx, rnd() * 110, 175 + rnd() * 40, 2, 2, rnd() > 0.5 ? '#d89a34' : '#7a4a18');
}

function buildBackground() {
  bg = document.createElement('canvas');
  bg.width = W;
  bg.height = H;
  const ctx = bg.getContext('2d');
  const rnd = mulberry32(42);
  sky(ctx);
  clouds(ctx, rnd);
  moon(ctx);
  eclipse(ctx);
  leftCastle(ctx, rnd);
  rightRuins(ctx, rnd);
  foreground(ctx, rnd);
}

// Знамёна и герой рисуются поверх, с анимацией.
function banner(ctx, x, y, t) {
  px(ctx, x, y - 50, 2, 52, '#1a1a22');
  for (let i = 0; i < 30; i++) {
    const w = Math.round(Math.sin(t * 2.5 + i * 0.25) * (i / 10));
    px(ctx, x + 2 + w, y - 48 + i, 14, 1, '#24365a');
  }
  for (let i = 0; i < 14; i += 2) px(ctx, x + 2 + i + Math.round(Math.sin(t * 2.5 + 7)), y - 18 + (i % 3), 1, 3, '#24365a');
  ring(ctx, x + 9, y - 36, 4, '#e0a040');
  px(ctx, x + 9, y - 42, 1, 12, '#e0a040');
  px(ctx, x + 3, y - 36, 12, 1, '#e0a040');
}

let heroBuf = null;
export function drawTitle(ctx, t) {
  if (!bg) buildBackground();
  ctx.drawImage(bg, 0, 0);
  floatingIslands(ctx, t);
  centerTower(ctx, t);
  // пиксели, отрывающиеся от правой половины
  for (let i = 0; i < 70; i++) {
    const r = hash2(i, 7, 9);
    const life = (t * (0.08 + r * 0.12) + r) % 1;
    const x = 240 + r * 140 - life * 60 * hash2(i, 3, 1);
    const y = 150 - life * 150 * (0.4 + hash2(i, 5, 2));
    const s = r > 0.7 ? 3 : 2;
    px(ctx, x, y, s, s, r > 0.5 ? '#1a0610' : '#5a0f22');
  }
  banner(ctx, 90, 168, t);
  banner(ctx, 126, 170, t + 1);
  // Рен со спины, вдвое крупнее
  if (!heroBuf) {
    heroBuf = document.createElement('canvas');
    heroBuf.width = 40;
    heroBuf.height = 40;
  }
  const hc = heroBuf.getContext('2d');
  hc.clearRect(0, 0, 40, 40);
  drawHero(hc, 20, 36, { dir: 'up', t, sway: Math.sin(t * 1.2) * 2.5, charges: 3, moving: false, aim: Math.PI / 2 + 0.6 });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(heroBuf, 0, 0, 40, 40, 192 - 40, 132, 80, 80);
  // пепел
  for (let i = 0; i < 40; i++) {
    const r = hash2(i, 1, 4);
    const x = (r * W + t * (6 + r * 10)) % W;
    const y = (hash2(i, 2, 4) * H + t * (8 + r * 6)) % H;
    px(ctx, x, y, 1, 1, r > 0.6 ? '#aeb0bc' : '#7e8193');
  }
}
