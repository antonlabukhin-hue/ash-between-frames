// Пиксельный HUD прямо на холсте.
import { P, RAMP } from '../art/palette.js';
import { px, disc, ring } from '../art/sprites.js';
import { regenProgress } from '../timeline/charges.js';
import { isOverheated } from '../timeline/heat.js';
import { FRAGMENTS } from '../items/fragments.js';
import { W, H, RS } from '../core/renderer.js';
import { atlas } from '../art/spritecache.js';
import { blit } from '../art/atlas.js';
import { ABILITIES, isUnlocked, cooldownLeft } from '../player/abilities.js';

// Цифры 3×5.
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', '-': '000000111000000', '+': '000010111010000',
  '/': '001001010100100', '×': '000101010101000',
  E: '111100110100111', B: '110101110101110', Q: '111101101111001', Y: '101101010010010',
};

// Глифы цифр печатаются в атлас один раз: один drawImage на символ.
export function drawDigits(ctx, x, y, str, c, scale = 1) {
  str = String(str);
  let cx = Math.round(x);
  for (const ch of str) {
    const m = DIGITS[ch];
    if (m) {
      const e = atlas.sprite(`dg|${ch}|${c}|${scale}`, 3 * scale, 5 * scale, 0, 0, (b) => {
        b.fillStyle = c;
        for (let i = 0; i < 15; i++) if (m[i] === '1') b.fillRect((i % 3) * scale, Math.floor(i / 3) * scale, scale, scale);
      });
      blit(ctx, e, cx, Math.round(y));
    }
    cx += 4 * scale;
  }
  return cx - x;
}

export const digitsWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;

function bar(ctx, x, y, w, h, v, fill, back = P.ink, edge = P.ash1) {
  px(ctx, x - 1, y - 1, w + 2, h + 2, edge);
  px(ctx, x, y, w, h, back);
  const fw = Math.round(w * Math.max(0, Math.min(1, v)));
  if (fw > 0) px(ctx, x, y, fw, h, fill);
}

// HUD — слой-полоса сверху: перерисовывается только когда меняются значения
// (мигания квантованы по времени), в остальные кадры — один drawImage.
let layer = null;
let layerKey = '';
const HUD_H = 48;

function hudKey(g) {
  const p = g.player;
  const t = g.time;
  const c = p.charges;
  const hpv = p.hp / p.maxHp;
  const ab = ABILITIES.map((a, i) => (isUnlocked(g.flags, i) ? Math.ceil(7 * cooldownLeft(p.abilities, i)) : 'x')).join('');
  return [
    W, Math.ceil(p.hp), p.maxHp, hpv < 0.3 ? Math.floor(t * 4) % 2 : 0,
    c.n, c.max, Math.floor(regenProgress(c) * 12), ab, p.heat && isOverheated(p.heat, t) ? 1 + (Math.floor(t * 6) % 2) : 0,
    Math.round(p.rift * 30), p.rift >= 1 ? Math.floor(t * 6) % 2 : 0,
    p.echo > 0 ? 1 + (Math.floor(t * 10) % 2) : 0,
    g.save.fragments.join(','), g.save.ash, g.save.shards,
  ].join('|');
}

export function drawHud(g, ctx) {
  const p = g.player;
  if (!p) return;
  const key = hudKey(g);
  if (!layer || layer.width !== W * RS) {
    layer = document.createElement('canvas');
    layer.width = W * RS;
    layer.height = HUD_H * RS;
    layerKey = '';
  }
  if (key !== layerKey) {
    layerKey = key;
    const lc = layer.getContext('2d');
    lc.setTransform(RS, 0, 0, RS, 0, 0);
    lc.imageSmoothingEnabled = false;
    lc.clearRect(0, 0, W, HUD_H);
    paintHud(g, lc);
  }
  ctx.drawImage(layer, 0, 0, W, HUD_H);
  drawBossBar(g, ctx);
}

// ── HUD в 16-bit оправе: бронзовая рамка здоровья, самоцветы браслета, кристалл разлома ──
const BZ = RAMP.bronze;

function frame(ctx, x, y, w, h) {
  px(ctx, x - 2, y - 2, w + 4, h + 4, P.ink);
  px(ctx, x - 1, y - 1, w + 2, 1, BZ[3]);
  px(ctx, x - 1, y + h, w + 2, 1, BZ[1]);
  px(ctx, x - 1, y, 1, h, BZ[2]);
  px(ctx, x + w, y, 1, h, BZ[1]);
}

function gem(ctx, x, y, fill, k = 1) {
  // ромб 7×7: гнездо, заполнение снизу на долю k
  const rows = [1, 3, 5, 7, 5, 3, 1];
  rows.forEach((w, j) => px(ctx, x + 3 - (w >> 1), y + j, w, 1, P.ink));
  const from = Math.round(7 * (1 - k));
  rows.forEach((w, j) => {
    if (j < from) return;
    const inner = Math.max(1, w - 2);
    px(ctx, x + 3 - (inner >> 1), y + j, inner, 1, j < 3 ? fill[1] : fill[0]);
  });
  if (k >= 1) px(ctx, x + 2, y + 2, 1, 1, fill[2]);
}

