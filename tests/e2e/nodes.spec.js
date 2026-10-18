import { test, expect } from '@playwright/test';

// Узлы памяти (П6): отдать воспоминание — мост тракта цел навсегда, а сцена торговцев уходит.
test('memory_node_bridge: закрепить мост воспоминанием «Ярмарка у ворот»', async ({ page }) => {
  await page.goto('/?room=road');
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.save.memories = ['fair'];
    g.ui.closeAll?.();
    g.cinematic = false;
    const n = g.props.find((o) => o.kind === 'memoryNode');
    g.player.x = n.x + n.w / 2;
    g.player.y = n.y + n.h + 4;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.kind === 'memoryNode', null, { timeout: 5000 });
  await page.keyboard.press('e');
  // пояснение Узла → выбор цены
  await page.waitForTimeout(400);
  for (let i = 0; i < 3 && !(await page.locator('.choice, .choices').first().isVisible().catch(() => false)) && (await page.evaluate(() => window.__abf.game.ui.mode)) !== 'choice'; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
  }
  await page.getByText('Отдать «Ярмарка у ворот»').click();
  await page.waitForFunction(() => window.__abf.save.fixed?.bridge);
  const st = await page.evaluate(() => {
    const g = window.__abf.game;
    const b = g.props.find((o) => o.kind === 'bridge');
    return { phase: b.tl.phase, base: b.tl.base, sw: b.tl.switchable, mem: g.save.memories, spent: g.save.spentMemories };
  });
  expect(st).toMatchObject({ phase: 'past', base: 'past', sw: false, mem: [], spent: ['fair'] });
  // после перезахода мост всё ещё цел, а сцены торговцев нет
  await page.evaluate(() => window.__abf.game.loadRoom?.('road'));
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => {
    const g = window.__abf.game;
    return { phase: g.props.find((o) => o.kind === 'bridge').tl.phase, scenes: g.scenes.filter((s) => s.memory === 'fair').length };
  });
  expect(again).toEqual({ phase: 'past', scenes: 0 });
});
