// Глава 1: «Колокол, который не помнит удара». Сюжетные комнаты поставлены вручную.
import { grid, fill, put, scatter, rows, T, TOP } from './mapkit.js';
import { key } from './keys.js';
import { drawTik, drawMara, drawGhost, drawDog } from '../art/sprites.js';
import { P } from '../art/palette.js';
import { PAST, PRESENT } from '../timeline/timeline.js';
import { burst, ringFx, addText } from '../world/fx.js';
import { isPit } from '../world/world.js';
import { killEnemy } from '../enemies/enemies.js';
import { dist } from '../core/math.js';
import { unlockAbility } from '../player/abilities.js';
import { SQ, drawSquareParallax, pastAt, drawStillOne, drawGarland, drawVillager } from '../art/level01.js';
import { paintSquare as paintSquareV1, drawSquareParallax as drawSquareParallaxV1 } from '../art/level01_v1.js';
import { paintTarget, inFissure, G as G16 } from '../art/square16.js';
import { updateIslands, inIslands } from '../world/memory.js';
import { atlas } from '../art/spritecache.js';
import { blit } from '../art/atlas.js';
import { line, px } from '../art/sprites.js';

const REN = (text) => ({ who: 'Рен', text, portrait: 'ren', style: 'white' });
const TIK = (text) => ({ who: 'Тик', text, portrait: 'tik' });
const NOTE = (text) => ({ who: '', text });

function npc(g, drawFn, x, y, o = {}) {
  return g.addProp('npc', x, y, { drawFn, markY: 26, ...o });
}

// Стирающиеся плиты: две группы по очереди уходят в пустоту.
function makeFlicker(room, period = 9, bands = 3) {
  const slot = period / bands;
  const phaseAt = (g, tx, ty) => {
    if (room.flickerStart == null || g.time < room.flickerStart) return 'solid';
    const grp = Math.floor(tx / 3) % bands;
    const t = (g.time - room.flickerStart) % period;
    const start = grp * slot;
    if (t >= start && t < start + slot) return 'void';
    const before = (start - t + period) % period;
    if (before <= 1.2) return 'warn';
    return 'solid';
  };
  room.flickerOn = (g, tx, ty) => phaseAt(g, tx, ty) === 'void';
  room.flickerState = (g, tx, ty) => {
    const s = phaseAt(g, tx, ty);
    if (s === 'void' && !room.flickerOn(g, tx, ty)) return 'solid';
    // камень памяти удерживает плиты рядом — не показываем пустоту
    if (s !== 'solid') {
      const cx = tx * 16 + 8;
      const cy = ty * 16 + 8;
      for (const p of g.props) {
        const r = p.def.protect?.[p.tl.phase];
        if (r && dist(cx, cy, p.x, p.y) < r) return 'solid';
      }
    }
    return s;
  };
}

// Враги, стоящие на исчезнувшем полу, стираются.
function eraseEnemiesInPits(g) {
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0 || e.kind === 'shadow' || e.kind === 'echo') continue;
    if (isPit(g, e.x, e.y)) {
      addText(g, e.x, e.y - 20, 'стёрт', P.crimsonHi);
      killEnemy(g, e);
    }
  }
}

// ── 0. Затухший тракт ───────────────────────────────────────────────
function roadMap() {
  const m = grid(56, 15);
  fill(m, 1, 1, 54, 13, ',');
  scatter(m, 3, 1, 1, 54, 5, ',', '"', 0.45);
  scatter(m, 4, 1, 10, 54, 4, ',', '"', 0.45);
  fill(m, 1, 6, 54, 3, '=');
  fill(m, 32, 1, 4, 13, ' ');
  fill(m, 55, 6, 1, 3, '>');
  put(m, 3, 7, '@');
  return rows(m);
}

