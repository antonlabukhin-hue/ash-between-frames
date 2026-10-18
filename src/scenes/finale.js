// Колокольня (босс), выбор под площадью, убежище и вылазки.
import { grid, fill, put, ellipse, scatter, rows, T, TOP } from './mapkit.js';
import { key } from './keys.js';
import { setupMel, makeGlyphs, drawHazards } from '../enemies/boss.js';
import { drawTik, drawMara, drawDog, drawGhost } from '../art/sprites.js';
import { P } from '../art/palette.js';
import { PAST } from '../timeline/timeline.js';
import { burst } from '../world/fx.js';
import { hasFragment } from '../items/fragments.js';
import { mulberry32 } from '../core/math.js';
import { killEnemy } from '../enemies/enemies.js';

const REN = (text) => ({ who: 'Рен', text, portrait: 'ren', style: 'white' });
const TIK = (text) => ({ who: 'Тик', text, portrait: 'tik' });
const MARA = (text) => ({ who: 'Мара', text, portrait: 'mara' });

const npc = (g, drawFn, x, y, o = {}) => g.addProp('npc', x, y, { drawFn, markY: 26, ...o });

// ── 7. Колокольня ───────────────────────────────────────────────────
function belfryMap() {
  const m = grid(32, 24, ' ');
  ellipse(m, 16, 12, 13.5, 9.5, '+');
  fill(m, 15, 20, 3, 4, '+');
  put(m, 16, 22, '@');
  for (let x = 0; x < 32; x++) {
    m[0][x] = '#';
    m[23][x] = m[23][x] === '+' || m[23][x] === '@' ? m[23][x] : '#';
  }
  return rows(m);
}

export const belfry = {
  id: 'belfry',
  title: 'Брат Мел',
  weather: { rain: 0.4, fog: 'moon', fogA: 0.22 },
  subtitle: 'Звонарь без башни',
  music: 'boss',
  dark: 0.55,
  floor: '+',
  map: belfryMap(),
  facing: -Math.PI / 2,
  glitch: 0.03,
  setup(g) {
    for (const [x, y] of [[6, 7], [26, 7], [4, 14], [28, 14], [10, 19], [22, 19]]) g.addProp('candles', T(x), TOP(y + 1));
  },
  drawFloor(g, ctx) {
    drawHazards(g, ctx);
  },
  async script(g) {
    if (g.flags.melDone) {
      g.transition('under');
      return;
    }
    const cx = T(16);
    const cy = TOP(11);
    const boss = setupMel(g, cx, cy);
    makeGlyphs(g, boss, [[T(5), T(13)], [T(27), T(13)]]);
    g.ui.setBoss('Брат Мел', 'звонарь без башни');
    boss.onDefeat = async () => {
      await g.wait(1.5);
      g.flags.melDone = true;
      g.persist();
      // «Песня звонаря» (карта 4.8): Мел вспомнил, зачем звонил, — прощание мягче
      if (g.flags.melSong) await g.say([{ who: 'Брат Мел', text: 'Праздничный звон… Позвони его за меня, Смотритель. Один раз. Для них.', portrait: 'mel' }]);
      await g.say([{ who: '', text: 'Колокол срывается с чёрной нити и уходит вниз, сквозь площадь. Снизу слышны голоса.' }]);
      g.transition('under');
    };
    boss.cinematic = true;
    await g.wait(1);
    await g.say([
      { who: 'Брат Мел', text: 'Ещё один час. Кто-то должен помнить, который час.', portrait: 'mel', style: 'scar' },
      REN('Часов больше нет, Мел.'),
      { who: 'Брат Мел', text: 'Тогда тем более.', portrait: 'mel', style: 'scar' },
    ]);
    boss.cinematic = false;
    g.hint(`Колокол тоже можно сдвинуть (${key(g, 'shift')}): в прошлом он бьёт медленной большой волной, в настоящем — быстрой малой. Волну, отправленную назад, колокол примет обратно.`, 9);
  },
};

// ── 8. Под площадью: финальный выбор ─────────────────────────────────
function underMap() {
  const m = grid(20, 11);
  fill(m, 1, 1, 18, 9, '.');
  put(m, 10, 8, '@');
  return rows(m);
}

