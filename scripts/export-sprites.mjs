// Выгрузка кодовых кадров в PNG-шаблон для ручной перерисовки:
//   node scripts/export-sprites.mjs  →  art/export/characters.png + art/export/manifest.json
// Художник правит PNG (те же клетки, точка ног — ax/ay из манифеста), затем кладёт
// characters.png и manifest.json в public/sprites/ — игра подхватит без изменения кода.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(process.env.ABF_URL || 'http://localhost:5310/');
await page.waitForFunction(() => window.__abf);
const { png, manifest } = await page.evaluate(() => window.__abf.exportSheet());
mkdirSync('art/export', { recursive: true });
writeFileSync('art/export/characters.png', Buffer.from(png.split(',')[1], 'base64'));
writeFileSync('art/export/manifest.json', JSON.stringify(manifest, null, 1));
console.log('кадров:', Object.keys(manifest.sheets[0].frames).length);
await browser.close();