export const road = {
  id: 'road',
  title: 'Затухший тракт',
  subtitle: 'Глава 1 · Колокол, который не помнит удара',
  music: 'road',
  dark: 0.32,
  floor: ',',
  under: { '>': '=', '@': '=' },
  map: roadMap(),
  facing: 0,
  exits: [{ marker: '>', to: 'tornRoad', gate: true }],
  holdFade: (g) => !g.flags.introSeen,
  setup(g) {
    // декор: осенние деревья, знамёна, надгробия
    for (const [x, y] of [[2, 2], [6, 3], [13, 2], [19, 12], [24, 3], [27, 12], [40, 2], [44, 12], [50, 3]]) g.addProp('tree', T(x), TOP(y + 1));
    for (const [x, y] of [[30, 3], [37, 11], [38, 3]]) g.addProp('deadTree', T(x), TOP(y + 1));
    g.addProp('banner', T(4), TOP(6) - 2);
    g.addProp('banner', T(14), TOP(6) - 2);
    for (const [x, y] of [[9, 11], [11, 12], [47, 11], [29, 11]]) g.addProp('grave', T(x), TOP(y + 1));
    for (const [x, y] of [[16, 10], [42, 4]]) g.addProp('rubble', T(x), TOP(y + 1));

    const sign = g.addProp('sign', T(9), TOP(6) - 1, { prompt: 'Осмотреть указатель', markY: 32 });
    sign.onInteract = async () => {
      await g.say([NOTE('Указатель: «КОЛОКОЛЬНЫЕ ВО…» Последние буквы дрожат и меняются каждый кадр, будто их кто-то стирает.')]);
      g.flags.signRead = true;
    };
    sign.onShift = (gg, s, phase) => {
      if (phase === PAST) g.flags.signShifted = true;
    };

    g.addProp('bridge', TOP(32), TOP(6) - 4, { w: 64, h: 56 });
    const chest = g.addProp('chest', T(21), TOP(4) - 2, { prompt: 'Открыть сундук' });
    chest.onInteract = () => {
      chest.open = true;
      chest.onInteract = null;
      g.audio.sfx.chest();
      for (let i = 0; i < 6; i++) g.spawnPickup('ash', chest.x, chest.y + 4);
      g.spawnPickup('shard', chest.x, chest.y + 6);
    };
    for (let i = 0; i < 5; i++) g.spawnPickup('ash', T(13 + i * 1.5), T(7) + (i % 2) * 6, { vx: 0, vy: 0 });

    g.tik = npc(g, drawTik, T(12), TOP(10), { hidden: true, prompt: 'Поговорить с Тиком' });
    g.tik.onInteract = async () => {
      await g.say([TIK('Отпечаток — каким вещь была. Шрам — какой стала. Ты не чинишь мир, ты одалживаешь у прошлого. На время.')]);
    };
  },
  async script(g) {
    const ui = g.ui;
    const p = g.player;
    if (!g.flags.introSeen) {
      g.cinematic = true;
      ui.fade(true);
      await g.wait(0.8);
      g.audio.sfx.bell(196);
      await g.wait(1.4);
      ui.caption('«Если событие никто не помнит,\nпроизошло ли оно?»');
      await g.wait(4);
      ui.caption(null);
      await g.wait(1.2);
      g.flags.introSeen = true;
      g.cinematic = false;
      await ui.fade(false);
    }
    g.hint(`${key(g, 'move')} — идти по дороге`, 5);
    await g.waitUntil(() => p.x > T(6));
    if (!g.flags.signRead) {
      g.hint(`${key(g, 'interact')} — осмотреть указатель`, 6);
      await g.waitUntil(() => g.flags.signRead);
    }
    if (!g.flags.signShifted) {
      g.hint(`${key(g, 'shift')} — коснуться браслета: вещь ненадолго вспомнит, какой была`, 8);
      await g.waitUntil(() => g.flags.signShifted);
    }
    ui.clearHint();
    await g.wait(1.4);
    if (!g.flags.metTik) {
      g.tik.hidden = false;
      burst(g, g.tik.x, g.tik.y - 8, [P.brass, P.amberHi, P.milk], 16, 40);
      g.audio.sfx.shift(PAST);
      await g.wait(0.4);
      await g.say([
        REN('Я уже был здесь?'),
        TIK('Нет. Но это место помнит, что ты был.'),
        TIK('Я Тик. Считаю секунды, которые ещё не украли.'),
        TIK('Твой браслет вытаскивает из вещей их прошлое — Отпечаток. Ненадолго: потом возвращается Шрам.'),
        TIK('Каждое касание стоит огонёк заряда. Огоньки возвращаются сами, а быстрее — от точных ударов.'),
        TIK('И подбирай золу. Здесь это единственное, что ещё чего-то стоит.'),
      ]);
      g.flags.metTik = true;
      g.persist();
    } else g.tik.hidden = false;

    await g.waitUntil(() => p.x > T(26));
    const bridge = g.props.find((o) => o.kind === 'bridge');
    if (bridge.tl.phase !== PAST) g.hint(`Мост помнит, что был целым. Подойди к обрыву и нажми ${key(g, 'shift')}. Успей перейти, пока не вернулся Шрам.`, 8);
    await g.waitUntil(() => p.x > T(38));
    ui.clearHint();
    const h = g.spawnEnemy('hollow', T(48), T(7), { spawn: 1 });
    await g.wait(0.3);
    await g.say([TIK('Пустокожий. У него стёрли имя, осталась только обида.')]);
    g.hint(`${key(g, 'attack')} — удар. Нажимай снова, когда клинок вспыхнет янтарём, — это точный удар.`, 7);
    let dodgeHinted = false;
    let shiftHinted = false;
    const t0 = g.time;
    await g.waitUntil(() => {
      if (!dodgeHinted && h.state === 'windup') {
        dodgeHinted = true;
        g.hint(`${key(g, 'dodge')} — уклонение. Увернись в последний миг — откроется Окно Эха.`, 5);
      }
      if (!shiftHinted && g.time - t0 > 9 && !h.dead) {
        shiftHinted = true;
        g.hint(`${key(g, 'shift')} по врагу — переведи его в Отпечаток: прошлый он медленный и уязвимый.`, 6);
      }
      return h.dead;
    });
    await g.wait(0.6);
    await g.say([TIK('Неплохо для того, кого нет в списках. Дальше — Разорванная дорога. Держись того, что помнит.')]);
    g.openExits();
  },
};

