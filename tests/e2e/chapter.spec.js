import { test, expect } from '@playwright/test';

// Сквозной проход главы 1 «роботом»: ищем тупики в сценариях комнат.
test('глава 1 проходится от пролога до убежища', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await page.waitForFunction(() => window.__abf);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__abf);
  const visited = await page.evaluate(async () => {
    const A = window.__abf;
    const g = A.game;
    const errors = [];
    window.addEventListener('error', (e) => errors.push(e.message));
    // фоновый «игрок»: листает диалоги, выбирает первый доступный вариант, лечится
    const bot = setInterval(() => {
      if (A.ui.mode === 'dialogue') A.input.tap('confirm');
      if (A.ui.mode === 'choice') document.querySelector('.choices .btn:not([disabled])')?.click();
      if (g.player && !g.player.dead) g.player.hp = g.player.maxHp;
    }, 120);
    const until = async (pred, ms = 20000, what = '') => {
      const t0 = performance.now();
      while (!pred()) {
        if (performance.now() - t0 > ms) {
          const st = { enemies: g.enemies.map((e) => `${e.kind}:${Math.round(e.hp)}:${e.spawn > 0 ? 's' : ''}`), lit: g.squareLit, lanterns: g.lanterns?.map((l) => l.tl.phase), mode: A.ui.mode, cin: g.cinematic, waves: g.squareWaves };
          throw new Error(`Ждали: ${what} в ${g.room?.id} ${JSON.stringify(st)}`);
        }
        await A.sleep(100);
      }
    };
    const T = (t) => t * 16 + 8;
    const tp = (x, y) => {
      g.player.x = x;
      g.player.y = y;
    };
    const killAll = () => {
      for (const e of g.enemies) {
        if (e.kind === 'shadow') e.exposed = 9;
        g.damageEnemy(e, 9999, { pure: true });
      }
    };
    const shift = async (obj) => {
      const [cx, cy] = obj.def?.flat ? [obj.x + obj.w / 2, obj.y + obj.h / 2] : [obj.x, obj.y];
      const before = obj.tl.phase;
      for (let i = 0; i < 4 && obj.tl.phase === before; i++) {
        tp(cx, cy + 14);
        g.player.charges.n = g.player.charges.max;
        await A.sleep(120);
        A.input.tap('shift');
        await A.sleep(1100);
      }
    };
    const exitTo = async (next) => {
      await until(() => g.exits.some((e) => e.open), 30000, 'открытого выхода');
      const ex = g.exits.find((e) => e.open);
      tp(ex.rect.x + 8, ex.rect.y + 8);
      await until(() => g.room?.id === next, 8000, `перехода в ${next}`);
      await A.sleep(600);
    };
    const seen = [];

    await A.startGame('road');
    seen.push(g.room.id);
    await until(() => g.flags.introSeen && !g.cinematic, 15000, 'пролога');
    const sign = g.props.find((o) => o.kind === 'sign');
    tp(sign.x, sign.y + 14);
    await A.sleep(200);
    A.input.tap('interact');
    await until(() => g.flags.signRead, 8000, 'указателя');
    await shift(sign);
    await until(() => g.flags.metTik, 15000, 'Тика');
    tp(240, g.props.find((o) => o.kind === 'bridge').y - 40);
    await until(() => g.enemies.length > 0 && g.enemies[0].spawn <= 0, 10000, 'Пустокожего');
    killAll();
    await exitTo('tornRoad');

    seen.push(g.room.id);
    tp(T(8), T(9));
    await until(() => g.enemies.length >= 3, 10000, 'волны');
    await A.sleep(1200);
    killAll();
    await until(() => g.pickups.some((p) => p.kind === 'fragment'), 10000, 'фрагмента');
    await exitTo('camp');

    seen.push(g.room.id);
    const { arno, fire } = g.campNpc;
    tp(arno.x + 4, arno.y + 12);
    await A.sleep(200);
    A.input.tap('interact');
    await until(() => g.flags.talkedArno, 8000, 'Арно');
    await shift(fire);
    await until(() => g.flags.camp, 20000, 'выбора на привале');
    await exitTo('square');

    seen.push(g.room.id);
    await shift(g.statue);
    await until(() => g.squareWaves, 15000, 'пробуждения статуи');
    for (let i = 0; i < 2; i++) {
      await until(() => g.enemies.length > 0 && g.enemies.every((e) => e.spawn <= 0), 15000, `волны ${i + 1}`);
      killAll();
      await A.sleep(1500);
    }
    // волны отбиты — теперь импульс никто не сбивает
    for (const l of g.lanterns.slice(0, 2)) await shift(l);
    await until(() => g.flags.squareDone, 20000, 'окончания площади');
    await exitTo('stairs');

    seen.push(g.room.id);
    for (const s of g.stairProps) {
      await shift(s);
      tp(s.x + 32, s.y - 6);
      await A.sleep(300);
      killAll();
    }
    await exitTo('shadowArena');

    seen.push(g.room.id);
    await until(() => g.shadowBoss && g.shadowBoss.spawn <= 0, 10000, 'Звонкой Тени');
    killAll();
    await until(() => g.flags.shadowDone, 15000, 'победы над Тенью');
    await exitTo('ascent');

    seen.push(g.room.id);
    const mara = g.props.find((o) => o.prompt === 'Поговорить с Марой');
    tp(mara.x, mara.y + 14);
    await A.sleep(200);
    A.input.tap('interact');
    await until(() => g.flags.bread, 10000, 'хлеба Мары');
    await exitTo('belfry');

    seen.push(g.room.id);
    await until(() => g.boss && !g.boss.cinematic, 15000, 'Брата Мела');
    g.boss.hp = 640;
    await until(() => g.boss.phase === 2, 5000, 'фазы 2');
    g.boss.hp = 300;
    await until(() => g.boss.phase === 3 && !g.boss.cinematic, 15000, 'фазы 3');
    g.boss.hp = 0;
    await until(() => g.room.id === 'under', 20000, 'спуска под площадь');

    seen.push(g.room.id);
    await until(() => g.room.id === 'kitchen', 25000, 'убежища');
    seen.push(g.room.id);
    await until(() => g.flags.chapterEndSeen && !g.cinematic, 30000, 'финальной сцены');
    clearInterval(bot);
    return { seen, errors, done: A.save.chapterDone, choice: g.flags.bellChoice, abilities: [g.flags.abSpark, g.flags.abSeam, g.flags.abShade] };
  });
  expect(visited.errors).toEqual([]);
  expect(visited.seen).toEqual(['road', 'tornRoad', 'camp', 'square', 'stairs', 'shadowArena', 'ascent', 'belfry', 'under', 'kitchen']);
  expect(visited.done).toBe(true);
  expect(visited.abilities).toEqual([true, true, true]);
});
