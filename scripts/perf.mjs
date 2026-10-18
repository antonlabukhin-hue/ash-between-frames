// Замер плавности: node scripts/perf.mjs [room] [cpuThrottle] [profile]
// Edge, замедление CPU (×4 ≈ средний телефон), нагрузка — волна врагов и частицы.
import { chromium } from '@playwright/test';

const room = process.argv[2] || 'square';
const throttle = Number(process.argv[3] || 4);
const profile = process.argv[4] || 'medium';
const bossHp = Number(process.argv[5] || 0);
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto((process.env.ABF_URL || 'http://localhost:5310/') + '?debug');
await page.waitForFunction(() => window.__abf);
const cdp = await page.context().newCDPSession(page);
const res = await page.evaluate(async ([room, profile, bossHp]) => {
  const A = window.__abf;
  A.save.settings.quality = profile;
  A.game.setQuality(A.PROFILES[profile]);
  A.game.autoQuality = false;
  await A.shot(room, (g) => {
    g.player.invuln = 999;
    if (g.boss) {
      g.boss.cinematic = false;
      return;
    }
    const p = g.player;
    const kinds = ['hollow', 'hollow', 'ringer', 'framer', 'ringer', 'eater'];
    g.spawnWave(kinds.map((k, i) => ({ kind: k, x: p.x + Math.cos(i) * 70, y: p.y + Math.sin(i) * 45 })));
  });
  return true;
  if (A.game.boss && bossHp) {
    A.game.boss.hp = bossHp;
    await A.sleep(2500);
    A.ui.closeAll();
    A.game.cinematic = false;
    A.game.boss.cinematic = false;
  }
  return true;
}, [room, profile, bossHp]);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
// бой: герой бьёт и уворачивается, всё время держим нагрузку
const stats = await page.evaluate(async () => {
  const A = window.__abf;
  const g = A.game;
  const samples = [];
  const t0 = performance.now();
  while (performance.now() - t0 < 8000) {
    g.player.hp = g.player.maxHp;
    if (g.boss) g.boss.hp = Math.max(g.boss.hp, 40);
    A.input.tap('attack');
    if (Math.random() < 0.2) A.input.tap('dodge');
    if (!g.boss && g.enemies.length < 4) g.spawnWave([{ kind: 'hollow', x: g.player.x + 60, y: g.player.y }, { kind: 'ringer', x: g.player.x - 60, y: g.player.y - 30 }]);
    await A.sleep(120);
    samples.push({ ...A.summary(), particles: g.particles.n, lights: A.frameStats.lights, objects: A.frameStats.objects, sec: { ...A.frameStats.sec } });
  }
  const s = samples.slice(10);
  const avg = (k) => s.reduce((a, v) => a + v[k], 0) / s.length;
  const mx = (k) => Math.max(...s.map((v) => v[k]));
  const secMax = {};
  for (const v of s) for (const [k, n] of Object.entries(v.sec || {})) secMax[k] = Math.max(secMax[k] || 0, n);
  return { secMax, fps: avg('fps'), frameMs: avg('frameMs'), frameMax: mx('frameMax'), updMs: avg('updMs'), renMs: avg('renMs'), calls: avg('calls'), callsMax: mx('calls'), particles: mx('particles'), lights: mx('lights'), objects: avg('objects'), q: A.game.quality.id, frame: `${A.renderer.scale}x` };
});
await page.screenshot({ path: `shots/perf-${room}-${profile}.png` });
console.log(JSON.stringify({ room, throttle, ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 100) / 100 : v])), errors }, null, 1));
await browser.close();
void res;