export const under = {
  id: 'under',
  title: 'Под площадью',
  weather: { fog: 'cold', fogA: 0.3 },
  music: 'hub',
  dark: 0.6,
  map: underMap(),
  facing: -Math.PI / 2,
  setup(g) {
    g.villagers = [[5, 4], [8, 3], [12, 3], [15, 4], [7, 6], [13, 6]].map(([x, y], i) =>
      g.addProp('ghostNpc', T(x), TOP(y + 1), { drawFn: drawGhost, drawOpts: { hat: i % 3 === 0, dress: i % 2 === 1, color: P.milk, alpha: 0.7 } }),
    );
    for (const [x, y] of [[2, 2], [17, 2], [2, 8], [17, 8]]) g.addProp('candles', T(x), TOP(y + 1));
  },
  async script(g) {
    if (g.flags.bellChoice) {
      g.transition('kitchen', '@');
      return;
    }
    await g.wait(0.8);
    const VIL = (t) => ({ who: 'Жители', text: t, portrait: 'villager' });
    await g.say([
      { who: '', text: 'Под площадью — люди. Застрявшие в старой версии города, в вечере перед праздником.' },
      VIL('Звон кончился? Значит, нас наконец можно забыть?'),
      REN('Колокол держит город. Но он же держит вас здесь.'),
    ]);
    const shard = hasFragment(g.save, 'bellShard');
    const i = await g.choose('Что сохранить?', [
      { text: 'Спасти людей', sub: 'Колокол рухнет окончательно. В убежище появятся новые лица.' },
      { text: 'Сохранить колокол', sub: 'Город останется ориентиром. Браслет получит лишний заряд. Жители исчезнут.' },
      { text: 'Расколоть колокол', sub: shard ? 'Трещина колокола: часть жителей спасётся, часть звона станет твоей.' : 'Нужен осколок из тайника на лестнице', disabled: !shard },
    ]);
    const choice = ['people', 'bell', 'split'][i];
    g.flags.bellChoice = choice;
    if (choice === 'bell') {
      g.save.upgrades.charges = (g.save.upgrades.charges || 0) + 1;
      for (const v of g.villagers) {
        burst(g, v.x, v.y - 10, [P.milk, P.ink], 14, 40);
        v.hidden = true;
      }
      g.audio.sfx.bell(196);
    } else if (choice === 'split') {
      g.save.upgrades.charges = (g.save.upgrades.charges || 0) + 1;
      g.villagers.slice(3).forEach((v) => {
        burst(g, v.x, v.y - 10, [P.milk, P.ink], 14, 40);
        v.hidden = true;
      });
      g.save.fragments = g.save.fragments.filter((f) => f !== 'bellShard');
      g.audio.sfx.bell(262, true);
    } else {
      g.audio.sfx.heal();
    }
    g.save.chapterDone = true;
    g.persist();
    await g.wait(0.8);
    const after = {
      people: [VIL('Мы пойдём за тобой. Куда угодно, где есть стол и окно.')],
      bell: [{ who: '', text: 'Жители рассыпаются тихо, как пепел. Где-то наверху колокол бьёт один раз — для тех, кто ещё не стёрт.' }],
      split: [VIL('Половина звона — это тоже звон. Спасибо.'), { who: '', text: 'Осколок колокола тёплый. Он помнит удар.' }],
    };
    await g.say(after[choice]);
    g.transition('kitchen', '@');
  },
};

// ── Убежище: Кухня Последнего Дня ───────────────────────────────────
function kitchenMap() {
  const m = grid(22, 13);
  fill(m, 1, 2, 20, 10, 'w');
  put(m, 11, 10, '@');
  return rows(m);
}

const UPGRADES = [
  { id: 'hp', name: 'Запас здоровья', desc: '+20 к здоровью', max: 3, cost: (lv) => ({ ash: 40 + lv * 30 }) },
  { id: 'charges', name: 'Заряд браслета', desc: '+1 заряд смены состояния', max: 2, cost: (lv) => ({ shards: 3 + lv * 2 }) },
];

