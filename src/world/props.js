// Объекты окружения. Переключаемые объекты (TimelineProp) описываются данными:
// для каждой фазы — проходимость, твёрдость, свет и эффект. Механика не зашита
// в каждый объект вручную: общий код читает таблицы по фазе.
import { P } from '../art/palette.js';
import { px, line, disc, ring, drawBrassBoy, drawGhost, shadow } from '../art/sprites.js';
import { createTimeline, PAST, PRESENT } from '../timeline/timeline.js';
import { hash2 } from '../core/math.js';
import { drawChestHd, drawRubbleHd, drawSignHd, drawMemoryStoneHd, drawLanternHd, drawCampfireHd, drawPillarHd, drawCandlesHd, drawStoveHd, drawTableHd, drawWindowHd, drawPortraitsHd, drawShelfHd, drawBoxHd, drawGateHd } from '../art/props32.js';
import { drawTik32, drawMara32, drawDog32, drawGhost32, drawBrassBoy32, drawVillager32, drawStillOne32 } from '../art/npcs32.js';
import { drawTik, drawMara, drawDog } from '../art/sprites.js';
import { drawLampHd, drawBannerHd, drawTreeHd, drawDeadTreeHd, drawGraveHd, drawGateTowerHd } from '../art/road32.js';

// flat — рисуется под персонажами; rect — x,y,w,h в пикселях (левый верх).
// Иначе x,y — точка основания, foot — {w,h} твёрдого основания.
export const PROP_KINDS = {
  sign: {
    name: 'Дорожный указатель',
    timeline: { hold: 4, cost: 0, switchTime: 0.45 },
    foot: { w: 6, h: 4 },
    solid: { past: true, present: true },
    draw: drawSign,
  },
  bridge: {
    name: 'Разрушенный мост',
    flat: true,
    timeline: { hold: 8, cost: 1, switchTime: 0.7 },
    walkable: { past: true, present: false },
    draw: drawBridge,
  },
  stair: {
    name: 'Пролёт лестницы',
    flat: true,
    timeline: { hold: 6, cost: 0, switchTime: 0.45 },
    // существует в фазе p.exists; база — противоположная
    draw: drawStair,
  },
  memoryStone: {
    name: 'Камень памяти',
    timeline: { hold: 10, cost: 1, switchTime: 0.6 },
    foot: { w: 14, h: 8 },
    solid: { past: true, present: false },
    protect: { past: 52, present: 0 }, // удерживает стирающиеся плиты рядом
    light: { past: 44, present: 0 },
    draw: drawMemoryStone,
  },
  lantern: {
    name: 'Фонарь',
    timeline: { hold: Infinity, cost: 1, switchTime: 0.6 },
    foot: { w: 6, h: 4 },
    solid: { past: true, present: true },
    light: { past: 70, present: 14 },
    reveal: { past: 70, present: 0 }, // в свете видны Кадровики
    pulse: { past: 0, present: 38 }, // электрический импульс по кругу
    draw: drawLantern,
  },
  campfire: {
    name: 'Костёр',
    timeline: { hold: Infinity, cost: 0, switchTime: 0.5 },
    foot: { w: 12, h: 6 },
    solid: { past: true, present: true },
    light: { past: 80, present: 0 },
    lightColor: { past: 'fire', present: 'cold' },
    lightY: 8,
    draw: drawCampfire,
  },
  statue: {
    name: 'Латунный Мальчик',
    timeline: { hold: Infinity, cost: 0, switchTime: 0.6 },
    foot: { w: 20, h: 8 },
    solid: { past: true, present: true },
    light: { past: 36, present: 0 },
    draw: (ctx, p, g) => drawBrassBoy(ctx, p.x, p.y, { phase: p.tl.phase, t: g.time }),
  },
  chest: { name: 'Сундук', foot: { w: 14, h: 6 }, solid: { past: true, present: true }, draw: drawChest },
  gate: { name: 'Ворота', flat: false, draw: drawGateHd },
  pillar: { foot: { w: 14, h: 8 }, solid: { past: true, present: true }, draw: drawPillar },
  tree: { foot: { w: 6, h: 4 }, solid: { past: true, present: true }, draw: drawTree, drawHd: drawTreeHd },
  deadTree: { foot: { w: 6, h: 4 }, solid: { past: true, present: true }, draw: drawDeadTree, drawHd: drawDeadTreeHd },
  banner: { foot: { w: 4, h: 3 }, solid: { past: true, present: true }, draw: drawBanner, drawHd: drawBannerHd },
  grave: { foot: { w: 10, h: 4 }, solid: { past: true, present: true }, draw: drawGrave, drawHd: drawGraveHd },
  // кованый фонарь у дороги (32-битный кадр); erased — в стёртой части, свет малиновый
  roadLamp: {
    foot: { w: 4, h: 3 },
    solid: { past: true, present: true },
    light: { past: 72, present: 64 },
    lightColor: { past: 'amber', present: 'amber' },
    lightY: 34,
    draw: drawLampHd,
    drawHd: drawLampHd,
  },
  // башня ворот: кладка, бойница с огнём, багровое знамя; между башнями — колокол
  gateTower: { foot: { w: 18, h: 8 }, solid: { past: true, present: true }, light: { past: 34, present: 34 }, lightY: 60, draw: drawGateTowerHd, drawHd: drawGateTowerHd },
  rubble: { draw: drawRubble },
  candles: { draw: drawCandles, light: { past: 26, present: 26 }, lightColor: { past: 'fire', present: 'fire' }, lightY: 6 },
  glyph: { name: 'Знак арены', flat: true, draw: drawGlyph },
  stove: { foot: { w: 26, h: 8 }, solid: { past: true, present: true }, light: { past: 60, present: 60 }, lightColor: { past: 'fire', present: 'fire' }, draw: drawStove },
  table: { foot: { w: 30, h: 8 }, solid: { past: true, present: true }, draw: drawTable },
  window: { draw: drawWindowProp },
  portraits: { draw: drawPortraits },
  shelf: { draw: drawShelf },
  box: { foot: { w: 12, h: 6 }, solid: { past: true, present: true }, draw: drawBox },
  // NPC и прочие фигуры с собственной отрисовкой: p.drawFn(ctx, x, y, opts)
  npc: {
    foot: { w: 8, h: 4 },
    solid: { past: true, present: true },
    draw: (ctx, p, g) => p.drawFn(ctx, p.x, p.y, { t: g.time + (p.id % 7), ...(p.drawOpts || {}) }),
  },
  ghostNpc: {
    draw: (ctx, p, g) => p.drawFn(ctx, p.x, p.y, { t: g.time + (p.id % 7), ...(p.drawOpts || {}) }),
  },
};

