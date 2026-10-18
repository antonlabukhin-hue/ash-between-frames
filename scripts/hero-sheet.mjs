// Лист разворотов героя (дизайн на согласование): node scripts/hero-sheet.mjs [файл]
// Кадры из атласа игры, крупно: вид спереди/сзади/сбоку, шаги, удары, точный удар.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'shots/32bit/hero-sheet.png';
const b = await chromium.launch({ channel: 'msedge' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.env.ABF_URL || 'http://localhost:5310/');
await p.waitForFunction(() => window.__abf);
const url = await p.evaluate(async () => {
  const sc = await import('/src/art/spritecache.js');
  const S = 6;
  const cols = 7;
  const poses = [
    ['спереди', { dir: 'down' }], ['шаг', { dir: 'down', moving: true, walk: 0.25, sway: 2 }], ['шаг', { dir: 'down', moving: true, walk: 0.75, sway: -2 }],
    ['сзади', { dir: 'up' }], ['шаг', { dir: 'up', moving: true, walk: 0.25 }], ['сбоку', { dir: 'side' }], ['сбоку', { dir: 'side', flip: true, moving: true, walk: 0.5 }],
    ['удар 1', { dir: 'down', swing: 0.04, swingStep: 1, aim: 0 }], ['удар 1', { dir: 'down', swing: 0.12, swingStep: 1, aim: 0 }], ['удар 2', { dir: 'side', swing: 0.08, swingStep: 2, aim: 0 }],
    ['удар 3', { dir: 'side', swing: 0.12, swingStep: 3, aim: 0 }], ['вверх', { dir: 'up', swing: 0.08, swingStep: 1, aim: -Math.PI / 2 }], ['точный', { dir: 'down', swing: 0.1, swingStep: 1, aim: Math.PI / 2, glow: true }], ['без зарядов', { dir: 'down', charges: 0 }],
  ];
  const cw = 44;
  const ch = 46;
  const c = document.createElement('canvas');
  c.width = cols * cw * S;
  c.height = Math.ceil(poses.length / cols) * ch * S;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1d29';
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = cw * 2;
  tmp.height = ch * 2;
  const tx = tmp.getContext('2d');
  tx.imageSmoothingEnabled = false;
  poses.forEach(([label, o], i) => {
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.clearRect(0, 0, tmp.width, tmp.height);
    tx.setTransform(2, 0, 0, 2, 0, 0);
    sc.drawHeroC(tx, cw / 2, 38, { t: 0, charges: 3, aim: Math.PI / 2, ...o });
    const gx = (i % cols) * cw * S;
    const gy = Math.floor(i / cols) * ch * S;
    x.drawImage(tmp, 0, 0, tmp.width, tmp.height, gx, gy, cw * S, ch * S);
    x.fillStyle = '#aeb0bc';
    x.font = '22px sans-serif';
    x.fillText(label, gx + 12, gy + ch * S - 12);
  });
  return c.toDataURL('image/png');
});
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(out);
await b.close();