// ── 1. Разорванная дорога ───────────────────────────────────────────
function tornMap() {
  const m = grid(32, 19);
  fill(m, 1, 1, 30, 17, ',');
  scatter(m, 7, 1, 1, 30, 17, ',', '"', 0.18);
  fill(m, 1, 8, 30, 3, '=');
  fill(m, 8, 4, 16, 11, ':');
  fill(m, 15, 8, 2, 2, '=');
  fill(m, 31, 8, 1, 3, '>');
  put(m, 2, 9, '@');
  // ниша с обрывком имени
  fill(m, 27, 1, 4, 2, '.');
  return rows(m);
}

export const tornRoad = {
  id: 'tornRoad',
  title: 'Разорванная дорога',
  music: 'road',
  dark: 0.4,
  floor: ',',
  under: { '>': '=', '@': '=' },
  map: tornMap(),
  facing: 0,
  exits: [{ marker: '>', to: 'camp', gate: true }],
  setup(g, room) {
    makeFlicker(room);
    const stone = g.addProp('memoryStone', T(16), TOP(9) + 6, { prompt: null });
    void stone;
    for (const [x, y] of [[5, 3], [26, 15], [4, 15]]) g.addProp('pillar', T(x), TOP(y + 1), { tall: 30, broken: true });
    for (const [x, y] of [[2, 2], [29, 15], [11, 16]]) g.addProp('deadTree', T(x), TOP(y + 1));
    if (!g.flags.nameScrap) g.spawnPickup('scrap', T(29), T(1), { vx: 0, vy: 0 });
  },
  update(g) {
    eraseEnemiesInPits(g);
  },
  async script(g) {
    const p = g.player;
    await g.waitUntil(() => p.x > T(6));
    g.room.flickerStart = g.time + 2.5;
    g.spawnWave([
      { kind: 'hollow', x: T(26), y: T(5) },
      { kind: 'hollow', x: T(27), y: T(13) },
      { kind: 'hollow', x: T(28), y: T(9) },
      { kind: 'framer', x: T(25), y: T(9) },
    ]);
    g.hint('Дорогу стирает. Камень памяти в центре удержит плиты рядом, если вернуть его в прошлое.', 6);
    await g.wait(6);
    if (g.enemies.some((e) => e.kind === 'framer')) {
      g.hint(`Кадровик пропускает кадры — удары проходят насквозь. ${key(g, 'shift')} по нему: в прошлом он целый.`, 6);
    }
    await g.waitUntil(() => g.clearedRoom());
    g.room.flickerStart = null;
    g.spawnPickup('fragment', T(16), T(11), { id: 'backHeat', vx: 0, vy: 0 });
    g.toast('Что-то осталось на дороге');
    unlockAbility(g, 0);
    g.openExits(true);
    for (const ex of g.exits) if (ex.gate) ex.gate.closed = false;
  },
};

// ── 2. Чужой привал ─────────────────────────────────────────────────
function campMap() {
  const m = grid(22, 13);
  fill(m, 1, 1, 20, 11, ',');
  scatter(m, 11, 1, 1, 20, 11, ',', '"', 0.3);
  fill(m, 1, 5, 20, 3, '=');
  fill(m, 21, 5, 1, 3, '>');
  put(m, 2, 6, '@');
  return rows(m);
}

