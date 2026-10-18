import { test, expect } from '@playwright/test';

// Падение в разлом: герой возвращается на надёжную землю один раз, а не падает снова и снова.
test('fall_respawn: после падения в стёртую дорогу — на берег, урон один раз', async ({ page }) => {
  await page.goto('/?room=tornRoad');
  await page.waitForFunction(() => window.__abf?.game?.player);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.room.flickerStart = g.time - 30; // дорога уже стёрта
    // точка возврата — на плите, которая потом стёрлась (как в игре)
    g.player.lastSafe = { x: 200, y: 162 };
    g.player.x = 200;
    g.player.y = 162;
  });
  await page.waitForTimeout(3000);
  const s = await page.evaluate(async () => {
    const { isPit } = await import('/src/world/world.js');
    const g = window.__abf.game;
    const p = g.player;
    return { hp: p.hp, max: p.maxHp, falling: p.falling > 0, pit: isPit(g, p.x, p.y), x: p.x, dead: p.dead };
  });
  expect(s.dead).toBe(false);
  expect(s.falling).toBe(false);
  expect(s.pit).toBe(false);
  expect(s.max - s.hp).toBeLessThanOrEqual(15);
});
