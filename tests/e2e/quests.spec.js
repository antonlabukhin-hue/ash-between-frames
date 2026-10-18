import { test, expect } from '@playwright/test';

// Квесты главы и четвёртый финал (docs/TIME_DESIGN.md, 4.9–4.10).
const go = async (page, room, setup) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?room=${room}`);
  await page.waitForFunction(() => window.__abf?.game?.room && window.__abf.game.player);
  if (setup) await page.evaluate(setup);
};
// листать реплики, пока не появится выбор или не кончится разговор
const until = async (page, fn, n = 40) => {
  for (let i = 0; i < n && !(await page.evaluate(fn)); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(220);
  }
};

test('last_ring: с «Песней звонаря» и «Праздником фонарей» открыт четвёртый финал, воспоминания отданы', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto('/?room=under');
  await page.waitForFunction(() => window.__abf?.game?.room);
  await page.evaluate(() => {
    const s = window.__abf.save;
    s.memories = ['ringerSong', 'lanternFeast'];
  });
  await until(page, () => window.__abf.game.ui.mode === 'choice');
  await page.getByText('Позвонить в последний раз').click();
  await page.waitForFunction(() => window.__abf.game.flags.bellChoice === 'lastRing');
  const s = await page.evaluate(() => ({ mem: window.__abf.save.memories, spent: window.__abf.save.spentMemories }));
  expect(s.mem).toEqual([]);
  expect(s.spent).toEqual(expect.arrayContaining(['ringerSong', 'lanternFeast']));
});

test('dog_name: жетон и миска — пса можно назвать Громом', async ({ page }) => {
  await go(page, 'kitchen', () => {
    const g = window.__abf.game;
    g.save.memories = ['dogTag', 'dogBowl'];
  });
  await page.evaluate(() => {
    const g = window.__abf.game;
    const dog = g.props.find((o) => o.prompt === 'Погладить Старого Пса');
    g.player.x = dog.x;
    g.player.y = dog.y + 12;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.prompt === 'Погладить Старого Пса');
  await page.keyboard.press('e');
  await until(page, () => window.__abf.game.ui.mode === 'choice');
  await page.getByText('Гром', { exact: true }).click();
  await page.waitForFunction(() => window.__abf.game.flags.dogNamed);
});

test('boy_found: кепка из тайника возвращает Маре имя сына', async ({ page }) => {
  await go(page, 'kitchen', () => {
    const f = window.__abf.game.flags;
    f.maraQuest = true;
    f.vaultTaken = true;
  });
  await page.evaluate(() => {
    const g = window.__abf.game;
    const m = g.props.find((o) => o.prompt === 'Поговорить с Марой');
    g.player.x = m.x;
    g.player.y = m.y + 12;
  });
  await page.waitForFunction(() => window.__abf.game.interactTarget?.prompt === 'Поговорить с Марой');
  await page.keyboard.press('e');
  await until(page, () => window.__abf.game.flags.boyFound);
  expect(await page.evaluate(() => window.__abf.game.flags.boyFound)).toBe(true);
});