let nextId = 1;
export function createProp(kind, x, y, o = {}) {
  const def = PROP_KINDS[kind];
  if (!def) throw new Error(`Нет объекта ${kind}`);
  const p = { id: nextId++, kind, def, x, y, w: o.w ?? 16, h: o.h ?? 16, ...o };
  const tlDef = o.timeline ? { ...(def.timeline || {}), ...o.timeline } : def.timeline;
  p.tl = createTimeline(tlDef || { switchable: false });
  if (o.switchable === false) p.tl.switchable = false;
  if (kind === 'stair') {
    p.exists = o.exists ?? PAST;
    p.tl.base = p.exists === PAST ? PRESENT : PAST;
    p.tl.phase = p.tl.base;
  }
  return p;
}

const phaseOf = (p) => p.tl.phase;

// Твёрдое основание объекта в текущей фазе.
export function propFoot(p) {
  const d = p.def;
  if (!d.foot || !d.solid || !d.solid[phaseOf(p)] || p.hidden) return null;
  if (p.kind === 'chest' && p.open === 'gone') return null;
  return { x: p.x - d.foot.w / 2, y: p.y - d.foot.h, w: d.foot.w, h: d.foot.h };
}

// Проходимая площадка над пустотой.
export function propWalkRect(p) {
  if (p.kind === 'bridge' && p.def.walkable[phaseOf(p)]) return p;
  if (p.kind === 'stair' && phaseOf(p) === p.exists) return p;
  return null;
}

