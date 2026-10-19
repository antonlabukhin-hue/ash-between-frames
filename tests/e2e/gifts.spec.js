import { test, expect } from '@playwright/test';

// Дары спасённых: Арно на Кухне отдаёт «Фитиль» — +1 заряд браслета, один раз.
test('kitchen_gift: Арно дарит Фитиль, заряд браслета растёт', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?room=kitchen');
  await page.waitForFunction(() => window.__abf?.game?.player);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.camp = 'both';
    g.save.chapterDone = true;
    g.flags.chapterEndSeen = true;
    g.loadRoom('kitchen');
  });
  await page.waitForTimeout(600);
  const max0 = await page.evaluate(() => window.__abf.game.player.charges.max);
  await page.evaluate(() => {
    const a = window.__abf.game.props.find((o) => o.name === 'Арно');
    a.onInteract();
  });
  for (let i = 0; i < 12 && !(await page.evaluate(() => window.__abf.save.upgrades.wick)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(220);
  }
  expect(await page.evaluate(() => window.__abf.save.upgrades.wick)).toBe(true);
  expect(await page.evaluate(() => window.__abf.game.player.charges.max)).toBe(max0 + 1);
  await expect(page.locator('.card')).toContainText('Фитиль');
});
