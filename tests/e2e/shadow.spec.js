import { test, expect } from '@playwright/test';

// Звонкая Тень 4.6: победа без урона от волны — воспоминание «Песня звонаря»; с уроном — нет.
const fight = async (page, hitByWave) => {
  await page.goto('/?room=shadowArena');
  await page.waitForFunction(() => window.__abf?.game?.shadowBoss && window.__abf.game.shadowBoss.spawn <= 0, null, { timeout: 10000 });
  await page.evaluate((hit) => {
    const g = window.__abf.game;
    g.save.memories = [];
    if (hit) g.room.def.onHeroHurt(g, 'ring');
    g.damageEnemy(g.shadowBoss, 99999, { pure: true });
  }, hitByWave);
  for (let i = 0; i < 30 && !(await page.evaluate(() => window.__abf.game.flags.shadowDone)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  return page.evaluate(() => window.__abf.save.memories.includes('ringerSong'));
};

test('shadow_song: без урона от волны Тень оставляет «Песню звонаря»', async ({ page }) => {
  expect(await fight(page, false)).toBe(true);
});
test('shadow_song_hit: задела волна — песни нет', async ({ page }) => {
  expect(await fight(page, true)).toBe(false);
});