export const camp = {
  id: 'camp',
  title: 'Чужой привал',
  music: 'road',
  dark: 0.7,
  floor: ',',
  under: { '>': '=', '@': '=' },
  map: campMap(),
  facing: 0,
  exits: [{ marker: '>', to: 'square', gate: true }],
  setup(g) {
    for (const [x, y] of [[3, 2], [8, 1], [15, 2], [19, 10], [5, 10], [12, 11]]) g.addProp('tree', T(x), TOP(y + 1));
    const fire = g.addProp('campfire', T(11), TOP(4) + 10, { prompt: null });
    const arno = g.addProp('ghostNpc', T(9), TOP(4) + 8, { drawFn: drawGhost, drawOpts: { hat: true }, prompt: 'Поговорить с силуэтом', markY: 28 });
    const sena = g.addProp('ghostNpc', T(13), TOP(4) + 8, { drawFn: drawGhost, drawOpts: { dress: true, color: P.amberHi }, hidden: true, markY: 28 });
    g.campNpc = { arno, sena, fire };
    arno.onInteract = async () => {
      if (g.flags.camp) {
        await g.say([{ who: 'Арно', text: 'Дорога ещё помнит нас. Иди, Смотритель.', portrait: 'arno' }]);
        return;
      }
      await g.say([
        { who: 'Силуэт', text: 'Меня зовут Арно. Я шёл в Колокольные Ворота. Или из них — дорога путает.', portrait: 'arno' },
        { who: 'Арно', text: 'Костёр погас, когда пропал звон. С тех пор сижу и не могу вспомнить, кого жду.', portrait: 'arno' },
      ]);
      g.flags.talkedArno = true;
    };
    fire.onShift = (gg, f, phase) => {
      if (phase === PAST) g.flags.fireLit = true;
    };
  },
  async script(g) {
    const { arno, sena, fire } = g.campNpc;
    if (g.flags.camp) {
      fire.tl.phase = PAST;
      arno.hidden = g.flags.camp === 'sena';
      sena.hidden = g.flags.camp === 'arno';
      g.openExits(true);
      return;
    }
    g.hint(`${key(g, 'interact')} — поговорить с силуэтом у костра`, 6);
    await g.waitUntil(() => g.flags.talkedArno);
    g.hint(`Костёр помнит другой вечер. ${key(g, 'shift')} — разжечь его в прошлом.`, 6);
    await g.waitUntil(() => g.flags.fireLit);
    g.ui.clearHint();
    sena.hidden = false;
    burst(g, sena.x, sena.y - 10, [P.amberHi, P.milk], 14, 30);
    await g.wait(0.8);
    const ARNO = (t) => ({ who: 'Арно', text: t, portrait: 'arno' });
    const SENA = (t) => ({ who: 'Сена', text: t, portrait: 'sena' });
    await g.say([
      SENA('Арно? Это мой привал. Это я развела огонь, когда ты ушёл вперёд.'),
      ARNO('Нет. Это моя дорога. Я помню каждый её камень.'),
      SENA('Ты помнишь камни. А я помню тебя.'),
      REN('Один из них — настоящий. Другой — отпечаток. Браслет не скажет, кто.'),
    ]);
    const hasScrap = !!g.flags.nameScrap;
    const hasCharge = g.player.charges.n >= 1;
    const i = await g.choose('Дорога удержит только одно воспоминание.', [
      { text: 'Оставить Арно', sub: 'Сена исчезнет' },
      { text: 'Оставить Сену', sub: 'Арно исчезнет' },
      {
        text: 'Сохранить обоих',
        sub: !hasScrap ? 'Нужен обрывок имени — он остался на Разорванной дороге' : !hasCharge ? 'Нужен заряд браслета' : 'Потратить обрывок имени и заряд браслета',
        disabled: !hasScrap || !hasCharge,
      },
    ]);
    const choice = ['arno', 'sena', 'both'][i];
    g.flags.camp = choice;
    if (choice === 'both') {
      g.player.charges.n -= 1;
      g.flags.nameScrap = false;
      g.audio.sfx.shift(PAST);
      ringFx(g, fire.x, fire.y - 8, 4, 40, P.amberHi, 0.6);
    } else {
      const gone = choice === 'arno' ? sena : arno;
      g.audio.sfx.enemyDie();
      burst(g, gone.x, gone.y - 10, [P.amber, P.ink, P.crimson], 24, 50, { size: 2 });
      gone.hidden = true;
    }
    g.persist();
    await g.wait(0.6);
    const lines = {
      arno: [ARNO('…Я один. Наверное, так и было. Спасибо, Смотритель. Если найдёшь Кухню — я приду.')],
      sena: [SENA('Он был тёплый. Я сохраню это за двоих. Найди Кухню Мары — я буду там.')],
      both: [SENA('Мы оба?.. Значит, дорога длиннее, чем мы думали.'), ARNO('Встретимся у Мары. Там тепло — по-настоящему.')],
    };
    await g.say(lines[choice]);
    g.openExits();
  },
};

// ── 3. Площадь без центра — эталонная комната Enhanced 16-bit ────────
// Комната печётся дважды (src/art/square16.js): Шрам на экране, Отпечаток — в островах памяти.
// F4 (отладка) — сравнение с прежней версией (src/art/level01_v1.js).
let artVariant = 'target';
export const setArtVariant = (v) => (artVariant = v);
export const getArtVariant = () => artVariant;

function squareMap() {
  const m = grid(SQ.w, SQ.h);
  fill(m, 2, 6, 26, 16, '+');
  fill(m, 2, 7, 26, 2, ':'); // провал перед аркой — проходим только в острове памяти
  fill(m, 14, 5, 2, 1, '>');
  fill(m, 15, 22, 2, 1, '+');
  put(m, 15, 21, '@');
  return rows(m);
}

const GARLANDS = [
  [40, 200, 98],
  [282, 442, 98],
];
const LANTERNS = [[164, 156], [316, 156], [356, 262]];

// Источники островов памяти: фонари в прошлом, ожившая статуя, фонтан в прошлом.
function memorySources(g) {
  const out = [];
  for (const l of g.lanterns || []) out.push({ id: l.id, x: l.x, y: l.y - 26, rx: 94, ry: 82, on: l.tl.phase === PAST });
  if (g.statue) out.push({ id: g.statue.id, x: G16.center[0], y: G16.center[1] - 8, rx: 124, ry: 94, on: g.statue.tl.phase === PAST });
  const f = g.fountain;
  if (f) out.push({ id: f.id, x: f.x, y: f.y - 12, rx: 50, ry: 38, on: f.tl.phase === PAST });
  return out;
}

