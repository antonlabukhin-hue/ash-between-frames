// Пиксельный HUD прямо на холсте.
import { P } from '../art/palette.js';
import { px, disc, ring } from '../art/sprites.js';
import { regenProgress } from '../timeline/charges.js';
import { FRAGMENTS } from '../items/fragments.js';
import { W, H } from '../core/renderer.js';
import { atlas } from '../art/spritecache.js';
import { blit } from '../art/atlas.js';
import { ABILITIES, isUnlocked, cooldownLeft } from '../player/abilities.js';

// Цифры 3×5.
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111',
  4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001111', '-': '000000111000000', '+': '000010111010000',
  '/': '001001010100100', '×': '000101010101000',
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
    c.n, c.max, Math.floor(regenProgress(c) * 12), ab,
    Math.round(p.rift * 30), p.rift >= 1 ? Math.floor(t * 6) % 2 : 0,
    p.echo > 0 ? 1 + (Math.floor(t * 10) % 2) : 0,
    g.save.fragments.join(','), g.save.ash, g.save.shards,
  ].join('|');
}

export function drawHud(g, ctx) {
  const p = g.player;
  if (!p) return;
  const key = hudKey(g);
  if (!layer || layer.width !== W) {
    layer = document.createElement('canvas');
    layer.width = W;
    layer.height = HUD_H;
    layerKey = '';
  }
  if (key !== layerKey) {
    layerKey = key;
    const lc = layer.getContext('2d');
    lc.clearRect(0, 0, W, HUD_H);
    paintHud(g, lc);
  }
  ctx.drawImage(layer, 0, 0);
  drawBossBar(g, ctx);
}

function paintHud(g, ctx) {
  const p = g.player;
  const t = g.time;
  // здоровье: молочно-янтарное, не красное
  const hpv = p.hp / p.maxHp;
  const low = hpv < 0.3 && Math.floor(t * 4) % 2 === 0;
  bar(ctx, 8, 7, 70, 5, hpv, low ? P.amberHi : P.milk);
  px(ctx, 8, 7, Math.round(70 * hpv), 1, P.amberHi);
  drawDigits(ctx, 82, 7, Math.ceil(p.hp), P.ash4);

  // заряды браслета: часики
  const c = p.charges;
  for (let i = 0; i < c.max; i++) {
    const cx = 11 + i * 10;
    const cy = 20;
    disc(ctx, cx, cy, 3, P.ink);
    if (i < c.n) {
      disc(ctx, cx, cy, 3, P.teal0);
      disc(ctx, cx, cy, 2, P.teal);
      px(ctx, cx, cy - 2, 1, 2, P.ink);
      px(ctx, cx, cy, 2, 1, P.ink);
    } else if (i === c.n) {
      const pr = regenProgress(c);
      const n = Math.floor(pr * 12);
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / 12) * Math.PI * 2;
        px(ctx, cx + Math.round(Math.cos(a) * 3), cy + Math.round(Math.sin(a) * 3), 1, 1, P.teal);
      }
    }
    ring(ctx, cx, cy, 3.5, P.ash1);
  }

  // способности школ: значки с откатом
  ABILITIES.forEach((a, i) => {
    if (!isUnlocked(g.flags, i)) return;
    const ax = 44 + i * 11;
    const ay = 15;
    const cdv = cooldownLeft(p.abilities, i);
    px(ctx, ax, ay, 9, 9, P.ink);
    px(ctx, ax + 1, ay + 1, 7, 7, cdv > 0 ? P.ash1 : a.color);
    if (cdv > 0) px(ctx, ax + 1, ay + 1, 7, Math.ceil(7 * cdv), P.ink);
    drawDigits(ctx, ax + 3, ay + 2, i + 1, cdv > 0 ? P.ash3 : P.ink);
  });

  // разлом
  const rx = 8;
  const ry = 28;
  const full = p.rift >= 1;
  bar(ctx, rx, ry, 30, 2, p.rift, full ? (Math.floor(t * 6) % 2 ? P.milk : P.amberHi) : P.ash3);
  if (full) {
    px(ctx, rx + 33, ry - 1, 1, 4, P.milk);
    px(ctx, rx + 35, ry - 1, 1, 4, P.milk);
  }

  // Окно Эха
  if (p.echo > 0) {
    ring(ctx, 48, 29, 3 + (Math.floor(t * 10) % 2), P.tealHi);
    px(ctx, 47, 28, 3, 3, P.tealHi);
  }

  // фрагменты вылазки
  g.save.fragments.forEach((id, i) => {
    const f = FRAGMENTS[id];
    const fx = 8 + i * 9;
    const fy = 36;
    px(ctx, fx, fy, 7, 7, P.ink);
    px(ctx, fx + 1, fy + 1, 5, 5, f?.color || P.amber);
    px(ctx, fx + 2, fy + 2, 3, 3, P.ink);
    px(ctx, fx + 3, fy + 3, 1, 1, f?.color || P.amber);
  });

  // зола и осколки — справа сверху
  const ash = String(g.save.ash);
  const aw = digitsWidth(ash);
  let x = W - 8 - aw;
  drawDigits(ctx, x, 7, ash, P.amberHi);
  px(ctx, x - 7, 8, 4, 3, P.ash3);
  px(ctx, x - 6, 7, 2, 1, P.amber);
  px(ctx, x - 6, 11, 2, 1, P.ash2);
  if (g.save.shards > 0) {
    const sh = String(g.save.shards);
    x = W - 8 - digitsWidth(sh);
    drawDigits(ctx, x, 16, sh, P.tealHi);
    px(ctx, x - 6, 16, 1, 5, P.teal);
    px(ctx, x - 7, 17, 3, 3, P.teal);
    px(ctx, x - 6, 18, 1, 1, P.tealHi);
  }

}

function drawBossBar(g, ctx) {
  const b = g.bossBar;
  if (b) {
    const w = 200;
    const bx = (W - w) / 2;
    const by = H - 10;
    bar(ctx, bx, by, w, 4, b.hp / b.max, P.ash4, P.ink, P.ash1);
    px(ctx, bx, by, Math.round((w * b.hp) / b.max), 1, P.milk);
    for (const m of b.marks || []) px(ctx, bx + Math.round(w * m), by - 1, 1, 6, P.amber);
  }
}
