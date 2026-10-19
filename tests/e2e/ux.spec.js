import { test, expect } from '@playwright/test';

// UX-проверки по игровому аудиту. Действия игрока — настоящие клавиши, мышь и касания;
// отладочный API только расставляет сцену и читает состояние.
const ready = (page) => page.waitForFunction(() => window.__abf);

async function freshGame(page) {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Новая игра' }).click();
}

test('intro_caption_skip: первое нажатие раскрывает цитату, второе закрывает', async ({ page }) => {
  await freshGame(page);
  const cap = page.locator('.caption');
  await expect(cap).toHaveClass(/show/, { timeout: 5000 });
  await expect(cap).toContainText('нажмите, чтобы продолжить');
  await page.keyboard.press('Enter');
  await expect(cap).toHaveClass(/instant/);
  await page.waitForTimeout(150);
  const t0 = Date.now();
  await page.keyboard.press('Enter');
  await expect(cap).not.toHaveClass(/show/, { timeout: 1500 });
  await page.waitForFunction(() => !window.__abf.game.cinematic, null, { timeout: 4000 });
  expect(Date.now() - t0).toBeLessThan(4000);
});

test('interact_near_sign: идём по дороге и жмём E — указатель осматривается', async ({ page }) => {
  await freshGame(page);
  await expect(page.locator('.caption')).toHaveClass(/show/, { timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__abf.game.cinematic && window.__abf.game.flags.introSeen, null, { timeout: 6000 });
  const prompt = page.locator('#ui > .prompt');
  // естественная траектория: просто вверх по дороге, пока не появится подсказка
  await page.keyboard.down('w');
  await expect(prompt).toContainText('Осмотреть указатель', { timeout: 6000 });
  // табличка над указателем: имя и действие с клавишей
  await expect(page.locator('.plate:not(.hidden)').first()).toContainText('Осмотреть указатель');
  await page.keyboard.up('w');
  const x = await page.evaluate(() => window.__abf.game.player.x);
  expect(x).toBeGreaterThan(192); // герой остался на дороге, не сворачивал к указателю
  expect(x).toBeLessThan(288);
  await page.keyboard.press('e');
  await expect(page.locator('.dialogue')).toContainText('КОЛОКОЛЬНЫЕ', { timeout: 3000 });
});

for (const [w, h] of [[844, 390], [667, 375]]) {
  test(`choice_clears_transient_ui ${w}x${h}: под выбором нет старых подсказок`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await ready(page);
    await page.evaluate(async () => {
      const A = window.__abf;
      await A.shot('camp');
      A.ui.banner('Чужой привал', 'тест');
      A.ui.hint('Старая подсказка', 30);
      A.ui.caption('Старая цитата');
      A.game.choose('Дорога удержит только одно воспоминание.', [
        { text: 'Оставить Арно', sub: 'Сена исчезнет' },
        { text: 'Оставить Сену', sub: 'Арно исчезнет' },
        { text: 'Сохранить обоих', sub: 'Нужен обрывок имени', disabled: true },
      ]);
    });
    await expect(page.locator('.choices')).toBeVisible();
    await expect(page.locator('.modal-dim')).toBeVisible();
    await expect(page.locator('.hint')).toHaveClass(/off|away/); // спрятана на время выбора
    await expect(page.locator('.banner')).not.toHaveClass(/show/);
    await expect(page.locator('.caption')).not.toHaveClass(/show/);
    await expect(page.locator('#ui > .prompt')).toBeHidden();
    await expect(page.locator('.plate:not(.hidden)')).toHaveCount(0);
    await expect(page.locator('.choices .btn.locked')).toBeDisabled();
    const box = await page.locator('.choices').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(h);
    expect(box.x + box.width).toBeLessThanOrEqual(w);
    // выбор работает
    await page.locator('.choices .btn').first().click();
    await expect(page.locator('.choices')).toHaveCount(0);
    await expect(page.locator('.modal-dim')).toHaveCount(0);
  });
}

// Экранные координаты точки мира (для настоящей мыши).
async function screenOf(page, wx, wy) {
  return page.evaluate(([wx, wy]) => {
    const { game, renderer } = window.__abf;
    return [renderer.ox + (wx - game.cam.x) * renderer.cssScale, renderer.oy + (wy - game.cam.y) * renderer.cssScale];
  }, [wx, wy]);
}