export const propLight = (p) => (p.def.light ? p.def.light[phaseOf(p)] : 0) || 0;
export const propCenter = (p) => (p.def.flat ? [p.x + p.w / 2, p.y + p.h / 2] : [p.x, p.y - 8]);
export const propSortY = (p) => (p.def.flat ? -1e6 + p.y : p.y);

// ── отрисовка ──────────────────────────────────────────────────────────
function drawSign(ctx, p, g) {
  const past = phaseOf(p) === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 8);
  px(ctx, x - 1, y - 22, 2, 22, P.wood);
  px(ctx, x - 13, y - 24, 26, 9, past ? P.woodHi : P.wood);
  px(ctx, x - 13, y - 24, 26, 1, P.amber0);
  px(ctx, x + 13, y - 22, 3, 5, past ? P.woodHi : P.wood); // стрелка
  // «надпись» — штрихи; в Шраме последняя часть мигает и пропадает
  const n = past ? 9 : 5 + (Math.floor(g.time * 9) % 4);
  for (let i = 0; i < n; i++) px(ctx, x - 11 + i * 2.5, y - 21 + (i % 2), 2, 2, past ? P.amberHi : P.ash4);
  if (!past) px(ctx, x + 2 + ((g.time * 23) % 8), y - 21, 2, 3, P.crimson);
  if (past) {
    // торговцы прошлого рядом с дорогой
    drawGhost(ctx, x - 26, y + 4, { t: g.time, hat: true, alpha: 0.55 });
    drawGhost(ctx, x + 30, y + 10, { t: g.time + 1, dress: true, alpha: 0.5 });
  }
}

function drawBridge(ctx, p, g) {
  const past = phaseOf(p) === PAST;
  const horizontal = p.w >= p.h;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (past) {
    ctx.fillStyle = 'rgba(224,160,64,0.12)';
    ctx.fillRect(x - 2, y - 2, p.w + 4, p.h + 4);
    if (horizontal) {
      for (let i = 0; i < p.w; i += 4) {
        px(ctx, x + i, y + 2, 3, p.h - 4, i % 8 ? P.woodHi : P.wood);
        px(ctx, x + i, y + p.h - 3, 3, 1, P.ink);
      }
      line(ctx, x, y + 1, x + p.w, y + 1, P.amber1);
      line(ctx, x, y + p.h - 2, x + p.w, y + p.h - 2, P.amber1);
    } else {
      for (let i = 0; i < p.h; i += 4) {
        px(ctx, x + 2, y + i, p.w - 4, 3, i % 8 ? P.woodHi : P.wood);
        px(ctx, x + 2, y + i + 2, p.w - 4, 1, P.amber0);
      }
    }
  } else {
    // обломки по краям, посередине пустота
    if (horizontal) {
      for (let i = 0; i < 9; i += 4) px(ctx, x + i, y + 3 + (i % 3), 3, p.h - 7, P.wood);
      for (let i = 0; i < 9; i += 4) px(ctx, x + p.w - 3 - i, y + 4, 3, p.h - 9, P.wood);
      const flick = Math.floor(g.time * 4) % 3;
      ctx.fillStyle = 'rgba(224,160,64,0.25)';
      for (let i = 12; i < p.w - 12; i += 6) ctx.fillRect(x + i, y + p.h / 2 + ((i + flick) % 3) - 1, 3, 1);
    } else {
      for (let i = 0; i < 9; i += 4) px(ctx, x + 3, y + i, p.w - 6, 3, P.wood);
      ctx.fillStyle = 'rgba(224,160,64,0.25)';
      for (let i = 12; i < p.h - 8; i += 6) ctx.fillRect(x + p.w / 2, y + i, 1, 3);
    }
  }
}

