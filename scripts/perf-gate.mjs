// Проверка плавности для CI: настоящий бой (удары, уклонения, сдвиги) в нескольких комнатах при
// замедленном ЦП, пороги — из scripts/perf-gate.json. Ловит регрессии, а не заменяет телефон:
// раннер GitHub и смартфон — разные среды (аудит 2026-10-19).
//   ABF_URL=http://localhost:4173/ node scripts/perf-gate.mjs
// Код выхода 1 — порог превышен. Итог пишется в $GITHUB_STEP_SUMMARY, если он есть.
import { chromium } from '@playwright/test';
import fs from 'fs';

const cfg = JSON.parse(fs.readFileSync(new URL('./perf-gate.json', import.meta.url), 'utf8'));
const url = process.env.ABF_URL || 'http://localhost:5320/';
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'msedge' });
const rows = [];
let failed = false;

for (const room of cfg.rooms) {
  const ctx = await browser.newContext({ viewport: { width: 1152, height: 648 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?room=${room}`);
  await page.waitForFunction(() => window.__abf?.game?.player, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.cpuThrottle });
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.player.hp = g.player.maxHp = 9999;
    g.ui.closeAll?.();
    g.cinematic = false;
    const p = g.player;
    const kinds = ['hollow', 'framer', 'ringer', 'hollow', 'framer', 'ringer'];
    g.spawnWave(kinds.map((kind, i) => ({ kind, x: p.x + Math.cos(i) * 60, y: p.y + Math.sin(i) * 40 })));
    window.__ft = [];
    let last = performance.now();
    const loop = () => {
      const n = performance.now();
      window.__ft.push(n - last);
      last = n;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  // бой: удары, уклонения, сдвиги, мышь по кругу
  for (let i = 0; i < cfg.actions; i++) {
    await page.mouse.move(576 + Math.cos(i) * 260, 324 + Math.sin(i) * 160);
    await page.keyboard.press('j');
    if (i % 5 === 0) await page.keyboard.press('k');
    if (i % 7 === 0) await page.keyboard.press('q');
    await page.waitForTimeout(90);
  }
  const r = await page.evaluate(() => {
    const t = window.__ft.slice(10).sort((a, b) => a - b);
    const n = t.length;
    return { frames: n, med: t[n >> 1], p95: t[Math.floor(n * 0.95)], max: t[n - 1], over100: t.filter((x) => x > 100).length };
  });
  const lim = { ...cfg.limits, ...(cfg.rooms_limits?.[room] || {}) };
  const ok = r.med <= lim.median && r.p95 <= lim.p95 && r.over100 <= lim.over100 && !errors.length;
  if (!ok) failed = true;
  rows.push({ room, ...r, ok, errors: errors.slice(0, 2) });
  await ctx.close();
}
await browser.close();

const fmt = (v) => v.toFixed(1);
const lines = [
  `### Плавность в бою (ЦП ×${cfg.cpuThrottle})`,
  '',
  '| Комната | Кадров | Медиана, мс | p95, мс | max, мс | >100 мс | Итог |',
  '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.room} | ${r.frames} | ${fmt(r.med)} | ${fmt(r.p95)} | ${fmt(r.max)} | ${r.over100} | ${r.ok ? '✅' : '❌'} |`),
  '',
  `Пороги: медиана ≤ ${cfg.limits.median} мс, p95 ≤ ${cfg.limits.p95} мс, кадров >100 мс ≤ ${cfg.limits.over100}.`,
];
console.log(lines.join('\n'));
for (const r of rows) if (r.errors.length) console.log(`${r.room}: ошибки страницы — ${r.errors.join(' | ')}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
process.exit(failed ? 1 : 0);
