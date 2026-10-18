// Скриншоты телефона в альбомной ориентации: node scripts/mobile-shots.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const URL = process.env.ABF_URL || 'http://localhost:5310/';
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
await page.goto(URL);
await page.waitForFunction(() => window.__abf);
await page.waitForTimeout(500);
await page.screenshot({ path: 'shots/m-title.png' });
await page.evaluate(async () => {
  const A = window.__abf;
  await A.shot('square', (g) => {
    g.player.x = 230;
    g.player.y = 250;
    const keep = (o) => { o.tl.phase = 'past'; o.tl.left = Infinity; };
    keep(g.lanterns[0]);
    g.spawnWave([{ kind: 'hollow', x: 280, y: 230 }, { kind: 'ringer', x: 180, y: 200 }]);
  });
  await A.sleep(1200);
});
await page.screenshot({ path: 'shots/m-play.png' });
await page.evaluate(async () => {
  const A = window.__abf;
  A.game.say([{ who: 'Тик', text: 'Твой браслет вытаскивает из вещей их прошлое — Отпечаток. Ненадолго: потом возвращается Шрам.', portrait: 'tik' }]);
  await A.sleep(2500);
});
await page.screenshot({ path: 'shots/m-dialog.png' });
await browser.close();
console.log('ok');
