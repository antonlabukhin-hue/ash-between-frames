// Скриншоты комнат в 3× для визуальной проверки: node scripts/shots.mjs [room ...]
// Нужен запущенный dev-сервер (npm run dev). Картинки — в shots/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const URL = process.env.ABF_URL || 'http://localhost:5310/';
const SCENES = {
  title: null,
  road: "g.player.x = 10*16; g.player.y = 7*16+4; g.props.find(p=>p.kind==='sign').tl.phase='past'",
  tornRoad: "g.player.x = 12*16; g.player.y = 9*16; g.room.flickerStart = g.time - 2; g.spawnWave([{kind:'hollow',x:20*16,y:6*16},{kind:'framer',x:18*16,y:11*16}])",
  camp: "g.player.x = 10*16; g.player.y = 7*16; g.props.find(p=>p.kind==='campfire').tl.phase='past'; g.campNpc.sena.hidden=false",
  square: "g.player.x = 16*16; g.player.y = 15*16; g.lanterns[0].tl.phase='past'; g.spawnWave([{kind:'ringer',x:12*16,y:9*16},{kind:'hollow',x:20*16,y:12*16}])",
  stairs: "g.player.x = 7*16; g.player.y = 33*16; g.stairProps[1].tl.phase='present'",
  shadowArena: "g.player.x = 13*16; g.player.y = 12*16",
  ascent: "g.player.x = 20*16; g.player.y = 8*16; g.cityEcho.tl.phase='past'; g.cityGhosts.forEach(c=>c.hidden=false)",
  belfry: "g.player.x = 16*16; g.player.y = 16*16",
  kitchen: "g.player.x = 11*16; g.player.y = 10*16",
  ruins: "g.player.x = 15*16; g.player.y = 16*16",
};

const want = process.argv.slice(2);
const list = want.length ? want : Object.keys(SCENES);
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
await page.goto(URL);
await page.waitForFunction(() => window.__abf);
for (const id of list) {
  if (id === 'title') {
    await page.waitForTimeout(600);
  } else {
    await page.evaluate(async ([room, setup]) => {
      await window.__abf.shot(room, setup ? new Function('g', setup) : null);
      await window.__abf.sleep(1200);
    }, [id, SCENES[id]]);
  }
  await page.locator('#stage').screenshot({ path: `shots/${id}.png` });
  console.log('ok', id);
}
await browser.close();