export const kitchen = {
  id: 'kitchen',
  title: 'Кухня Последнего Дня',
  weather: { fog: 'amber', fogA: 0.1 },
  subtitle: 'Убежище',
  music: 'hub',
  dark: 0.3,
  floor: 'w',
  map: kitchenMap(),
  facing: -Math.PI / 2,
  setup(g) {
    const f = g.flags;
    g.addProp('window', T(15), TOP(2) - 2, { bell: f.bellChoice === 'bell' || f.bellChoice === 'split' });
    const saved = 2 + (f.camp ? 1 : 0) + (f.camp === 'both' ? 1 : 0) + (f.bellChoice === 'people' ? 2 : f.bellChoice === 'split' ? 1 : 0);
    const portraits = g.addProp('portraits', T(7), TOP(2) - 3, { count: saved });
    void portraits;
    const shelf = g.addProp('shelf', T(19), TOP(2) - 4, { cups: 2 + g.save.items.length });
    void shelf;
    const stove = g.addProp('stove', T(3), TOP(4) + 4, { prompt: 'Печь — улучшения', markY: 44, reach: 6 });
    stove.onInteract = () => openStove(g);
    const table = g.addProp('table', T(11), TOP(6) + 6, { prompt: 'Стол Смотрителя — вылазка', reach: 8 });
    table.onInteract = () => openTable(g);
    const box = g.addProp('box', T(18), TOP(9), { prompt: 'Ящик с обрывками' });
    box.onInteract = () => readRecords(g);
    const mara = npc(g, drawMara, T(6), TOP(8), { prompt: 'Поговорить с Марой' });
    mara.onInteract = () => talkMara(g);
    const tik = npc(g, drawTik, T(14), TOP(5), { prompt: 'Поговорить с Тиком' });
    tik.onInteract = () => talkTik(g);
    const dog = npc(g, drawDog, T(17), TOP(6), { prompt: 'Погладить Старого Пса' });
    dog.onInteract = async () => {
      g.audio.sfx.heal();
      await g.say([{ who: 'Старый Пёс', text: 'Пёс существует только в настоящем. Но хвост у него виляет так, будто он тебя узнал.', portrait: 'dog' }]);
    };
    if (f.camp === 'arno' || f.camp === 'both') {
      const a = g.addProp('ghostNpc', T(4), TOP(11), { drawFn: drawGhost, drawOpts: { hat: true, alpha: 0.85 }, prompt: 'Поговорить с Арно', markY: 26 });
      a.onInteract = () => g.say([{ who: 'Арно', text: f.camp === 'both' ? 'Сена говорит, что я храплю. Значит, я есть.' : 'Здесь пахнет хлебом. Я и забыл, что так бывает.', portrait: 'arno' }]);
    }
    if (f.camp === 'sena' || f.camp === 'both') {
      const s = g.addProp('ghostNpc', T(8), TOP(11), { drawFn: drawGhost, drawOpts: { dress: true, color: P.amberHi, alpha: 0.85 }, prompt: 'Поговорить с Сеной', markY: 26 });
      s.onInteract = () => g.say([{ who: 'Сена', text: 'Я помню дорогу за двоих. Если пойдёшь снова — спрашивай.', portrait: 'sena' }]);
    }
    if (f.bellChoice === 'people' || f.bellChoice === 'split') {
      const n = f.bellChoice === 'people' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const v = g.addProp('ghostNpc', T(13 + i * 3), TOP(11), { drawFn: drawGhost, drawOpts: { color: P.milk, alpha: 0.85, hat: i === 0 }, prompt: 'Поговорить с жителем', markY: 26 });
        v.onInteract = () => g.say([{ who: 'Житель Колокольных Ворот', text: i === 0 ? 'Тесно, зато все на своих местах.' : 'Я помню, как звучал праздник. Хочешь, напою?', portrait: 'villager' }]);
      }
    }
  },
  async script(g) {
    // смерть вне главы — восстановить здоровье в убежище
    g.player.hp = g.player.maxHp;
    if (g.flags.chapterEndSeen || !g.save.chapterDone) return;
    g.flags.chapterEndSeen = true;
    await g.wait(1);
    if (g.flags.bellChoice === 'people') await g.say([MARA('Кухня стала теснее. Это хорошо. Пустые кухни хуже пустых дорог.')]);
    else if (g.flags.bellChoice === 'bell') {
      g.audio.sfx.bell(196, true);
      await g.wait(1.5);
      await g.say([{ who: '', text: 'Из окна слышен один удар колокола, хотя города уже не видно.' }]);
    } else await g.say([MARA('Половина города лучше, чем никакого. Садись, ешь.')]);
    await g.say([
      { who: '', text: 'Тик долго рассматривает браслет. На нём появился новый знак — маленькое лицо.' },
      TIK('Нулевая Свеча тебя узнала.'),
      REN('Она уже знала меня.'),
    ]);
    g.cinematic = true;
    await g.ui.fade(true);
    g.ui.caption('В пустой рамке на шее Рена\nвпервые проступает лицо.\n\nЭто лицо Брата Мела.');
    g.audio.sfx.bell(147, true);
    await g.wait(5);
    g.ui.caption('Конец первой главы');
    await g.wait(3);
    g.ui.caption(null);
    await g.wait(0.8);
    g.cinematic = false;
    await g.ui.fade(false);
    g.persist();
    g.hint('Стол Смотрителя — вылазки за золой. Печь — улучшения.', 6);
  },
};