export const square = {
  id: 'square',
  title: 'Площадь без центра',
  subtitle: 'Город Колокольных Ворот',
  music: 'city',
  dark: 0.5,
  floor: '+',
  under: { '>': '+' },
  map: squareMap(),
  facing: -Math.PI / 2,
  exits: [{ marker: '>', to: 'stairs', gate: true }],
  paint: (ctx, room) => (artVariant === 'current' ? paintSquareV1(ctx, room) : paintTarget(ctx, room)),
  drawParallax: (g, ctx, cx, cy, q) => (artVariant === 'current' ? drawSquareParallaxV1(g, ctx, cx, cy, q) : drawSquareParallax(g, ctx, cx, cy, q)),
  voidField: true,
  ashColor: '#5a5470',
  setup(g, room) {
    room.pitAt = (gg, x, y) => artVariant !== 'current' && inFissure(x, y) && !inIslands(gg.memIslands || [], x, y);
    g.islandState = new Map();
    g.memIslands = [];
    const [cx, cy] = G16.center;
    const statue = g.addProp('statue16', cx, cy + 10, { prompt: 'Осмотреть постамент', icon: 'eye', markY: 64 });
    g.statue = statue;
    statue.onInteract = async () => {
      if (statue.tl.phase === PAST) {
        if (g.flags.squareDone) await boyTalk(g);
        else await g.say([{ who: 'Латунный Мальчик', text: 'Не звони в колокол…', portrait: 'boy' }]);
        return;
      }
      await g.say([NOTE('Постамент пуст. На камне — малиновый контур того, кто здесь стоял. Табличка: «…ОТЛИТ В ГОД ПОСЛЕДНЕГО ЗВОНА».')]);
      g.flags.statueRead = true;
    };
    statue.onShift = (gg, s, phase) => {
      if (phase === PAST) g.flags.statueAwake = true;
      g.squareGhosts?.forEach((v) => (v.hidden = phase !== PAST));
      if (g.stillOne) g.stillOne.hidden = phase === PAST;
    };
    g.lanterns = LANTERNS.map(([x, y]) => g.addProp('lantern16', x, y));
    const [fx, fy] = G16.fountain;
    const fountain = g.addProp('fountain', fx, fy + 14, { markY: 44, icon: 'drop' });
    g.fountain = fountain;
    fountain.prompt = 'Напиться';
    fountain.canInteract = () => fountain.tl.phase === PAST && !g.flags.drankFountain;
    fountain.onInteract = () => {
      g.flags.drankFountain = true;
      g.heal(25);
      g.toast('Вода из прошлого ещё холодная');
    };
    // жители прошлого — вокруг статуи; в Шраме — один силуэт спиной к игроку
    const ghosts = [[150, 214], [176, 270], [304, 196], [334, 238], [206, 300], [278, 296]];
    g.squareGhosts = ghosts.map(([x, y], i) => g.addProp('ghostNpc', x, y, { drawFn: drawVillager, drawOpts: { v: i % 4 }, hidden: true }));
    g.stillOne = g.addProp('ghostNpc', 404, 252, { drawFn: drawStillOne });
    g.addProp('candles', cx - 22, cy + 16);
    g.addProp('candles', cx + 22, cy + 16);
    for (const [x, y] of [[60, 332], [432, 168]]) g.addProp('rubble', x, y);
  },
  drawFloor(g, ctx) {
    // тонкая малиновая трещина через кольцо — пока постамент пуст
    if (artVariant === 'current' || !g.statue || g.statue.tl.phase === PAST) return;
    const [cx, cy] = G16.center;
    const on = Math.floor(g.time * 7) % 5 !== 0;
    ctx.fillStyle = on ? '#86163a' : '#4a0c1e';
    for (const [dx, dy, w] of [[-60, 26, 9], [-51, 27, 7], [-44, 28, 10], [-34, 27, 6], [28, 26, 8], [36, 25, 9], [45, 26, 6], [51, 27, 10]]) ctx.fillRect(cx + dx, cy + dy, w, 1);
    if (on) {
      ctx.fillStyle = '#c8284a';
      ctx.fillRect(cx - 48, cy + 28, 2, 1);
      ctx.fillRect(cx + 40, cy + 25, 2, 1);
    }
  },
  drawOver(g, ctx) {
    // гирлянды флажков: в острове памяти — цветные, в Шраме — рваные
    const f = g.quality.decorAnim ? Math.floor(g.time * 3) % 3 : 0;
    GARLANDS.forEach(([x0, x1, y], i) => {
      const past = pastAt(g, (x0 + x1) / 2, y + 30);
      const e = atlas.sprite(`garland|${i}|${past ? 1 : 0}|${f}`, x1 - x0 + 4, 22, 0, 0, (b) => drawGarland(b, 2, x1 - x0 + 2, 2, past, f));
      blit(ctx, e, x0 - 2, y - 2);
    });
    if (artVariant === 'current') return;
    // передний план: обломанные колонны у нижних углов, вне маршрута
    for (const [x, flip] of [[44, false], [436, true]]) {
      const e = atlas.sprite(`fg-stump|${flip ? 1 : 0}`, 26, 52, 13, 50, (b, ax, ay) => drawStump(b, ax, ay, flip), { outline: '#05060c' });
      blit(ctx, e, x, g.room.pxH + 6);
    }
  },
  update(g, dt) {
    g.memIslands = artVariant === 'current' ? [] : updateIslands(g.islandState, memorySources(g), dt);
    if (g.squareWaves && g.lanterns) g.squareLit = g.lanterns.filter((l) => l.tl.phase === PAST).length;
  },
  async script(g) {
    if (g.flags.squareDone) {
      g.statue.tl.phase = PAST;
      g.statue.onShift(g, g.statue, PAST);
      g.lanterns.forEach((l) => (l.tl.phase = PAST));
      g.openExits(true);
      return;
    }
    g.hint(`${key(g, 'interact')} — осмотреть пустой постамент`, 6);
    await g.waitUntil(() => g.flags.statueRead || g.flags.statueAwake);
    if (!g.flags.statueAwake) {
      g.hint(`${key(g, 'shift')} у постамента — пусть вспомнит, кто на нём стоял`, 6);
      await g.waitUntil(() => g.flags.statueAwake);
    }
    g.ui.clearHint();
    await g.wait(0.6);
    await g.say([
      { who: 'Латунный Мальчик', text: 'Не звони в колокол. Пожалуйста.', portrait: 'boy' },
      { who: 'Латунный Мальчик', text: 'Каждый раз, когда он звонит, кого-то становится меньше.', portrait: 'boy' },
      { who: 'Латунный Мальчик', text: 'Они уже идут. Они не любят, когда я вспоминаю.', portrait: 'boy' },
    ]);
    g.squareWaves = true;
    g.spawnWave([
      { kind: 'hollow', x: 84, y: 300 },
      { kind: 'hollow', x: 400, y: 230 },
      { kind: 'ringer', x: 312, y: 186 },
    ]);
    g.hint(`Зажги фонари (${key(g, 'shift')}): в их свете площадь вспоминает себя и провал зарастает. Незажжённый фонарь бьёт током.`, 8);
    await g.waitUntil(() => g.clearedRoom());
    await g.wait(0.8);
    g.spawnWave([
      { kind: 'framer', x: 150, y: 196 },
      { kind: 'framer', x: 330, y: 292 },
      { kind: 'ringer', x: 400, y: 190 },
      { kind: 'hollow', x: 84, y: 320 },
    ]);
    g.toast('Вторая волна');
    await g.waitUntil(() => g.clearedRoom());
    if ((g.squareLit ?? 0) < 2) {
      g.hint(`Город держит двери темнотой. Зажги ещё фонарь — ${key(g, 'shift')}.`, 6);
      await g.waitUntil(() => g.squareLit >= 2);
    }
    g.ui.clearHint();
    g.flags.squareDone = true;
    unlockAbility(g, 1);
    g.persist();
    // тайник за лавкой
    const cache = g.addProp('chest', 52, 130, { prompt: 'Открыть тайник', icon: 'hand' });
    cache.onInteract = () => {
      cache.open = true;
      cache.onInteract = null;
      g.audio.sfx.chest();
      for (let i = 0; i < 5; i++) g.spawnPickup('ash', cache.x, cache.y + 4);
      g.spawnPickup('shard', cache.x, cache.y + 6);
    };
    await g.wait(0.5);
    await boyTalk(g);
    g.openExits();
  },
};