function drawStair(ctx, p, g) {
  const on = phaseOf(p) === p.exists;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const past = p.exists === PAST;
  const c1 = past ? P.amber1 : P.ash2;
  const c2 = past ? P.amberHi : P.ash3;
  if (on) {
    for (let i = 0; i < p.h; i += 4) {
      px(ctx, x, y + i, p.w, 4, c1);
      px(ctx, x, y + i, p.w, 1, c2);
      px(ctx, x, y + i + 3, p.w, 1, P.ink);
    }
    if (!past) for (let i = 0; i < 6; i++) px(ctx, x + hash2(i, p.id, 3) * p.w, y + hash2(p.id, i, 4) * p.h, 1, 1, P.crimson);
  } else {
    // призрачный контур: здесь лестница есть в другой версии
    ctx.fillStyle = past ? 'rgba(224,160,64,0.35)' : 'rgba(174,176,188,0.3)';
    const off = Math.floor(g.time * 8) % 4;
    for (let i = off; i < p.w; i += 4) {
      ctx.fillRect(x + i, y, 2, 1);
      ctx.fillRect(x + i, y + p.h - 1, 2, 1);
    }
    for (let i = off; i < p.h; i += 4) {
      ctx.fillRect(x, y + i, 1, 2);
      ctx.fillRect(x + p.w - 1, y + i, 1, 2);
    }
  }
}

function drawMemoryStone(ctx, p, g) {
  const past = phaseOf(p) === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (past) {
    shadow(ctx, x, y, 16);
    px(ctx, x - 7, y - 26, 14, 26, P.stone2);
    px(ctx, x - 6, y - 28, 12, 2, P.stone3);
    px(ctx, x - 7, y - 26, 2, 26, P.stone3);
    px(ctx, x + 5, y - 26, 2, 26, P.stone1);
    const glow = 0.6 + Math.sin(g.time * 3) * 0.4;
    ctx.globalAlpha = glow;
    for (let i = 0; i < 4; i++) px(ctx, x - 2 + (i & 1) * 2, y - 22 + i * 5, 3, 2, P.amberHi);
    ctx.globalAlpha = 1;
    ring(ctx, x, y - 2, PROP_KINDS.memoryStone.protect.past, 'rgba(224,160,64,0.25)', 0.5, 3);
  } else {
    drawRubble(ctx, p, g);
    px(ctx, x - 1, y - 6, 3, 2, P.amber0);
  }
}

function drawLantern(ctx, p, g) {
  const past = phaseOf(p) === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 8);
  px(ctx, x - 1, y - 26, 2, 26, P.ink);
  px(ctx, x - 3, y - 1, 6, 1, P.ink);
  px(ctx, x - 4, y - 34, 8, 9, P.ink);
  if (past) {
    px(ctx, x - 3, y - 33, 6, 7, P.amberHi);
    px(ctx, x - 2, y - 31, 4, 4, P.milk);
  } else {
    px(ctx, x - 3, y - 33, 6, 7, P.teal0);
    const spark = Math.floor(g.time * 12) % 5;
    if (spark < 2) line(ctx, x - 3, y - 32 + spark, x + 2, y - 28 - spark, P.tealHi);
  }
  px(ctx, x - 5, y - 35, 10, 1, P.ink);
  px(ctx, x - 1, y - 37, 2, 2, P.ink);
}

function drawCampfire(ctx, p, g) {
  const past = phaseOf(p) === PAST;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    px(ctx, x + Math.cos(a) * 6 - 1, y - 3 + Math.sin(a) * 2.5, 3, 2, P.stone2);
  }
  line(ctx, x - 5, y - 2, x + 4, y - 5, P.wood, 2);
  line(ctx, x - 4, y - 5, x + 5, y - 2, P.woodHi, 2);
  if (past) {
    for (let i = 0; i < 7; i++) {
      const h = 4 + ((Math.sin(g.time * 9 + i * 1.7) + 1) * 3) | 0;
      px(ctx, x - 4 + i, y - 4 - h, 1, h, i % 2 ? P.amber : P.amberHi);
    }
    px(ctx, x - 1, y - 9, 2, 4, P.milk);
  } else {
    px(ctx, x - 3, y - 4, 6, 2, P.ash2);
    const ember = Math.floor(g.time * 3) % 4;
    px(ctx, x - 2 + ember, y - 4, 1, 1, P.amber1);
    px(ctx, x + 1, y - 3, 1, 1, ember % 2 ? P.amber0 : P.amber1);
    if (Math.floor(g.time * 2) % 3 === 0) px(ctx, x, y - 8 - ((g.time * 10) % 6), 1, 1, P.ash3);
  }
}

