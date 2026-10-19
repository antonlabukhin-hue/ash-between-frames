import { test, expect } from '@playwright/test';

// Разговор с меню тем: Мальчику можно показать воспоминание в любой раз, разговор не начинается заново.
const flipTo = async (page, mode) => {
  for (let i = 0; i < 20 && (await page.evaluate(() => window.__abf.game.ui.mode)) !== mode; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
};
const pick = (page, text) => page.locator('.choices .btn', { hasText: text }).first().click();

test('boy_talk: показать воспоминание дважды, второй разговор — с короткого приветствия', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?room=square');
  await page.waitForFunction(() => window.__abf?.game?.statue);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.squareDone = true;
    g.save.memories = ['lanternFeast', 'fair'];
    g.statue.tl.phase = 'past';
    g.statue.tl.left = Infinity;
  });
  const talk = async () => {
    await page.evaluate(() => { window.__abf.game.statue.onInteract(); });
    await flipTo(page, 'choice');
  };
  await talk();
  await pick(page, 'Показать воспоминание');
  await pick(page, 'Ярмарка у ворот'); // не то воспоминание — мальчик не помнит
  await flipTo(page, 'choice');
  expect(await page.evaluate(() => window.__abf.game.flags.boyQuest)).toBeFalsy();
  await pick(page, 'Показать воспоминание');
  await pick(page, 'Праздник фонарей');
  await flipTo(page, 'choice');
  expect(await page.evaluate(() => window.__abf.game.flags.boyQuest)).toBe(true);
  await pick(page, 'Уйти');
  // второй разговор: короткое приветствие и новая тема про мать
  await page.evaluate(() => { window.__abf.game.statue.onInteract(); });
  await expect(page.locator('.dialogue')).toContainText('Ты вернулся');
  await flipTo(page, 'choice');
  await expect(page.locator('.choices')).toContainText('Где искать его мать?');
  await pick(page, 'Показать воспоминание');
  await pick(page, 'Праздник фонарей');
  await expect(page.locator('.dialogue')).toContainText('Это он');
});