// Обломанная колонна переднего плана.
function drawStump(ctx, x, y, flip) {
  const f = flip ? -1 : 1;
  ctx.fillStyle = '#2c3346';
  ctx.fillRect(x - 8, y - 34, 16, 34);
  ctx.fillStyle = '#3d4760';
  ctx.fillRect(x - 8, y - 34, 4, 34);
  ctx.fillStyle = '#1f2433';
  ctx.fillRect(x + 5, y - 34, 3, 34);
  // сколотый верх
  for (let i = 0; i < 16; i++) {
    const h = 2 + ((i * 7 * f + 16) % 6);
    ctx.fillStyle = '#56637e';
    ctx.fillRect(x - 8 + i, y - 34 - h, 1, h);
  }
  ctx.fillStyle = '#2c3346';
  ctx.fillRect(x - 11, y - 6, 22, 6);
  ctx.fillStyle = '#56637e';
  ctx.fillRect(x - 11, y - 6, 22, 1);
  ctx.fillStyle = '#86163a';
  ctx.fillRect(x - 2 * f, y - 20, 1, 4);
}

async function boyTalk(g) {
  const BOY = (t) => ({ who: 'Латунный Мальчик', text: t, portrait: 'boy' });
  await g.say([BOY('Башня звонит не потому, что хочет позвать людей. Она звонит, чтобы убедиться, что люди ещё есть.')]);
  const i = await g.choose('Спросить мальчика…', [{ text: 'Кто ты?' }, { text: 'Мне пора наверх' }]);
  if (i === 0) await g.say([BOY('Я был мальчиком, пока меня не понадобилось заменить.'), REN('Кем заменить?'), BOY('Тем, кто не стирается.')]);
  else await g.say([BOY('Лестница из двух версий. Наступай на ту, что помнит тебя.')]);
}

// ── 4. Лестница из двух версий ───────────────────────────────────────
function stairsMap() {
  const m = grid(14, 46);
  const land = (y0, y1) => fill(m, 1, y0, 12, y1 - y0 + 1, '.');
  land(1, 5);
  land(10, 16);
  land(21, 27);
  land(32, 38);
  land(43, 44);
  for (const [y0, y1] of [[6, 9], [17, 20], [28, 31], [39, 42]]) fill(m, 1, y0, 12, y1 - y0 + 1, ' ');
  fill(m, 6, 0, 2, 1, '>');
  put(m, 7, 44, '@');
  return rows(m);
}