function drawChest(ctx, p) {
  if (p.open === 'gone') return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 16);
  px(ctx, x - 8, y - 9, 16, 9, P.wood);
  px(ctx, x - 8, y - 9, 16, 1, P.woodHi);
  px(ctx, x - 8, y - 5, 16, 1, P.brass);
  if (p.open) {
    px(ctx, x - 8, y - 14, 16, 4, P.woodHi);
    px(ctx, x - 6, y - 10, 12, 2, P.void);
  } else {
    px(ctx, x - 8, y - 12, 16, 3, P.woodHi);
    px(ctx, x - 1, y - 7, 2, 3, P.brassHi);
  }
}

function drawGate(ctx, p, g) {
  // p — прямоугольник прохода; закрыт — решётка из стираемых квадратов
  if (!p.closed) return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (let i = 0; i < p.w; i += 3) {
    for (let j = 0; j < p.h; j += 3) {
      const r = hash2(i + Math.floor(g.time * 6), j, p.id);
      if (r > 0.45) px(ctx, x + i, y + j, 2, 2, r > 0.85 ? P.crimsonHi : P.crimson1);
    }
  }
}

function drawPillar(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const h = p.tall ?? 40;
  shadow(ctx, x, y, 18);
  px(ctx, x - 7, y - h, 14, h, P.stone2);
  px(ctx, x - 7, y - h, 3, h, P.stone3);
  px(ctx, x + 4, y - h, 3, h, P.stone1);
  px(ctx, x - 9, y - h - 4, 18, 4, P.stone3);
  px(ctx, x - 9, y - 4, 18, 4, P.stone1);
  if (p.broken) {
    px(ctx, x - 9, y - h - 4, 6, 3, P.void);
    px(ctx, x + 2, y - h - 4, 7, 2, P.void);
  }
}

function drawTree(ctx, p, g) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 22, 0.35);
  px(ctx, x - 2, y - 22, 4, 22, P.wood);
  line(ctx, x, y - 16, x - 8, y - 26, P.wood, 2);
  line(ctx, x, y - 18, x + 7, y - 28, P.wood, 2);
  const sw = Math.round(Math.sin(g.time * 1.3 + p.x) * 1);
  for (let i = 0; i < 26; i++) {
    const a = hash2(i, p.id, 1) * Math.PI * 2;
    const r = hash2(p.id, i, 2) * 11;
    const lx = x + Math.cos(a) * r * 1.3 + sw;
    const ly = y - 32 + Math.sin(a) * r * 0.8;
    px(ctx, lx - 2, ly - 2, 4, 4, i % 3 === 0 ? P.leafHi : i % 3 === 1 ? P.leaf : P.amber1);
  }
}

function drawDeadTree(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 14, 0.35);
  px(ctx, x - 2, y - 24, 3, 24, P.ink);
  line(ctx, x, y - 14, x - 10, y - 26, P.ink, 2);
  line(ctx, x - 6, y - 20, x - 8, y - 32, P.ink);
  line(ctx, x, y - 18, x + 9, y - 30, P.ink, 2);
  line(ctx, x + 5, y - 24, x + 12, y - 26, P.ink);
  px(ctx, x - 10, y - 27, 1, 1, P.crimson);
}

function drawBanner(ctx, p, g) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  px(ctx, x - 1, y - 40, 2, 40, P.ink);
  px(ctx, x - 1, y - 41, 14, 2, P.ink);
  for (let i = 0; i < 24; i++) {
    const w = Math.round(Math.sin(g.time * 3 + i * 0.3) * 1);
    px(ctx, x + 1 + w, y - 39 + i, 11, 1, P.blueLo);
  }
  for (let i = 0; i < 11; i += 2) px(ctx, x + 1 + i, y - 15 + ((i * 3) % 4), 1, 2, P.blueLo);
  ring(ctx, x + 6, y - 30, 3, P.amber);
  px(ctx, x + 6, y - 35, 1, 10, P.amber);
}

function drawGrave(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 12);
  px(ctx, x - 5, y - 14, 10, 14, P.stone2);
  px(ctx, x - 4, y - 16, 8, 2, P.stone2);
  px(ctx, x - 5, y - 14, 1, 14, P.stone3);
  px(ctx, x - 1, y - 12, 2, 6, P.stone0);
  px(ctx, x - 3, y - 10, 6, 1, P.stone0);
}

