// Согласованную картинку — в игру: node scripts/art-approve.mjs <картинка> <room> <floor|over> <present|past> [--bits 5] [--key ff00ff] [--mask none]
//   • масштаб к размеру комнаты в плотной сетке (по шаблону art/templates/<room>/spec.json);
//   • пол: небо и пустоты вырезаются по маске шаблона (там работают параллакс и поле Стирания);
//     --mask none — оставить картинку целиком (небо и провал нарисованы на ней самой);
//   • передний план: фон цвета --key (по умолчанию чистая маджента) становится прозрачным;
//   • цвет сводится к 15 битам с дизерингом, край — без полутонов (как кодовые HD-кадры);
//   • файл — в public/art/rooms/<room>/<слой>-<фаза>.png, запись — в manifest.json,
//     оригинал — в art/approved/.
// Нужен запущенный dev-сервер (ABF_URL), обработка идёт в браузере, без новых зависимостей.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const [file, room, layer = 'floor', phase = 'present'] = process.argv.slice(2);
const opt = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};
if (!file || !room || !['floor', 'over'].includes(layer) || !['present', 'past'].includes(phase)) {
  console.log('node scripts/art-approve.mjs <картинка> <room> <floor|over> <present|past> [--bits 5] [--key ff00ff]');
  process.exit(1);
}
const tdir = `art/templates/${room}`;
if (!existsSync(`${tdir}/spec.json`)) {
  console.log(`Нет шаблона ${tdir} — сначала node scripts/art-template.mjs ${room}`);
  process.exit(1);
}
const spec = JSON.parse(readFileSync(`${tdir}/spec.json`, 'utf8'));
const dataUrl = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(process.env.ABF_URL || 'http://localhost:5310/');
await page.waitForFunction(() => window.__abf);
const res = await page.evaluate(
  async ([src, maskSrc, W, H, layer, bits, keyHex]) => {
    const { crispenData } = await import('/src/art/hd.js');
    const load = (s) => new Promise((ok, err) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = err;
      i.src = s;
    });
    const img = await load(src);
    const aspectIn = img.naturalWidth / img.naturalHeight;
    const aspectOut = W / H;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = true;
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, W, H);
    const d = x.getImageData(0, 0, W, H);
    const px = d.data;
    if (layer === 'over') {
      const kr = parseInt(keyHex.slice(0, 2), 16);
      const kg = parseInt(keyHex.slice(2, 4), 16);
      const kb = parseInt(keyHex.slice(4, 6), 16);
      for (let i = 0; i < px.length; i += 4) {
        const dist = Math.abs(px[i] - kr) + Math.abs(px[i + 1] - kg) + Math.abs(px[i + 2] - kb);
        if (dist < 120) px[i + 3] = 0;
      }
    } else if (maskSrc) {
      const m = await load(maskSrc);
      const mc = document.createElement('canvas');
      mc.width = W;
      mc.height = H;
      const mx = mc.getContext('2d');
      mx.imageSmoothingEnabled = false;
      mx.drawImage(m, 0, 0, W, H);
      const md = mx.getImageData(0, 0, W, H).data;
      // прозрачное в маске — небо, чёрное — пустота: вырезаем
      for (let i = 0; i < px.length; i += 4) if (md[i + 3] < 128 || (md[i] < 30 && md[i + 1] < 30 && md[i + 2] < 30)) px[i + 3] = 0;
    }
    crispenData(px, W, H, { bits, keepAlpha: layer === 'over' });
    x.putImageData(d, 0, 0);
    return { url: c.toDataURL('image/png'), aspectIn, aspectOut };
  },
  [dataUrl(file), opt('mask', '') === 'none' ? null : dataUrl(`${tdir}/mask.png`), spec.size[0], spec.size[1], layer, Number(opt('bits', 5)), opt('key', 'ff00ff')],
);
await browser.close();
if (Math.abs(res.aspectIn - res.aspectOut) / res.aspectOut > 0.05) console.log(`внимание: пропорции картинки ${res.aspectIn.toFixed(3)} ≠ комнаты ${res.aspectOut.toFixed(3)} — растянуто`);

const outDir = `public/art/rooms/${room}`;
mkdirSync(outDir, { recursive: true });
const outName = `${layer}-${phase}.png`;
writeFileSync(`${outDir}/${outName}`, Buffer.from(res.url.split(',')[1], 'base64'));
mkdirSync('art/approved', { recursive: true });
copyFileSync(file, `art/approved/${room}-${layer}-${phase}-${basename(file)}`);
const mPath = 'public/art/rooms/manifest.json';
const manifest = existsSync(mPath) ? JSON.parse(readFileSync(mPath, 'utf8')) : { version: 1, rooms: {} };
((manifest.rooms[room] ||= {})[layer] ||= {})[phase] = `${room}/${outName}`;
writeFileSync(mPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`в игре: ${outDir}/${outName} (${room} · ${layer} · ${phase})`);
