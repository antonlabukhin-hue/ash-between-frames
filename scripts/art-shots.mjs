// Контрольные кадры художественной полировки: node scripts/art-shots.mjs <стадия> [ширина высота]
// → shots/art/<стадия>/square-current.png, square-past.png, square-fight.png, belfry-current.png
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const stage = process.argv[2] || 'now';
const vw = Number(process.argv[3] || 1152);
const vh = Number(process.argv[4] || 648);
const dir = `shots/art/${stage}${vw !== 1152 ? `-${vw}x${vh}` : ''}`;
mkdirSync(dir, { recursive: true });
const mobile = vw < 900;
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: mobile ? 3 : 1, hasTouch: mobile, isMobile: mobile });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.ABF_URL || 'http://localhost:5310/');
await page.waitForFunction(() => window.__abf);
const SHOTS = {
  'square-current': ['square', 'g.player.x = 240; g.player.y = 300; g.player.aim = -Math.PI / 2;'],
  'square-past': ['square', "g.player.x = 230; g.player.y = 262; const keep=(o)=>{o.tl.phase='past'; o.tl.left=Infinity;}; keep(g.statue); g.statue.onShift?.(g, g.statue, 'past'); g.lanterns.slice(0,2).forEach(keep); const f=g.props.find(p=>p.kind==='fountain'); f.tl.phase='past'; f.tl.left=99;", { squareDone: true }],
  'square-north': ['square', "g.player.x = 240; g.player.y = 168; const keep=(o)=>{o.tl.phase='past'; o.tl.left=Infinity;}; keep(g.lanterns[0]);"],
  'square-fight': ['square', "g.player.x = 236; g.player.y = 268; g.spawnWave([{kind:'ringer',x:196,y:186},{kind:'hollow',x:286,y:252},{kind:'framer',x:168,y:282},{kind:'hollow',x:322,y:212}]); setTimeout(()=>{ window.__abf.input.tap('attack'); }, 1300);"],
  'belfry-current': ['belfry', 'g.player.x = 256; g.player.y = 260; if (g.boss) g.boss.cinematic = false;'],
};
for (const [name, [room, setup, flags]] of Object.entries(SHOTS)) {
  await page.evaluate(async ([room, setup, flags]) => {
    window.__abf.game.flags.squareDone = false;
    Object.assign(window.__abf.game.flags, flags || {});
    await window.__abf.shot(room, new Function('g', setup));
    await window.__abf.sleep(1400);
  }, [room, setup, flags]);
  await page.locator('#stage').screenshot({ path: `${dir}/${name}.png` });
}
console.log(dir, errors.length ? errors : 'без ошибок');
await browser.close();
