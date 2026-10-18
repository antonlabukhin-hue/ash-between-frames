// Контрольные кадры 32-битного стиля прямо с холста (без масштабирования экрана):
// node scripts/shots32.mjs [стадия] [ширина высота] [профиль]
// → shots/32bit/<стадия>/<кадр>.png. Нужен запущенный dev-сервер (ABF_URL, по умолчанию :5310).
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const stage = process.argv[2] || 'now';
const vw = Number(process.argv[3] || 1920);
const vh = Number(process.argv[4] || 1080);
const profile = process.argv[5] || 'high';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const dir = `shots/32bit/${stage}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.ABF_URL || 'http://localhost:5310/');
await page.waitForFunction(() => window.__abf);

const SHOTS = {
  'road-west': ['road', 'g.player.x = 300; g.player.y = 122; g.player.aim = 0;'],
  'road-gap': ['road', 'g.player.x = 470; g.player.y = 118; g.player.aim = 0;'],
  'road-east': ['road', "g.player.x = 780; g.player.y = 124; g.player.dir='side'; g.spawnWave([{kind:'hollow',x:820,y:104},{kind:'framer',x:740,y:150}]);"],
  'road-fight': ['road', "g.player.x = 250; g.player.y = 124; g.spawnWave([{kind:'hollow',x:300,y:110},{kind:'ringer',x:200,y:150},{kind:'framer',x:330,y:140}]);"],
  square: ['square', 'g.player.x = 240; g.player.y = 300; g.player.aim = -Math.PI / 2;'],
  belfry: ['belfry', 'g.player.x = 256; g.player.y = 260; if (g.boss) g.boss.cinematic = false;'],
  tornRoad: ['tornRoad', ''],
  camp: ['camp', "const f=g.props.find(p=>p.kind==='campfire'); if(f){f.tl.phase='past'; f.tl.left=99;}"],
  kitchen: ['kitchen', ''],
  ruins: ['ruins', "g.spawnWave([{kind:'eater',x:g.player.x+60,y:g.player.y},{kind:'hollow',x:g.player.x-50,y:g.player.y+10}]); for(let i=0;i<4;i++) g.spawnPickup(['ash','shard','heal','fragment'][i], g.player.x+20+i*12, g.player.y+20, {vx:0,vy:0});"],
  pickups: ['road', "g.player.x=320; g.player.y=124; for(let i=0;i<5;i++) g.spawnPickup(['ash','shard','heal','fragment','scrap'][i], 340+i*14, 130, {vx:0,vy:0});"],
};
for (const [name, [room, setup]] of Object.entries(SHOTS)) {
  if (only && !only.includes(name)) continue;
  const url = await page.evaluate(async ([room, setup, profile]) => {
    const a = window.__abf;
    a.game.flags.introSeen = true;
    await a.shot(room, new Function('g', setup));
    a.game.setQuality(a.PROFILES[profile]);
    a.ui.fade(false);
    await a.sleep(1200);
    return a.renderer.canvas.toDataURL('image/png');
  }, [room, setup, profile]);
  writeFileSync(`${dir}/${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
}
console.log(dir, errors.length ? errors : 'без ошибок');
await browser.close();
