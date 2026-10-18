// Ключевой арт титула: один вид в двух версиях — прошлое (Отпечаток) и настоящее (Шрам).
// Версии сменяют друг друга через сбой кадра — так титул сразу показывает главную механику.
// Поверх картинки — живые слои кода: дождь, мерцание фонарей прошлого, малиновые сбои
// Стирания, туман, лёгкий наезд камеры. Картинки — public/art/title/{past,present}.webp;
// пока не загрузились (или их нет) — рисуется прежний кодовый титул.
import { rainDrop, glow, fogTexture, FOG_W, FOG_H, vignette } from '../art/glow.js';
import { hash2 } from '../core/math.js';

const art = { past: null, present: null, tried: false, t0: 0, ready: 0, failed: false };
// Сколько ждать картинку, прежде чем показать запасной кодовый титул (медленная сеть).
const WAIT = 6000;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function load(base) {
  art.tried = true;
  art.t0 = now();
  for (const k of ['past', 'present']) {
    const img = new Image();
    img.onload = () => {
      art[k] = img;
      if (art.past && art.present) art.ready = now();
    };
    img.onerror = () => (art.failed = true);
    img.src = `${base}art/title/${k}.webp`;
  }
}

// Фаза цикла (с): 0–6 Шрам, 6–7 переход, 7–13 Отпечаток, 13–14 обратно.
export const KEYART_PERIOD = 14;
export function keyartMix(t) {
  const c = ((t % KEYART_PERIOD) + KEYART_PERIOD) % KEYART_PERIOD;
  if (c < 6) return 0;
  if (c < 7) return c - 6;
  if (c < 13) return 1;
  return 14 - c;
}

// Фонари на картинке прошлого (доли ширины и высоты) и колонны сбоев Стирания.
const LAMPS = [[0.14, 0.4], [0.268, 0.385], [0.345, 0.365], [0.405, 0.39]];
const GLITCH_X = [0.69, 0.86, 0.885];

function cover(ctx, img, W, H, zoom, panX) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  return { x: (W - w) / 2 + panX, y: (H - h) / 2, w, h };
}

export function drawKeyArt(ctx, t, W, H, base = './') {
  if (!art.tried) load(base);
  if (!art.past || !art.present) {
    // пока грузится — тёмный кадр, а не прежний титул; запасной титул — только если картинки не пришли
    if (art.failed || now() - art.t0 > WAIT) return false;
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, W, H);
    return true;
  }
  const zoom = 1.02 + Math.sin(t * 0.05) * 0.02;
  const r = cover(ctx, art.present, W, H, zoom, Math.sin(t * 0.04) * 4);
  const mix = keyartMix(t);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art.present, r.x, r.y, r.w, r.h);
  if (mix > 0) {
    ctx.globalAlpha = mix;
    ctx.drawImage(art.past, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  // сбой кадра во время перехода: полосы «съезжают» и вспыхивают
  if (mix > 0 && mix < 1) {
    const f = Math.floor(t * 30);
    const src = mix > 0.5 ? art.past : art.present;
    const k = src.naturalHeight / r.h;
    for (let i = 0; i < 14; i++) {
      const y = hash2(i, f, 3) * H;
      const h = 1 + hash2(f, i, 4) * 6;
      const dx = (hash2(i, f, 5) - 0.5) * 18;
      ctx.drawImage(src, 0, (y - r.y) * k, src.naturalWidth, h * k, r.x + dx, y, r.w, h);
      if (hash2(i, f, 6) > 0.7) {
        ctx.fillStyle = mix > 0.5 ? 'rgba(255,190,90,0.25)' : 'rgba(255,60,100,0.3)';
        ctx.fillRect(0, y, W, h);
      }
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  // фонари прошлого мерцают (и проступают сквозь Шрам)
  for (const [i, [fx, fy]] of LAMPS.entries()) {
    const flick = 0.75 + 0.25 * Math.sin(t * 9 + i * 2.1) * Math.sin(t * 5.3 + i);
    const g = glow(16, 'amber', 0.45 * flick * (0.25 + 0.75 * mix));
    ctx.drawImage(g, r.x + fx * r.w - 16, r.y + fy * r.h - 16);
  }
  // колонны сбоев Стирания мигают в настоящем
  for (const [i, fx] of GLITCH_X.entries()) {
    if (hash2(i, Math.floor(t * 8), 9) < 0.5) continue;
    const a = (1 - mix) * 0.5;
    ctx.fillStyle = i === 0 ? `rgba(80,240,220,${a})` : `rgba(255,70,110,${a})`;
    const y0 = r.y + r.h * (0.05 + hash2(i, Math.floor(t * 8), 2) * 0.35);
    ctx.fillRect(r.x + fx * r.w, y0, 1, r.h * (0.05 + hash2(i, Math.floor(t * 4), 7) * 0.12));
  }
  ctx.globalCompositeOperation = 'source-over';
  // дождь
  ctx.beginPath();
  for (let i = 0; i < 140; i++) {
    const d = rainDrop(i, t, W, H, 0.22);
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.dx, d.y + d.len);
  }
  ctx.strokeStyle = 'rgba(180,195,235,0.22)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // туман у земли и виньетка
  const fog = fogTexture('cold', 3);
  ctx.globalAlpha = 0.4;
  const fx = -((t * 6) % FOG_W);
  for (let x = fx; x < W; x += FOG_W) ctx.drawImage(fog, x, H - FOG_H + 16, FOG_W, FOG_H);
  ctx.globalAlpha = 1;
  ctx.drawImage(vignette(W, H, 0.45), 0, 0, W, H);
  ctx.restore();
  const fade = Math.min(1, (now() - art.ready) / 700);
  if (fade < 1) {
    ctx.fillStyle = `rgba(7,8,15,${1 - fade})`;
    ctx.fillRect(0, 0, W, H);
  }
  return true;
}
