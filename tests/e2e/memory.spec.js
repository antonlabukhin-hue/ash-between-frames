import { test, expect } from '@playwright/test';

// Воспоминания (П5): досмотренная сцена прошлого у указателя попадает в дневник.
const ready = (page) => page.waitForFunction(() => window.__abf);

test('past_scene_memory: досмотреть сцену у указателя в прошлом — воспоминание «Ярмарка у ворот»', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.waitForFunction(() => window.__abf.game.player && window.__abf.game.room);
  // пропустить вступление
  await page.waitForTimeout(400);
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__abf.game.cinematic)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => !window.__abf.game.cinematic, null, { timeout: 6000 });
  await page.evaluate(() => {
    const g = window.__abf.game;
    const sign = g.props.find((o) => o.kind === 'sign');
    g.player.x = sign.x + 10;
    g.player.y = sign.y + 24;
    sign.tl.phase = 'past';
    sign.tl.left = 60;
  });
  await expect(page.locator('.bark').first()).toContainText('Торговец', { timeout: 3000 });
  await page.waitForFunction(() => window.__abf.save.memories?.includes('fair'), null, { timeout: 12000 });
  await expect(page.locator('#card, .card').first()).toContainText('Ярмарка у ворот');
});
