import { test, expect } from '@playwright/test';

// Привал 4.3: после спора записку показывают Сене в разговоре — остаются оба; без записки
// можно вернуться за ней на Разорванную дорогу.
const flip = async (page, fn, n = 40) => {
  for (let i = 0; i < n && !(await page.evaluate(fn)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  }
};
const toScene = async (page) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.goto('/?room=camp');
  await page.waitForFunction(() => window.__abf?.game?.campNpc);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.flags.talkedArno = true;
    const f = g.campNpc.fire;
    f.tl.phase = 'past';
    f.tl.left = Infinity;
    f.onShift(g, f, 'past');
  });
  await flip(page, () => window.__abf.game.campNpc.sena.prompt === 'Поговорить с Сеной');
};

test('camp_note: показать Сене записку из дневника — остаются оба', async ({ page }) => {
  await toScene(page);
  await page.evaluate(() => {
    const g = window.__abf.game;
    g.save.memories.push('nameScrap');
    const s = g.campNpc.sena;
    g.player.x = s.x;
    g.player.y = s.y + 12;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget === window.__abf.game.campNpc.sena);
  await page.keyboard.press('e');
  await flip(page, () => window.__abf.game.ui.mode === 'choice');
  await page.getByText('Записка «…но, жди у ворот»').click();
  await flip(page, () => window.__abf.game.flags.camp);
  expect(await page.evaluate(() => window.__abf.game.flags.camp)).toBe('both');
});

test('camp_back: без записки с привала можно вернуться на Разорванную дорогу', async ({ page }) => {
  await toScene(page);
  await page.evaluate(() => {
    const g = window.__abf.game;
    const ex = g.exits.find((e) => e.to === 'tornRoad');
    g.player.x = ex.rect.x + 8;
    g.player.y = ex.rect.y + 8;
  });
  await page.waitForFunction(() => window.__abf.game.room?.id === 'tornRoad', null, { timeout: 8000 });
  const x = await page.evaluate(() => window.__abf.game.player.x);
  expect(x).toBeGreaterThan(400);
});
