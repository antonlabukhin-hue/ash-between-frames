import { test, expect } from '@playwright/test';

// Разорванная дорога 4.2: настоящими клавишами и мышью — три камня по очереди, через провал без падений.
test('torn_stone_chain: прицел на следующий камень не гасит предыдущий, дорога проходится', async ({ page }) => {
  await page.goto('/?room=tornRoad');
  await page.waitForFunction(() => window.__abf?.game?.player);
  const ev = (f, a) => page.evaluate(f, a);
  let falls = 0;
  const steer = async (tx, ty, ms) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const s = await ev(() => ({ x: window.__abf.game.player.x, y: window.__abf.game.player.y, f: window.__abf.game.player.falling > 0 }));
      if (s.f) falls++;
      const dx = tx - s.x;
      const dy = ty - s.y;
      if (Math.hypot(dx, dy) < 4) break;
      for (const k of ['w', 'a', 's', 'd']) await page.keyboard.up(k);
      if (dy < -3) await page.keyboard.down('w');
      if (dy > 3) await page.keyboard.down('s');
      if (dx < -3) await page.keyboard.down('a');
      if (dx > 3) await page.keyboard.down('d');
      await page.waitForTimeout(70);
    }
    for (const k of ['w', 'a', 's', 'd']) await page.keyboard.up(k);
  };
  const aimAt = async (wx, wy) => {
    const r = await ev(([wx, wy]) => {
      const g = window.__abf.game;
      const c = document.querySelector('canvas').getBoundingClientRect();
      const W = window.__abf.renderer?.W || 384;
      const H = window.__abf.renderer?.H || 216;
      return [c.left + ((wx - g.cam.x) / W) * c.width, c.top + ((wy - g.cam.y) / H) * c.height];
    }, [wx, wy]);
    await page.mouse.move(r[0], r[1]);
  };
  await steer(120, 162, 3000);
  await page.waitForTimeout(5500); // стирание дошло до берега
  for (const [i, next] of [[0, 200], [1, 280], [2, 340]]) {
    const s = await ev((i) => ({ x: window.__abf.game.tornStones[i].x, y: window.__abf.game.tornStones[i].y }), i);
    await aimAt(s.x, s.y - 8);
    await page.waitForTimeout(250);
    expect(await ev((i) => window.__abf.game.player.shiftTarget?.obj === window.__abf.game.tornStones[i], i)).toBe(true);
    await page.keyboard.press('q');
    await page.waitForTimeout(900);
    await steer(next, 162, 3500);
  }
  await steer(400, 162, 3000);
  expect(falls).toBe(0);
  expect(await ev(() => window.__abf.game.player.x)).toBeGreaterThan(384);
});