function drawRubble(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  px(ctx, x - 8, y - 4, 7, 4, P.stone2);
  px(ctx, x - 1, y - 6, 6, 6, P.stone1);
  px(ctx, x + 4, y - 3, 5, 3, P.stone3);
  px(ctx, x - 8, y - 4, 7, 1, P.stone3);
}

function drawCandles(ctx, p, g) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (let i = 0; i < 3; i++) {
    const cx = x - 4 + i * 4;
    const h = 4 + ((i * 3) % 4);
    px(ctx, cx, y - h, 2, h, P.milk);
    const f = Math.floor(g.time * 8 + i) % 2;
    px(ctx, cx, y - h - 2 - f, 2, 2, P.amberHi);
  }
}

function drawGlyph(ctx, p, g) {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const active = p.active;
  const c = p.phase === PAST ? 'rgba(224,160,64,' : 'rgba(200,40,74,';
  const a = active ? 0.9 : 0.35 + Math.sin(g.time * 3) * 0.1;
  ring(ctx, cx, cy, p.w / 2, `${c}${a})`, 0.55);
  ring(ctx, cx, cy, p.w / 2 - 4, `${c}${a * 0.6})`, 0.55, 2);
  disc(ctx, cx, cy, 2, `${c}${a})`);
}

function drawStove(ctx, p, g) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 30);
  px(ctx, x - 14, y - 26, 28, 26, P.stone1);
  px(ctx, x - 14, y - 26, 28, 2, P.stone3);
  px(ctx, x - 8, y - 16, 16, 12, P.void);
  for (let i = 0; i < 6; i++) {
    const h = 3 + ((Math.sin(g.time * 7 + i) + 1) * 2) | 0;
    px(ctx, x - 6 + i * 2, y - 5 - h, 2, h, i % 2 ? P.amber : P.amberHi);
  }
  px(ctx, x - 4, y - 40, 8, 14, P.stone0);
}

function drawTable(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 34);
  px(ctx, x - 16, y - 14, 32, 6, P.woodHi);
  px(ctx, x - 16, y - 14, 32, 1, P.amber0);
  px(ctx, x - 14, y - 8, 2, 8, P.wood);
  px(ctx, x + 12, y - 8, 2, 8, P.wood);
  // карта вылазок
  px(ctx, x - 8, y - 15, 12, 4, P.milk);
  px(ctx, x - 6, y - 14, 3, 1, P.crimson);
  px(ctx, x - 1, y - 13, 4, 1, P.amber0);
}

function drawWindowProp(ctx, p, g) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  px(ctx, x - 10, y - 14, 20, 14, P.ink);
  px(ctx, x - 9, y - 13, 18, 12, p.bell ? P.slate : P.night);
  disc(ctx, x + 4, y - 9, 2, P.milk);
  if (p.bell && Math.floor(g.time) % 9 === 0) px(ctx, x - 5, y - 6, 3, 3, P.amber);
  px(ctx, x - 1, y - 13, 1, 12, P.ink);
}

function drawPortraits(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const n = p.count ?? 4;
  for (let i = 0; i < 5; i++) {
    const fx = x - 22 + i * 10;
    px(ctx, fx, y - 12, 8, 10, P.brass);
    px(ctx, fx + 1, y - 11, 6, 8, i < n ? P.slate : P.void);
    if (i < n) px(ctx, fx + 3, y - 9, 2, 3, P.ash3);
  }
}

function drawShelf(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  px(ctx, x - 14, y - 4, 28, 2, P.wood);
  for (let i = 0; i < (p.cups ?? 3); i++) {
    px(ctx, x - 12 + i * 6, y - 8, 4, 4, i % 2 ? P.milk : P.amber1);
    px(ctx, x - 8 + i * 6, y - 7, 1, 2, P.milk);
  }
}