export const stairs = {
  id: 'stairs',
  title: 'Лестница из двух версий',
  music: 'city',
  dark: 0.55,
  map: stairsMap(),
  under: { '>': '.' },
  facing: -Math.PI / 2,
  fallDamage: 8,
  exits: [{ marker: '>', to: 'shadowArena' }],
  setup(g) {
    // пролёты: существуют попеременно в прошлом и настоящем
    const spans = [[39, PAST], [28, PRESENT], [17, PAST], [6, PRESENT]];
    g.stairProps = spans.map(([y, exists]) => g.addProp('stair', TOP(5), TOP(y), { w: 64, h: 64, exists, noRift: false }));
    g.stairStreak = 0;
    for (const s of g.stairProps) {
      s.onShift = (gg, obj, phase) => {
        if (phase !== obj.exists) return;
        g.stairStreak++;
        // импульс отталкивает врагов
        for (const e of g.enemies) {
          if (dist(e.x, e.y, obj.x + 32, obj.y + 32) < 60) {
            e.kx += (e.x - (obj.x + 32)) * 4;
            e.ky += (e.y - (obj.y + 32)) * 4;
          }
        }
        ringFx(g, obj.x + 32, obj.y + 32, 6, 50, P.milk, 0.4);
        if (g.stairStreak >= 3 && !g.flags.stairCache) openCache(g);
      };
    }
    for (const [x, y] of [[2, 12], [11, 23], [2, 34], [11, 2]]) g.addProp('candles', T(x), TOP(y + 1));
    for (const [x, y] of [[11, 13], [2, 24], [11, 35]]) g.addProp('banner', T(x), TOP(y + 1));
    if (g.flags.stairCache && !g.flags.stairCacheTaken) openCache(g, true);
  },
  onHeroHurt(g) {
    if (g.stairStreak > 0 && g.stairStreak < 3) g.toast('Цепочка прервана — тайник не откроется', 1.6);
    g.stairStreak = 0;
  },
  async script(g) {
    g.hint(`Наступай на ту версию лестницы, что существует. ${key(g, 'shift')} у пролёта — вызвать его. Пролёт держится недолго.`, 8);
    await g.wait(4);
    g.hint('Говорят, тот, кто вызовет три пролёта подряд без единой царапины, найдёт тайник.', 6);
    const p = g.player;
    const waves = [
      [T(33), [{ kind: 'framer', x: T(3), y: T(34) }, { kind: 'framer', x: T(10), y: T(36) }]],
      [T(22), [{ kind: 'framer', x: T(4), y: T(23) }, { kind: 'hollow', x: T(10), y: T(24) }]],
      [T(11), [{ kind: 'framer', x: T(3), y: T(12) }, { kind: 'framer', x: T(10), y: T(14) }, { kind: 'ringer', x: T(7), y: T(11) }]],
    ];
    for (const [y, list] of waves) {
      await g.waitUntil(() => p.y < y + 40);
      g.spawnWave(list);
    }
  },
};

function openCache(g, silent = false) {
  g.flags.stairCache = true;
  const c = g.addProp('chest', T(4), TOP(3), { prompt: 'Открыть тайник' });
  c.onInteract = () => {
    c.open = true;
    c.onInteract = null;
    g.audio.sfx.chest();
    g.flags.stairCacheTaken = true;
    g.giveFragment('bellShard');
    for (let i = 0; i < 6; i++) g.spawnPickup('ash', c.x, c.y + 4);
  };
  if (!silent) {
    g.toast('Наверху щёлкнул замок тайника');
    g.audio.sfx.chest();
  }
  g.persist();
}

// ── 5. Звонкая Тень ─────────────────────────────────────────────────
function arenaMap() {
  const m = grid(26, 18);
  fill(m, 1, 1, 24, 16, '.');
  fill(m, 12, 0, 2, 1, '>');
  put(m, 13, 16, '@');
  return rows(m);
}

