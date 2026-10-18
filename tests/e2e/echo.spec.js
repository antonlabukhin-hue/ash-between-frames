import { test, expect } from '@playwright/test';

// Эхо (П4): тень повторяет запись и держит плиту прошлого, пока герой проходит верхний пролёт.
test('echo_plate: Эхо на плите-противовесе раскладывает верхний пролёт, потом тень уходит', async ({ page }) => {
  await page.goto('/?room=stairs');
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  const st = () =>
    page.evaluate(() => {
      const g = window.__abf.game;
      return { top: g.stairProps[3].tl.phase, plate: g.stairPlate.tl.phase, shade: !!g.echoShade, rec: !!g.player.echoRec, n: g.player.charges.n };
    });
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.echoUnlocked = true;
    g.ui.closeAll?.();
    const pl = g.stairPlate;
    g.player.x = pl.x + 8;
    g.player.y = pl.y + 9;
  });
  await page.waitForTimeout(300);
  // герой на плите прошлого не держит её
  expect((await st()).plate).toBe('present');
  const n0 = (await st()).n;
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  expect((await st()).rec).toBe(true);
  expect((await st()).n).toBe(n0 - 1);
  await page.waitForTimeout(800);
  await page.keyboard.press('r');
  await page.waitForFunction(() => window.__abf.game.echoShade);
  await page.waitForFunction(() => window.__abf.game.stairProps[3].tl.phase === 'present', null, { timeout: 2000 });
  expect((await st()).plate).toBe('past');
  // тень держит вес ещё ECHO_LINGER секунд и уходит — пролёт складывается
  await page.waitForFunction(() => !window.__abf.game.echoShade, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__abf.game.stairProps[3].tl.phase === 'past', null, { timeout: 2000 });
});