function drawBox(ctx, p) {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  shadow(ctx, x, y, 14);
  px(ctx, x - 6, y - 10, 12, 10, P.wood);
  px(ctx, x - 6, y - 10, 12, 1, P.woodHi);
  line(ctx, x - 6, y - 10, x + 5, y - 1, P.ink);
  px(ctx, x - 3, y - 12, 6, 2, P.milk); // обрывки
}

// ── кэш в атласе ─────────────────────────────────────────────────────────
// Клетка (w×h) с точкой основания (ax, ay); fps/frames — цикл анимации декора;
// inst — чем различаются экземпляры одного вида.
const C = (w, h, ax, ay, fps = 0, frames = 1, inst = null) => ({ w, h, ax, ay, fps, frames, inst });
const figureKey = (p) => `${p.drawFn?.name}|${p.id % 7}|${JSON.stringify(p.drawOpts || {})}`;
const CACHE = {
  sign: C(100, 48, 50, 37, 9, 8),
  memoryStone: C(110, 56, 55, 30, 6, 6),
  lantern: C(16, 42, 8, 40, 12, 5),
  campfire: C(20, 22, 10, 18, 9, 6),
  statue: C(26, 46, 13, 44, 2, 4),
  chest: C(22, 20, 11, 18, 6, 4, (p) => `${p.open}`),
  pillar: C(22, 64, 11, 56, 0, 1, (p) => `${p.tall ?? 40}|${p.broken ? 1 : 0}`),
  tree: C(48, 62, 24, 58, 2, 4, (p) => p.id),
  deadTree: C(30, 38, 15, 35),
  banner: C(18, 46, 3, 44, 6, 6),
  grave: C(14, 20, 7, 18),
  roadLamp: C(14, 46, 7, 44, 6, 3, (p) => (p.erased ? 'e' : '')),
  gateTower: C(26, 96, 13, 92, 4, 4),
  rubble: C(22, 12, 11, 9, 0, 1, (p) => p.id % 4),
  candles: C(14, 12, 7, 10, 8, 2),
  stove: C(32, 44, 16, 42, 7, 6),
  table: C(36, 18, 18, 16),
  window: C(22, 16, 11, 15, 1, 9, (p) => (p.bell ? 1 : 0)),
  portraits: C(52, 14, 24, 13, 0, 1, (p) => p.count),
  shelf: C(30, 10, 15, 8, 0, 1, (p) => p.cups),
  box: C(16, 16, 8, 14),
  npc: C(28, 40, 14, 36, 6, 6, figureKey),
  ghostNpc: C(28, 40, 14, 36, 6, 6, figureKey),
};
for (const k of Object.keys(CACHE)) PROP_KINDS[k].cache = CACHE[k];

// 32-битные маляры объектов (src/art/props32.js); при hd.on — вместо 16-битных
const HD = {
  sign: drawSignHd, memoryStone: drawMemoryStoneHd, lantern: drawLanternHd, campfire: drawCampfireHd,
  chest: drawChestHd, pillar: drawPillarHd, rubble: drawRubbleHd, candles: drawCandlesHd, stove: drawStoveHd,
  table: drawTableHd, window: drawWindowHd, portraits: drawPortraitsHd, shelf: drawShelfHd, box: drawBoxHd,
};
for (const k of Object.keys(HD)) PROP_KINDS[k].drawHd = HD[k];

// NPC и фигуры-воспоминания: 16-битный маляр → 32-битный
const FIGURE_HD = new Map([[drawTik, drawTik32], [drawMara, drawMara32], [drawDog, drawDog32], [drawGhost, drawGhost32], [drawBrassBoy, drawBrassBoy32]]);
export const registerFigureHd = (fn, hdFn) => FIGURE_HD.set(fn, hdFn);
const figureHd = (ctx, p, g) => (FIGURE_HD.get(p.drawFn) || p.drawFn)(ctx, p.x, p.y, { t: g.time + (p.id % 7), ...(p.drawOpts || {}) });
PROP_KINDS.npc.drawHd = figureHd;
PROP_KINDS.ghostNpc.drawHd = figureHd;
PROP_KINDS.ghostNpc.crisp = { keepAlpha: true };
PROP_KINDS.statue.drawHd = (ctx, p, g) => drawBrassBoy32(ctx, p.x, p.y, { phase: p.tl.phase, t: g.time });
