// Атмосфера 32-битного кадра: мокрый камень (отражения огней и персонажей, всплески),
// туман, дождь, виньетка. Включается погодой комнаты (def.weather) и профилем качества.
//
//   def.weather = {
//     rain: 0..1,        // плотность дождя (доля от лимита профиля)
//     wet: [коды тайлов], // где лужи и отражения; по умолчанию — дорога, брусчатка, плиты, ступени
//     fog: 'cold' | [r,g,b], fogA: 0..1, // цвет и плотность тумана
//     wind: 0.25,        // наклон струй
//   }
import { W, H, RS } from '../core/renderer.js';
import { TILE, T } from './tiles.js';
import { tileAt } from '../world/room.js';
import { streak, fogTexture, FOG_W, FOG_H, vignette, rainDrop, splashAt, wetRuns, glow } from './glow.js';

const WET_DEFAULT = [T.ROAD, T.FLOOR, T.PLAZA, T.STAIR];

export const weatherOf = (g) => g.room?.def.weather || null;

// Клип по мокрым тайлам видимой области (мировые координаты, контекст уже сдвинут камерой).
// Отрезки кэшируются по положению камеры в тайлах.
let runsKey = '';
let runs = [];
function clipWet(g, ctx, cx, cy) {
  const w = weatherOf(g);
  const codes = w.wet || WET_DEFAULT;
  const x0 = Math.max(0, Math.floor(cx / TILE));
  const y0 = Math.max(0, Math.floor(cy / TILE));
  const x1 = Math.min(g.room.w - 1, x0 + Math.ceil(W / TILE) + 1);
  const y1 = Math.min(g.room.h - 1, y0 + Math.ceil(H / TILE) + 1);
  const key = `${g.room.id}|${x0}|${y0}|${x1}|${y1}`;
  if (key !== runsKey) {
    runsKey = key;
    runs = wetRuns((tx, ty) => codes.includes(tileAt(g.room, tx, ty)), x0, y0, x1, y1);
  }
  ctx.beginPath();
  for (const [tx, ty, n] of runs) ctx.rect(tx * TILE, ty * TILE, n * TILE, TILE);
  ctx.clip();
  return runs.length > 0;
}

// Отражения и всплески — после пола, до персонажей. drawFigures(ctx) рисует
// персонажей как обычно; здесь они отражаются вниз от линии ног.
export function drawWet(g, ctx, cx, cy, figures) {
  const w = weatherOf(g);
  const q = g.quality;
  if (!w || !q.reflect) return;
  ctx.save();
  if (!clipWet(g, ctx, cx, cy)) {
    ctx.restore();
    return;
  }
  // огни: вертикальные полосы под источником
  ctx.globalCompositeOperation = 'lighter';
  for (const l of g.lights) {
    if (l.x < cx - 40 || l.x > cx + W + 40 || l.y < cy - 80 || l.y > cy + H + 20) continue;
    const base = l.base ?? l.y + 12;
    const len = Math.min(90, 18 + l.r * 0.7);
    const flick = 0.85 + 0.15 * Math.sin(g.time * 9 + l.x);
    const s = streak(7, len, l.c, 0.55, (l.x | 0) % 7);
    ctx.globalAlpha = flick;
    ctx.drawImage(s, l.x - 3.5, base + 1, 7, len);
    ctx.drawImage(glow(Math.round(l.r * 0.5), l.c, 0.18, 0.4), l.x - Math.round(l.r * 0.5), base - Math.round(l.r * 0.5 * 0.4) + 6);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // персонажи — перевёрнутые и бледные (только High)
  if (q.reflect >= 2 && figures) {
    ctx.globalAlpha = 0.22;
    figures.forEach((f) => {
      ctx.save();
      ctx.translate(0, f.y * 2 + 1);
      ctx.scale(1, -1);
      f.draw(ctx);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
  // всплески капель: расходящиеся эллипсы
  if (w.rain && q.rain) {
    const n = Math.round((q.rain / 6) * w.rain);
    ctx.lineWidth = 1 / RS;
    for (const band of [0, 1]) {
      ctx.beginPath();
      for (let i = band; i < n; i += 2) {
        const s = splashAt(i, g.time, W, H);
        if ((s.k < 0.5) !== (band === 0)) continue;
        const r = 0.8 + s.k * 3.2;
        ctx.moveTo(cx + s.x + r, cy + s.y);
        ctx.ellipse(cx + s.x, cy + s.y, r, r * 0.4, 0, 0, Math.PI * 2);
      }
      ctx.strokeStyle = band === 0 ? 'rgba(190,205,240,0.45)' : 'rgba(190,205,240,0.18)';
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Туман — два слоя мягких клубов с разной скоростью (экранные координаты).
export function drawFog(g, ctx, cx, cy) {
  const w = weatherOf(g);
  if (!w?.fog || !g.quality.fog) return;
  const tex = fogTexture(w.fog, 1);
  const tex2 = fogTexture(w.fog, 2);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  const a = w.fogA ?? 0.5;
  const layer = (t, k, speed, alpha, yOff) => {
    ctx.globalAlpha = alpha;
    const ox = -((((cx * k + g.time * speed) % FOG_W) + FOG_W) % FOG_W);
    const oy = -((((cy * k + yOff) % FOG_H) + FOG_H) % FOG_H);
    for (let y = oy; y < H; y += FOG_H) for (let x = ox; x < W; x += FOG_W) ctx.drawImage(t, x, y, FOG_W, FOG_H);
  };
  layer(tex, 0.6, 5, a * 0.7, 0);
  layer(tex2, 1.15, 11, a, 40);
  ctx.restore();
}

// Дождь — тонкие наклонные струи в плотной сетке, ближние ярче и длиннее.
export function drawRain(g, ctx) {
  const w = weatherOf(g);
  const n = Math.round((w?.rain || 0) * (g.quality.rain || 0));
  if (!n) return;
  const wind = w.wind ?? 0.25;
  ctx.save();
  for (const near of [false, true]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const d = rainDrop(i, g.time, W, H, wind);
      if (d.near !== near) continue;
      const len = near ? d.len * 1.6 : d.len;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + wind * len, d.y + len);
    }
    ctx.lineWidth = near ? 1 : 1 / RS;
    ctx.strokeStyle = near ? 'rgba(185,200,235,0.28)' : 'rgba(160,180,225,0.35)';
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVignette(g, ctx) {
  if (!g.quality.vignette) return;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(vignette(W, H, g.room?.def.weather?.vignette ?? 0.55), 0, 0, W, H);
  ctx.restore();
}
