import { test, expect } from '@playwright/test';

// Переносной свет (П2): фонарь привратника берут, несут — в его ореоле проступает призрак.
test('carry_lantern_aura: зажжённый фонарь в руках открывает остров, в нём виден привратник', async ({ page }) => {
  await page.goto('/?room=square');
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  await page.waitForFunction(() => !window.__abf.game.cinematic, null, { timeout: 8000 });
  const lan = await page.evaluate(() => {
    const g = window.__abf.game;
    const l = g.props.find((o) => o.kind === 'handLantern');
    l.tl.phase = 'past';
    l.tl.left = Infinity;
    g.player.x = l.x - 6;
    g.player.y = l.y;
    return { x: l.x, y: l.y };
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.kind === 'handLantern');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__abf.game.player.carry?.kind === 'handLantern');
  // удар не бьёт, а ставит фонарь обратно
  const keeperHidden = () => page.evaluate(() => window.__abf.game.props.find((o) => o.prompt === 'Окликнуть привратника').hidden);
  expect(await keeperHidden()).toBe(true);
  await page.evaluate(() => {
    const g = window.__abf.game;
    // остров идёт вместе с фонарём: переносим и его, иначе герой провалится в трещину у ворот
    const isl = g.islandState.get(g.player.carry.id);
    isl.x = 285;
    isl.y = 113;
    g.player.x = 280;
    g.player.y = 112;
  });
  await page.waitForTimeout(700);
  expect(await keeperHidden()).toBe(false);
  await page.waitForFunction(() => window.__abf.game.interactTarget?.prompt === 'Окликнуть привратника');
  await page.keyboard.press('j');
  await page.waitForFunction(() => !window.__abf.game.player.carry);
  expect(lan).toBeTruthy();
});