async function talkMara(g) {
  const lines = g.save.chapterDone
    ? [MARA('Ешь. Мир не перестанет стираться от того, что ты голоден.'), MARA('Если будешь в руинах — приноси золу. Печь её любит.')]
    : [MARA('Ты рано. Кухня ещё не проснулась.')];
  await g.say(lines);
  if (g.player.hp < g.player.maxHp) g.heal(g.player.maxHp);
}

async function talkTik(g) {
  await g.say([
    TIK('Мир не сломан. Его переписали поверх самого себя. Где-то под Шрамом всё ещё лежит Отпечаток.'),
    TIK('Точные удары ускоряют твой браслет. Идеальные уклонения — открывают Окно Эха: следующий удар сам меняет состояние врага.'),
    TIK('Три точных удара подряд — разлом. Полный разлом (пробел) переворачивает всё вокруг разом.'),
  ]);
}

async function readRecords(g) {
  const recs = [
    'Хранители Последовательности следили, чтобы у каждого события было начало, причина и последствие.',
    'Нулевую Свечу зажгли, чтобы сжечь один-единственный конец света. Она начала с имён.',
    'Сначала исчезли мелочи: песни, запахи, привычки. Потом — дороги.',
  ];
  await g.say(recs.map((t) => ({ who: 'Обрывок', text: t })));
}

function openStove(g) {
  const s = g.save;
  const items = UPGRADES.map((u) => {
    const lv = s.upgrades[u.id] || 0;
    const cost = u.cost(lv);
    const afford = (cost.ash ?? 0) <= s.ash && (cost.shards ?? 0) <= s.shards;
    const price = cost.ash ? `${cost.ash} золы` : `${cost.shards} осколков`;
    return {
      text: `${u.name} · ${lv}/${u.max}`,
      sub: lv >= u.max ? 'Предел' : `${u.desc} — ${price}`,
      disabled: lv >= u.max || !afford,
      on: () => {
        s.ash -= cost.ash ?? 0;
        s.shards -= cost.shards ?? 0;
        s.upgrades[u.id] = lv + 1;
        if (u.id === 'hp') {
          g.player.maxHp += 20;
          g.player.hp = g.player.maxHp;
        } else {
          g.player.charges.max += 1;
          g.player.charges.n = g.player.charges.max;
        }
        g.persist();
        g.audio.sfx.shard();
        openStove(g);
      },
    };
  });
  items.push({ text: 'Отойти', on: () => closeMenu(g) });
  g.cinematic = true;
  g.ui.menu({ title: `Печь · зола ${s.ash} · осколки ${s.shards}`, items, back: () => closeMenu(g) });
}

function closeMenu(g) {
  g.ui.closeMenu();
  g.cinematic = false;
  g.input.clear();
}

function openTable(g) {
  const items = [
    { text: 'Вылазка: Пепельные руины', sub: 'Волны врагов и Звонкая Тень в конце. Зола и осколки.', on: () => startSortie(g) },
    { text: 'Остаться на кухне', on: () => closeMenu(g) },
  ];
  g.cinematic = true;
  g.ui.menu({ title: 'Стол Смотрителя', items, back: () => closeMenu(g) });
}

function startSortie(g) {
  closeMenu(g);
  g.save.fragments = g.save.fragments.filter((f) => f === 'bellShard');
  g.sortieSeed = Math.floor(Math.random() * 1e6);
  g.transition('ruins');
}

// ── Вылазка: Пепельные руины ────────────────────────────────────────
// Обычные боевые комнаты собираются из модулей, сюжетные — нет.
function ruinsMap() {
  const m = grid(30, 20);
  fill(m, 1, 1, 28, 18, '.');
  scatter(m, 77, 1, 1, 28, 18, '.', ',', 0.3);
  fill(m, 10, 6, 10, 8, ':');
  put(m, 15, 18, '@');
  fill(m, 14, 0, 2, 1, '>');
  return rows(m);
}

const WAVE_POOL = [
  [['hollow', 3]],
  [['hollow', 2], ['ringer', 1]],
  [['framer', 2], ['hollow', 1]],
  [['ringer', 2], ['framer', 1], ['hollow', 1]],
  [['hollow', 2], ['framer', 1], ['ringer', 1], ['eater', 1]],
];