export const shadowArena = {
  id: 'shadowArena',
  title: 'Звонкая Тень',
  music: 'boss',
  dark: 0.62,
  map: arenaMap(),
  under: { '>': '.' },
  facing: -Math.PI / 2,
  exits: [{ marker: '>', to: 'ascent', gate: true }],
  setup(g) {
    for (const [x, y] of [[6, 5], [19, 5], [6, 12], [19, 12]]) g.addProp('pillar', T(x), TOP(y + 1), { tall: 44 });
    for (const [x, y] of [[2, 2], [23, 2], [2, 15], [23, 15], [10, 2], [15, 2]]) g.addProp('candles', T(x), TOP(y + 1));
  },
  update(g) {
    const s = g.shadowBoss;
    if (s) g.bossBar = s.dead ? null : { hp: Math.max(0, s.hp), max: s.maxHp };
  },
  async script(g) {
    if (g.flags.shadowDone) {
      g.openExits(true);
      return;
    }
    await g.wait(0.8);
    g.audio.sfx.bell(330);
    const s = g.spawnEnemy('shadow', T(13), T(6), { spawn: 1.4 });
    g.shadowBoss = s;
    g.ui.setBoss('Звонкая Тень', 'элитный враг');
    await g.wait(1.6);
    await g.say([NOTE('Вытянутое существо без лица. Вокруг него звенит кольцо колокольчиков — и этот звон держит его, как броня.')]);
    g.hint('Броню звона не пробить клинком. Дождись её звуковой волны и переведи волну в прошлое — пусть звон вернётся к хозяйке.', 9);
    await g.waitUntil(() => s.dead);
    g.ui.setBoss(null);
    g.bossBar = null;
    g.voidZones = [];
    g.enemies.forEach((e) => killEnemy(g, e));
    await g.wait(1.2);
    g.save.upgrades.quickSeam = true;
    g.flags.shadowDone = true;
    unlockAbility(g, 2);
    g.persist();
    g.ui.card('Постоянное улучшение', 'Быстрый шов', 'Импульс сдвига короче на четверть, а идеальное уклонение возвращает заряд браслета.', 4.5);
    g.audio.sfx.shard();
    await g.wait(2);
    g.openExits();
  },
};

// ── 6. Подъём к колокольне ───────────────────────────────────────────
function ascentMap() {
  const m = grid(44, 13);
  fill(m, 1, 4, 42, 8, '+');
  fill(m, 43, 7, 1, 2, '>');
  put(m, 2, 8, '@');
  return rows(m);
}

export const ascent = {
  id: 'ascent',
  title: 'Подъём к колокольне',
  walls: 'city',
  music: 'city',
  dark: 0.5,
  floor: '+',
  under: { '>': '+' },
  map: ascentMap(),
  facing: 0,
  exits: [{ marker: '>', to: 'belfry' }],
  setup(g) {
    for (const [x, y] of [[6, 4], [17, 4], [28, 4], [38, 4]]) g.addProp('banner', T(x), TOP(y + 1));
    for (const [x, y] of [[10, 10], [25, 11], [34, 10]]) g.addProp('rubble', T(x), TOP(y + 1));
    const echo = g.addProp('memoryStone', T(13), TOP(7) + 4, { timeline: { hold: 9, cost: 0, switchTime: 0.5 } });
    g.cityEcho = echo;
    const mara = npc(g, drawMara, T(24), TOP(7) + 4, { prompt: 'Поговорить с Марой' });
    mara.onInteract = async () => {
      if (g.flags.bread) {
        await g.say([{ who: 'Мара', text: 'Наверху Брат Мел. Звонит в пустоту. Не дай ему дозвониться.', portrait: 'mara' }]);
        return;
      }
      const MARA = (t) => ({ who: 'Мара', text: t, portrait: 'mara' });
      await g.say([
        MARA('Смотритель. Не смотри так — я тоже не знаю, как сюда попала.'),
        MARA('Я помню все рецепты. Не помню, для кого готовила. Пусть будет для тебя.'),
        MARA('Ешь сейчас. В прошлом он уже остыл.'),
      ]);
      g.flags.bread = true;
      if (!g.save.items.includes('bread')) g.save.items.push('bread');
      g.heal(g.player.maxHp);
      g.persist();
      await g.say([MARA('Наверху Брат Мел. Звонит в пустоту. Не дай ему дозвониться.')]);
    };
    // жители прошлого готовятся к празднику
    const ghosts = [[8, 6], [11, 10], [16, 8], [20, 6], [30, 9], [35, 6], [39, 10]];
    g.drawables.push({
      y: 0,
      kind: 'extra',
      draw: () => {},
    });
    g.cityGhosts = ghosts.map(([x, y], i) => g.addProp('ghostNpc', T(x), TOP(y + 1), { drawFn: drawGhost, drawOpts: { hat: i % 2 === 0, dress: i % 2 === 1, alpha: 0.55 }, hidden: true }));
    echo.onShift = (gg, o, phase) => g.cityGhosts.forEach((c) => (c.hidden = phase !== PAST));
    echo.onRevert = () => g.cityGhosts.forEach((c) => (c.hidden = true));
  },
  drawOver(g, ctx) {
    // в Шраме башня висит на чёрных нитях; в Отпечатке — гирлянды праздника
    const past = g.cityEcho?.tl.phase === PAST;
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 76;
      if (past) {
        for (let k = 0; k < 70; k += 3) px(ctx, x + k, 58 + Math.sin(k / 11) * 6, 2, 2, k % 6 ? P.amber : P.amberHi);
      } else {
        line(ctx, x, 0, x + Math.sin(g.time + i) * 3, 56, P.void);
        px(ctx, x - 1, 56, 3, 2, P.crimson1);
      }
    }
  },
  async script(g) {
    g.hint(`Город ещё помнит праздник. ${key(g, 'shift')} у камня памяти — увидеть, каким он был.`, 6);
    await g.waitUntil(() => g.player.x > T(20));
    if (!g.flags.bread) g.hint(`${key(g, 'interact')} — поговорить с Марой`, 5);
  },
};

export { npc, REN, TIK, NOTE, drawDog };
