import { test, expect } from '@playwright/test';

// Первая встреча с врагом: бой замирает, карточка объясняет Шрам, Отпечаток и как бить; второй раз — нет.
test('bestiary_card: карточка Пустокожего при первой встрече, затем бой идёт', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?room=shadowArena');
  await page.waitForFunction(() => window.__abf?.game?.player);
  await page.evaluate(() => {
    window.__abfBestiary = true;
    const g = window.__abf.game;
    g.flags.seenFoes = { shadow: true };
    g.spawnEnemy('hollow', g.player.x + 40, g.player.y, { spawn: 0 });
  });
  await expect(page.locator('.dialogue')).toContainText('Пустокожий', { timeout: 6000 });
  expect(await page.evaluate(() => window.__abf.game.cinematic)).toBe(true);
  for (let i = 0; i < 8 && (await page.evaluate(() => !!window.__abf.game.ui.mode)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  expect(await page.evaluate(() => window.__abf.save.flags.seenFoes.hollow)).toBe(true);
  expect(await page.evaluate(() => window.__abf.game.cinematic)).toBe(false);
});
