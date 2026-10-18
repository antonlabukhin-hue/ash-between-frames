import { test, expect } from '@playwright/test';

// Площадь 4.4: тайник под мостовой — в ореоле двух фонарей; ворота открывает привратник.
const open = async (page) => {
  await page.goto('/?room=square');
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  await page.waitForFunction(() => !window.__abf.game.cinematic, null, { timeout: 8000 });
};
const closeTalk = async (page) => {
  for (let i = 0; i < 24 && (await page.evaluate(() => !!window.__abf.game.ui.mode || window.__abf.game.cinematic)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
};

test('square_vault: плита тайника открывается только в ореоле двух фонарей', async ({ page }) => {
  await open(page);
  const vault = () => page.evaluate(() => window.__abf.game.squareVault.tl.phase);
  const light = (n) =>
    page.evaluate((n) => {
      const g = window.__abf.game;
      g.lanterns.slice(0, n).forEach((l) => {
        l.tl.phase = 'past';
        l.tl.left = Infinity;
      });
    }, n);
  await light(1);
  await page.waitForTimeout(700);
  expect(await vault()).toBe('present');
  await light(2);
  await page.waitForFunction(() => window.__abf.game.squareVault.tl.phase === 'past');
  await page.evaluate(() => {
    const g = window.__abf.game;
    const v = g.squareVault;
    g.player.x = v.x + 10;
    g.player.y = v.y + v.h + 5;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget === window.__abf.game.squareVault);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__abf.game.flags.vaultTaken);
});

test('square_keeper_gate: после осады привратник в свете фонаря открывает ворота', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.squareDone = true;
    const l = g.props.find((o) => o.kind === 'handLantern');
    l.tl.phase = 'past';
    l.tl.left = Infinity;
    g.pickUp(l);
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    const g = window.__abf.game;
    const isl = g.islandState.get(g.player.carry.id);
    isl.x = 285;
    isl.y = 113;
    g.player.x = 280;
    g.player.y = 112;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.prompt === 'Окликнуть привратника', null, { timeout: 4000 });
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  await closeTalk(page);
  expect(await page.evaluate(() => window.__abf.game.flags.keeperOpened)).toBe(true);
});