function paintHud(g, ctx) {
  const p = g.player;
  const t = g.time;
  // здоровье: молочно-янтарное в бронзовой оправе, без цифр
  const hpv = Math.max(0, p.hp / p.maxHp);
  const low = hpv < 0.3 && Math.floor(t * 4) % 2 === 0;
  const bw = 64 + Math.round((p.maxHp - 100) / 5);
  frame(ctx, 9, 7, bw, 4);
  px(ctx, 9, 7, bw, 4, '#1a1620');
  const fw = Math.round(bw * hpv);
  if (fw > 0) {
    px(ctx, 9, 7, fw, 4, low ? P.amber : P.milk);
    px(ctx, 9, 7, fw, 1, P.amberHi);
    px(ctx, 9, 10, fw, 1, low ? P.amber1 : '#c8bfa8');
  }
  // наконечники-ромбы
  for (const ex of [5, 9 + bw + 2]) {
    px(ctx, ex, 8, 2, 2, BZ[3]);
    px(ctx, ex + (ex === 5 ? 1 : 0), 7, 1, 4, BZ[2]);
  }

  // браслет: бронзовая лента с самоцветами-зарядами
  const c = p.charges;
  const gx = 8;
  const gy = 16;
  px(ctx, gx - 1, gy + 2, c.max * 9 + 1, 3, BZ[1]);
  px(ctx, gx - 1, gy + 2, c.max * 9 + 1, 1, BZ[2]);
  // раскалённый браслет (перегрев) — самоцветы малиновые и мигают
  const hot = p.heat && isOverheated(p.heat, t);
  const teal = hot ? (Math.floor(t * 6) % 2 ? [P.crimson0, P.crimson, P.crimsonHi] : [P.crimson0, P.crimson1, P.crimson]) : [P.teal0, P.teal, P.tealHi];
  for (let i = 0; i < c.max; i++) {
    const k = i < c.n ? 1 : i === c.n ? regenProgress(c) : 0;
    gem(ctx, gx + i * 9, gy, teal, k);
  }
  // кристалл разлома
  const rx = gx + c.max * 9 + 4;
  const full = p.rift >= 1;
  const crystal = [2, 4, 4, 6, 6, 6, 6, 4, 2];
  crystal.forEach((w, j) => px(ctx, rx + 3 - (w >> 1), gy - 2 + j, w, 1, P.ink));
  const fillFrom = Math.round(crystal.length * (1 - p.rift));
  crystal.forEach((w, j) => {
    if (j < fillFrom || w < 3) return;
    const col = full ? (Math.floor(t * 6) % 2 ? P.milk : P.amberHi) : j < 4 ? P.ash4 : P.ash3;
    px(ctx, rx + 3 - ((w - 2) >> 1), gy - 2 + j, w - 2, 1, col);
  });
  // Окно Эха
  if (p.echo > 0) ring(ctx, rx + 3, gy + 2, 6 + (Math.floor(t * 10) % 2), P.tealHi);

  // способности школ: руны с откатом
  ABILITIES.forEach((a, i) => {
    if (!isUnlocked(g.flags, i)) return;
    const ax = 8 + i * 11;
    const ay = 27;
    const cdv = cooldownLeft(p.abilities, i);
    px(ctx, ax - 1, ay - 1, 11, 11, BZ[1]);
    px(ctx, ax, ay, 9, 9, P.ink);
    px(ctx, ax + 1, ay + 1, 7, 7, cdv > 0 ? P.ash1 : a.color);
    if (cdv > 0) px(ctx, ax + 1, ay + 1, 7, Math.ceil(7 * cdv), P.ink);
    drawDigits(ctx, ax + 3, ay + 2, i + 1, cdv > 0 ? P.ash3 : P.ink);
  });

  // фрагменты вылазки
  g.save.fragments.forEach((id, i) => {
    const f = FRAGMENTS[id];
    const fx = 8 + i * 8;
    const fy = 39;
    px(ctx, fx, fy, 6, 6, P.ink);
    px(ctx, fx + 1, fy + 1, 4, 4, f?.color || P.amber);
    px(ctx, fx + 2, fy + 2, 2, 2, P.ink);
  });

  // зола — уголёк, осколки — кристалл, справа сверху
  const ash = String(g.save.ash);
  let x = W - 8 - digitsWidth(ash);
  drawDigits(ctx, x, 7, ash, P.amberHi);
  px(ctx, x - 8, 7, 5, 5, P.ink);
  px(ctx, x - 7, 8, 3, 3, P.ash2);
  px(ctx, x - 6, 9, 1, 1, P.amberHi);
  px(ctx, x - 7, 10, 1, 1, P.amber);
  if (g.save.shards > 0) {
    const sh = String(g.save.shards);
    x = W - 8 - digitsWidth(sh);
    drawDigits(ctx, x, 16, sh, P.tealHi);
    px(ctx, x - 6, 15, 1, 7, P.teal);
    px(ctx, x - 7, 17, 3, 3, P.teal);
    px(ctx, x - 6, 17, 1, 2, P.tealHi);
  }
}

function drawBossBar(g, ctx) {
  const b = g.bossBar;
  if (!b) return;
  const w = Math.min(220, W - 120);
  const bx = Math.round((W - w) / 2);
  const by = H - 11;
  frame(ctx, bx, by, w, 4);
  px(ctx, bx, by, w, 4, '#1a1620');
  const fw = Math.round((w * Math.max(0, b.hp)) / b.max);
  px(ctx, bx, by, fw, 4, P.ash4);
  px(ctx, bx, by, fw, 1, P.milk);
  for (const m of b.marks || []) {
    const mx = bx + Math.round(w * m);
    px(ctx, mx - 1, by - 3, 3, 2, BZ[3]);
    px(ctx, mx, by - 1, 1, 6, BZ[2]);
  }
  // колокольчик у левого края
  px(ctx, bx - 10, by - 2, 5, 1, BZ[3]);
  px(ctx, bx - 11, by - 1, 7, 5, BZ[2]);
  px(ctx, bx - 12, by + 4, 9, 1, BZ[3]);
}
