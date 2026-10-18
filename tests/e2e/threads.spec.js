import { test, expect } from '@playwright/test';

// Нити причин (П3): котёл в прошлом кипит над горящим костром — пар поднимает заслонку погреба.
test('thread_chain: котёл без огня не тянет, с огнём — заслонка открыта и в погреб можно спуститься', async ({ page }) => {
  await page.goto('/?room=camp');
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.camp = 'both';
  });
  const phase = () => page.evaluate(() => window.__abf.game.props.find((o) => o.kind === 'hatch').tl.phase);
  await page.evaluate(() => {
    const k = window.__abf.game.props.find((o) => o.kind === 'kettle');
    k.tl.phase = 'past';
    k.tl.left = 7;
  });
  await page.waitForTimeout(300);
  expect(await phase()).toBe('present');
  await page.evaluate(() => {
    const g = window.__abf.game;
    const f = g.props.find((o) => o.kind === 'campfire');
    f.tl.phase = 'past';
    f.tl.left = Infinity;
  });
  await page.waitForFunction(() => window.__abf.game.props.find((o) => o.kind === 'hatch').tl.phase === 'past');
  await page.evaluate(() => {
    const g = window.__abf.game;
    const h = g.props.find((o) => o.kind === 'hatch');
    g.player.x = h.x + 10;
    g.player.y = h.y + h.h + 6;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.kind === 'hatch');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__abf.game.flags.cellarLooted);
  // закрыть записку из погреба
  for (let i = 0; i < 4 && (await page.evaluate(() => !!window.__abf.game.ui.mode || window.__abf.game.cinematic)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
  }
  // котёл остыл — заслонка закрывается
  await page.evaluate(() => {
    const k = window.__abf.game.props.find((o) => o.kind === 'kettle');
    k.tl.left = 0.01;
  });
  await page.waitForTimeout(400);
  expect(await phase()).toBe('present');
});
