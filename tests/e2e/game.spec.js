import { test, expect } from '@playwright/test';

const ready = (page) => page.waitForFunction(() => window.__abf);

async function newGame(page) {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  await page.getByRole('button', { name: 'Новая игра' }).click();
}

test('пролог: чёрный экран с подписью, потом дорога и движение', async ({ page }) => {
  await newGame(page);
  await expect(page.locator('.caption')).toContainText('произошло ли оно', { timeout: 6000 });
  await expect(page.locator('.fade')).toHaveClass(/on/);
  await page.waitForFunction(() => window.__abf.game.flags.introSeen && !window.__abf.game.cinematic, null, { timeout: 15000 });
  // дорога идёт вверх, к воротам
  const y0 = await page.evaluate(() => window.__abf.game.player.y);
  await page.keyboard.down('w');
  await page.waitForTimeout(600);
  await page.keyboard.up('w');
  const y1 = await page.evaluate(() => window.__abf.game.player.y);
  expect(y0 - y1).toBeGreaterThan(25);
  await expect(page.locator('.hint')).toContainText('идти');
});

test('смена состояния: мост проходим только в прошлом, падение возвращает на край', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const r = await page.evaluate(async () => {
    const A = window.__abf;
    await A.shot('road');
    const g = A.game;
    const p = g.player;
    // провал — ряды 18–21 поперёк дороги, мост над ним
    p.x = 240;
    p.y = 23 * 16 + 6;
    A.input.inject('up', true);
    await A.sleep(450);
    A.input.inject('up', false);
    await A.sleep(800);
    const fell = { y: p.y, hp: p.hp };
    p.y = 22 * 16 + 4;
    p.aim = -Math.PI / 2;
    await A.sleep(100);
    A.input.tap('shift');
    await A.sleep(1000);
    const phase = g.props.find((o) => o.kind === 'bridge').tl.phase;
    A.input.inject('up', true);
    await A.sleep(1300);
    A.input.inject('up', false);
    return { fell, phase, crossed: p.y < 17 * 16, charges: p.charges.n };
  });
  expect(r.fell.y).toBeGreaterThan(22 * 16);
  expect(r.fell.hp).toBe(90);
  expect(r.phase).toBe('past');
  expect(r.crossed).toBe(true);
  expect(r.charges).toBe(2);
});

test('бой: удары убивают Пустокожего, точный удар сильнее', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const r = await page.evaluate(async () => {
    const A = window.__abf;
    await A.shot('ruins');
    const g = A.game;
    g.enemies = [];
    const p = g.player;
    const e = g.spawnEnemy('hollow', p.x + 14, p.y, { spawn: 0 });
    e.stun = 99;
    A.input.tap('attack');
    await A.sleep(80);
    const afterFirst = e.hp;
    await A.sleep(270);
    A.input.tap('attack');
    await A.sleep(120);
    return { afterFirst, afterSecond: e.hp, dead: e.dead };
  });
  expect(35 - r.afterFirst).toBe(12);
  expect(r.afterFirst - r.afterSecond).toBeGreaterThan(12);
});

test('сохранение: после перехода в комнату «Продолжить» ведёт туда же', async ({ page }) => {
  await newGame(page);
  await page.evaluate(async () => {
    const A = window.__abf;
    await A.sleep(500);
    A.game.flags.introSeen = true;
    await A.game.transition('camp');
  });
  await page.reload();
  await ready(page);
  const cont = page.getByRole('button', { name: 'Продолжить' });
  await expect(cont).toBeEnabled();
  await cont.click();
  await page.waitForFunction(() => window.__abf.game.room?.id === 'camp');
});

test('смерть: экран «Тебя стёрло» и возврат к началу комнаты', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(async () => {
    const A = window.__abf;
    await A.shot('ruins');
    A.game.player.hp = 1;
    A.game.hurtPlayer(10, 0, 0, 'test');
  });
  await expect(page.getByText('Тебя стёрло')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: 'Вспомнить себя' }).click();
  await page.waitForFunction(() => window.__abf.game.player && !window.__abf.game.player.dead && window.__abf.game.player.hp > 1);
});

test('пауза по Esc останавливает мир', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.evaluate(() => window.__abf.shot('kitchen'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Пауза' })).toBeVisible();
  const t0 = await page.evaluate(() => window.__abf.game.time);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__abf.game.time)).toBe(t0);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Пауза' })).toBeHidden();
});

test.describe('телефон', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  test('сенсорные кнопки в игре и стик двигает героя', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await expect(page.locator('.tbtn.attack')).toBeHidden();
    await page.evaluate(() => window.__abf.shot('kitchen'));
    await expect(page.locator('.tbtn.attack')).toBeVisible();
    await expect(page.locator('.tbtn.shift')).toBeVisible();
    const box = await page.locator('.stick-zone').boundingBox();
    const x0 = await page.evaluate(() => window.__abf.game.player.x);
    const sx = box.x + box.width / 2;
    const sy = box.y + box.height / 2;
    await page.evaluate(([x, y]) => {
      const z = document.querySelector('.stick-zone');
      const ev = (type, cx) => z.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: cx, clientY: y, bubbles: true, pointerType: 'touch' }));
      ev('pointerdown', x);
      ev('pointermove', x + 60);
      window.__stickUp = () => ev('pointerup', x + 60);
    }, [sx, sy]);
    await page.waitForTimeout(500);
    await page.evaluate(() => window.__stickUp());
    const x1 = await page.evaluate(() => window.__abf.game.player.x);
    expect(x1 - x0).toBeGreaterThan(15);
  });

  test('смерть с зажатой кнопкой удара: «Вспомнить себя» и «В главное меню» срабатывают по касанию', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await page.evaluate(() => window.__abf.shot('kitchen'));
    // палец держит кнопку удара, когда героя стирает
    const atk = page.locator('.tbtn.attack');
    const b = await atk.boundingBox();
    await page.evaluate(([x, y]) => {
      const el = document.querySelector('.tbtn.attack');
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
      window.__abf.game.player.hp = 1;
      window.__abf.game.hurtPlayer(10, 0, 0, 'test');
    }, [b.x + b.width / 2, b.y + b.height / 2]);
    await expect(page.getByText('Тебя стёрло')).toBeVisible({ timeout: 5000 });
    await expect(atk).toBeHidden();
    await page.getByRole('button', { name: 'Вспомнить себя' }).tap();
    await page.waitForFunction(() => window.__abf.game.player && !window.__abf.game.player.dead && window.__abf.game.player.hp > 1);
    await page.evaluate(() => {
      window.__abf.game.player.hp = 1;
      window.__abf.game.hurtPlayer(10, 0, 0, 'test');
    });
    await page.getByRole('button', { name: 'В главное меню' }).tap({ timeout: 5000 });
    await page.waitForFunction(() => window.__abf.game.scene === 'title');
  });
});