export const ruins = {
  id: 'ruins',
  title: 'Пепельные руины',
  weather: { rain: 1, fog: 'cold', fogA: 0.35, leaves: 10 },
  subtitle: 'Вылазка',
  music: 'road',
  dark: 0.5,
  map: ruinsMap(),
  under: { '>': '.' },
  checkpoint: false,
  facing: -Math.PI / 2,
  exits: [{ marker: '>', to: 'kitchen', gate: true }],
  setup(g, room) {
    const rnd = mulberry32(g.sortieSeed ?? 1);
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(rnd() * 26);
      const y = 2 + Math.floor(rnd() * 15);
      if (x > 8 && x < 21 && y > 4 && y < 15) continue;
      g.addProp(rnd() > 0.5 ? 'pillar' : 'grave', T(x), TOP(y + 1), { tall: 30, broken: true });
    }
    g.addProp('lantern', T(7), TOP(5));
    g.addProp('lantern', T(22), TOP(15));
    g.addProp('memoryStone', T(15), TOP(10) + 4);
    // плиты исчезают по очереди
    room.flickerStart = 0;
    const period = 8;
    room.flickerOn = (gg, tx, ty) => {
      const grp = ((tx >> 1) + (ty >> 1)) & 1;
      const t = (gg.time + grp * period / 2) % period;
      return t >= period - 3;
    };
    room.flickerState = (gg, tx, ty) => {
      const grp = ((tx >> 1) + (ty >> 1)) & 1;
      const t = (gg.time + grp * period / 2) % period;
      if (t >= period - 3) return room.flickerOn(gg, tx, ty) && !protectedTile(gg, tx, ty) ? 'void' : 'solid';
      if (t >= period - 4) return protectedTile(gg, tx, ty) ? 'solid' : 'warn';
      return 'solid';
    };
  },
  update(g) {
    for (const e of g.enemies) {
      if (!e.dead && e.spawn <= 0 && e.kind !== 'shadow' && e.kind !== 'echo' && g.room && isPitAt(g, e)) killEnemy(g, e);
    }
    const s = g.shadowBoss;
    if (s) g.bossBar = s.dead ? null : { hp: Math.max(0, s.hp), max: s.maxHp };
  },
  async script(g) {
    const rnd = mulberry32((g.sortieSeed ?? 1) + 5);
    const spots = [[4, 4], [25, 4], [4, 15], [25, 15], [15, 3], [8, 10], [22, 10]];
    for (let w = 0; w < WAVE_POOL.length; w++) {
      await g.wait(w === 0 ? 1.5 : 1.2);
      g.toast(`Волна ${w + 1} из ${WAVE_POOL.length + 1}`, 1.6);
      const list = [];
      for (const [kind, n] of WAVE_POOL[w]) {
        for (let i = 0; i < n; i++) {
          const [x, y] = spots[Math.floor(rnd() * spots.length)];
          list.push({ kind, x: T(x) + (rnd() - 0.5) * 20, y: T(y) + (rnd() - 0.5) * 20, o: { base: rnd() > 0.8 ? PAST : undefined } });
        }
      }
      g.spawnWave(list);
      await g.waitUntil(() => g.clearedRoom());
      if (w === 2) g.spawnPickup('fragment', T(15), T(16), { id: ['firstStep', 'quietFrame', 'backHeat'][Math.floor(rnd() * 3)], vx: 0, vy: 0 });
      if (w % 2 === 1) g.spawnPickup('heal', T(15), T(16), { amount: 30, vx: 0, vy: 0 });
    }
    await g.wait(1.2);
    g.toast('Последняя волна: Звонкая Тень', 2);
    const s = g.spawnEnemy('shadow', T(15), T(5), { spawn: 1.4, hp: 220 });
    g.shadowBoss = s;
    g.ui.setBoss('Звонкая Тень', 'вылазка');
    await g.waitUntil(() => s.dead);
    g.ui.setBoss(null);
    g.bossBar = null;
    g.voidZones = [];
    g.enemies.forEach((e) => killEnemy(g, e));
    for (let i = 0; i < 15; i++) g.spawnPickup('ash', T(15) + (Math.random() - 0.5) * 40, T(9));
    g.toast('Руины затихли. Проход к убежищу открыт.', 3);
    g.openExits(true);
  },
};

function protectedTile(g, tx, ty) {
  const cx = tx * 16 + 8;
  const cy = ty * 16 + 8;
  for (const p of g.props) {
    const r = p.def.protect?.[p.tl.phase];
    if (r && Math.hypot(cx - p.x, cy - p.y) < r) return true;
  }
  return false;
}

function isPitAt(g, e) {
  const tx = Math.floor(e.x / 16);
  const ty = Math.floor(e.y / 16);
  const t = g.room.tiles[ty * g.room.w + tx];
  return t === 6 && g.room.flickerState(g, tx, ty) === 'void';
}
