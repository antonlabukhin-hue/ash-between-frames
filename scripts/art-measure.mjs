// Сверка картинки генератора со схемой комнаты: node scripts/art-measure.mjs <картинка> <room>
// → <картинка>-overlay.png (схема поверх, линии: края дороги, низ стены, провал) и замеры в процентах.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const [file, room = 'road'] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(`art/templates/${room}/spec.json`, 'utf8'));
const mime = /\.jpe?g$/i.test(file) ? 'jpeg' : /\.webp$/i.test(file) ? 'webp' : 'png';
const src = `data:image/${mime};base64,${readFileSync(file).toString('base64')}`;
const lay = `data:image/png;base64,${readFileSync(`art/templates/${room}/layout.png`).toString('base64')}`;
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage();
const r = await p.evaluate(async ([src, lay, W, H, tile, skyRows]) => {
  const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
  const img = await load(src);
  const L = await load(lay);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  const lum = (i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  const rows = [];
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let xx = Math.floor(w * 0.05); xx < w * 0.95; xx++) s += lum((y * w + xx) * 4);
    rows.push(s / (w * 0.9));
  }
  let best = [0, 0];
  let cur = -1;
  rows.forEach((v, y) => {
    if (v < 14) {
      if (cur < 0) cur = y;
      if (y - cur > best[1] - best[0]) best = [cur, y];
    } else cur = -1;
  });
  // по схеме: где провал и низ стены (по маске layout — чёрная полоса и серые ряды сверху)
  const lc = document.createElement('canvas');
  lc.width = W;
  lc.height = H;
  const lx = lc.getContext('2d');
  lx.drawImage(L, 0, 0);
  const ld = lx.getImageData(0, 0, W, H).data;
  const col = Math.floor(W * 0.2);
  let g0 = -1;
  let g1 = -1;
  let wallEnd = -1;
  for (let y = 0; y < H; y++) {
    const i = (y * W + col) * 4;
    const black = ld[i] < 8 && ld[i + 1] < 8 && ld[i + 2] < 8;
    if (black && g0 < 0) g0 = y;
    if (black) g1 = y;
    const grey = ld[i] === 0x5a && ld[i + 1] === 0x60;
    if (grey && y < H * 0.3) wallEnd = y;
  }
  const o = document.createElement('canvas');
  o.width = W;
  o.height = H;
  const ox = o.getContext('2d');
  ox.drawImage(img, 0, 0, W, H);
  ox.globalAlpha = 0.3;
  ox.drawImage(L, 0, 0);
  ox.globalAlpha = 1;
  ox.lineWidth = 4;
  ox.font = 'bold 28px sans-serif';
  const hl = (y, c, t) => {
    ox.strokeStyle = c;
    ox.beginPath();
    ox.moveTo(0, y);
    ox.lineTo(W, y);
    ox.stroke();
    if (t) {
      ox.fillStyle = c;
      ox.fillText(t, 20, y - 8);
    }
  };
  hl(wallEnd + 1, '#00ffff', 'схема: низ стены');
  hl(g0, '#00ff66', 'схема: провал');
  hl(g1 + 1, '#00ff66');
  ox.strokeStyle = '#ffff00';
  for (const xv of [W * 0.4, W * 0.6]) {
    ox.beginPath();
    ox.moveTo(xv, 0);
    ox.lineTo(xv, H);
    ox.stroke();
  }
  return { w, h, gap: [best[0] / h, best[1] / h], want: { wall: (wallEnd + 1) / H, gap: [g0 / H, (g1 + 1) / H] }, overlay: o.toDataURL('image/png') };
}, [src, lay, spec.size[0], spec.size[1], spec.tile, spec.skyRows]);
await b.close();
const out = file.replace(/\.\w+$/, '-overlay.png');
writeFileSync(out, Buffer.from(r.overlay.split(',')[1], 'base64'));
const pct = (v) => `${(v * 100).toFixed(1)}%`;
console.log(`${file}: ${r.w}×${r.h}, пропорции ${(r.w / r.h).toFixed(3)} (нужно ${(spec.size[0] / spec.size[1]).toFixed(3)})`);
console.log(`провал на картинке: ${pct(r.gap[0])}–${pct(r.gap[1])}, по схеме: ${pct(r.want.gap[0])}–${pct(r.want.gap[1])}`);
console.log(`низ стены по схеме: ${pct(r.want.wall)}; наложение: ${out}`);