test('target_enemy_over_nearby_prop: Q выбирает врага, на которого смотришь, а не мост рядом', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    const A = window.__abf;
    await A.shot('road', (g) => {
      const br = g.props.find((o) => o.kind === 'bridge');
      g.player.x = 240;
      g.player.y = br.y + br.h + 30;
      const e = g.spawnEnemy('hollow', g.player.x - 60, g.player.y, { spawn: 0 });
      e.stun = 99;
    });
  });
  const py = await page.evaluate(() => window.__abf.game.player.y);
  const [sx, sy] = await screenOf(page, 240 - 60, py - 8);
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => window.__abf.game.player.shiftTarget?.obj.kind);
  expect(r).toBe('hollow');
  await expect(page.locator('#ui > .prompt')).toContainText('Пустокожий');
  await expect(page.locator('.plate:not(.hidden)', { hasText: 'Пустокожий' })).toBeVisible();
  // смотрим на мост — цель меняется на мост
  const bc = await page.evaluate(() => {
    const br = window.__abf.game.props.find((o) => o.kind === 'bridge');
    return br.y + br.h / 2;
  });
  const [bx, by] = await screenOf(page, 240, bc);
  await page.mouse.move(bx, by);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__abf.game.player.shiftTarget?.obj.kind)).toBe('bridge');
  await expect(page.locator('#ui > .prompt')).toContainText('мост');
});

test('target_mouse_left_right: мышь справа и слева разворачивает прицел и цель', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    const A = window.__abf;
    await A.shot('ruins', (g) => {
      g.enemies = [];
      g.player.x = 240;
      g.player.y = 250;
      for (const dx of [-50, 50]) g.spawnEnemy('hollow', 240 + dx, 250, { spawn: 0 }).stun = 99;
    });
  });
  const [rx, ry] = await screenOf(page, 330, 242);
  await page.mouse.move(rx, ry);
  await page.waitForTimeout(150);
  const right = await page.evaluate(() => ({ aim: window.__abf.game.player.aim, tx: window.__abf.game.player.shiftTarget?.obj.x }));
  expect(Math.abs(right.aim)).toBeLessThan(0.3);
  expect(right.tx).toBeGreaterThan(240);
  const [lx, ly] = await screenOf(page, 150, 242);
  await page.mouse.move(lx, ly);
  await page.waitForTimeout(150);
  const left = await page.evaluate(() => ({ aim: window.__abf.game.player.aim, tx: window.__abf.game.player.shiftTarget?.obj.x }));
  expect(Math.abs(Math.abs(left.aim) - Math.PI)).toBeLessThan(0.3);
  expect(left.tx).toBeLessThan(240);
  // клик без движения тоже задаёт прицел
  await page.mouse.click(rx, ry);
  await page.waitForTimeout(100);
  expect(Math.abs(await page.evaluate(() => window.__abf.game.player.aim))).toBeLessThan(0.3);
});

test.describe('телефон', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('touch_buttons_hidden_in_choice: во время выбора и диалога боевых кнопок нет', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => window.__abf.shot('camp'));
    await expect(page.locator('.tbtn.attack')).toBeVisible();
    await page.evaluate(() => {
      window.__abf.game.choose('Выбор', [{ text: 'Да' }, { text: 'Нет' }]);
    });
    await expect(page.locator('.tbtn.attack')).toBeHidden();
    await expect(page.locator('.tbtn.shift')).toBeHidden();
    await page.locator('.choices .btn').first().tap();
    await expect(page.locator('.tbtn.attack')).toBeVisible();
    await page.evaluate(() => {
      window.__abf.game.say([{ who: 'Тик', text: 'Проверка' }]);
    });
    await expect(page.locator('.tbtn.attack')).toBeHidden();
  });
});

test('hint_click_to_close: подсказка висит, пока по ней не нажмут; следующая ждёт в очереди', async ({ page }) => {
  await page.goto('/?room=kitchen');
  await page.waitForFunction(() => window.__abf?.game?.player);
  await page.waitForFunction(() => !window.__abf.game.cinematic && !window.__abf.ui.mode, null, { timeout: 8000 });
  await page.evaluate(() => {
    const ui = window.__abf.ui;
    ui.hint('Первая подсказка');
    ui.hint('Вторая подсказка');
  });
  const hint = page.locator('.hint');
  await page.waitForTimeout(6000);
  await expect(hint).not.toHaveClass(/off/);
  await expect(hint).toContainText('Первая');
  await expect(hint).toContainText('ещё 1');
  await hint.click();
  await expect(hint).toContainText('Вторая');
  await hint.click();
  await expect(hint).toHaveClass(/off/);
});
