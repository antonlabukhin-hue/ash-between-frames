// Враги. Каждый — TimelineEnemy: параметры для Отпечатка (past) и Шрама (present).
import { createTimeline, tickTimeline, PAST, PRESENT } from '../timeline/timeline.js';
import { inIslands, auraDamageMul } from '../world/memory.js';
import { moveBox } from '../world/room.js';
import { enemyBlocked, revealedAt } from '../world/world.js';
import { burst, addText, ringFx } from '../world/fx.js';
import { dist, norm, clamp, angleDiff } from '../core/math.js';
import { spawnNote, spawnRing } from '../combat/projectiles.js';
import { lineOfSight } from '../world/room.js';
import { P } from '../art/palette.js';
import { W, H } from '../core/renderer.js';

export const ENEMY_DEFS = {
  hollow: {
    name: 'Пустокожий',
    hp: 35, r: 5, ash: 3,
    timeline: { hold: 6, cost: 1, switchTime: 0.7 },
    stats: {
      // Отпечаток: медленный и уязвимый; Шрам: быстрый, но комбо бьёт сильнее
      past: { speed: 20, dmgMul: 1.35, comboMul: 1, windup: 0.75, dmg: 8 },
      present: { speed: 44, dmgMul: 1, comboMul: 1.5, windup: 0.42, dmg: 10 },
    },
    colors: [P.ash3, P.ash2, P.crimson],
  },
  framer: {
    name: 'Кадровик',
    hp: 22, r: 4, ash: 2, hitY: 18,
    timeline: { hold: 7, cost: 1, switchTime: 0.7 },
    stats: {
      past: { speed: 34, dmgMul: 1, comboMul: 1, phased: false, windup: 0.45, dmg: 5 },
      present: { speed: 60, dmgMul: 1, comboMul: 1, phased: true, windup: 0.3, dmg: 6 },
    },
    colors: [P.crimson1, P.milk, P.crimson],
  },
  ringer: {
    name: 'Звонарь',
    hp: 28, r: 5, ash: 3,
    timeline: { hold: 6, cost: 1, switchTime: 0.7 },
    stats: {
      // Отпечаток заряжает медленный мощный звон, Шрам стреляет быстро нотами
      past: { speed: 22, dmgMul: 1.15, comboMul: 1, mode: 'charge', cd: 3.4 },
      present: { speed: 34, dmgMul: 1, comboMul: 1, mode: 'rapid', cd: 1.7 },
    },
    colors: [P.ash4, P.brass, P.crimson],
  },
  shadow: {
    name: 'Звонкая Тень',
    hp: 300, r: 7, ash: 25, shards: 2, elite: true, hitY: 18,
    timeline: { hold: 6, cost: 1, switchTime: 0.7 },
    stats: {
      past: { speed: 22, dmgMul: 1, comboMul: 1, tempo: 1.6 },
      present: { speed: 52, dmgMul: 1, comboMul: 1, tempo: 1 },
    },
    colors: [P.ink, P.milk, P.brass, P.crimson],
  },
  eater: {
    name: 'Пожиратель Сцен',
    hp: 160, r: 9, ash: 12, shards: 1, elite: true, hitY: 12,
    timeline: { hold: 6, cost: 1, switchTime: 0.7 },
    stats: {
      // Шрам: откусывает куски арены и плохо пробивается; Отпечаток: возвращает всё и мягок
      past: { speed: 12, dmgMul: 1.5, comboMul: 1 },
      present: { speed: 30, dmgMul: 0.6, comboMul: 1 },
    },
    colors: [P.slate, P.crimson, P.void, P.amber],
  },
  echo: {
    name: 'Эхо',
    hp: 1, r: 4, ash: 0,
    timeline: { hold: 6, cost: 1, switchable: false },
    stats: { past: { speed: 0, dmgMul: 1, comboMul: 1 }, present: { speed: 0, dmgMul: 1, comboMul: 1 } },
    colors: [P.crimson, P.blue, P.crimsonHi],
  },
};

let nextId = 1;
export function createEnemy(kind, x, y, o = {}) {
  const def = ENEMY_DEFS[kind];
  const e = {
    id: nextId++, kind, def, x, y, r: def.r, hp: o.hp ?? def.hp, maxHp: o.hp ?? def.hp,
    tl: createTimeline({ ...def.timeline, base: o.base ?? PRESENT }),
    state: 'idle', st: 0, cd: 0.6 + Math.random() * 0.6, face: Math.PI / 2, walk: 0,
    flash: 0, burn: 0, burnTick: 0, kx: 0, ky: 0, stun: 0, spawn: o.spawn ?? 0.6, t: Math.random() * 10,
    aggro: o.aggro ?? true, dead: false, hitY: def.hitY ?? 9, ...o.extra,
  };
  return e;
}

export const stats = (e) => e.def.stats[e.tl.phase];

// Модификаторы урона по цели.
export function enemyMods(g, e) {
  const s = stats(e);
  const m = { dmgMul: s.dmgMul ?? 1, comboMul: s.comboMul ?? 1, shield: 0 };
  if (e.kind === 'shadow' && !(e.exposed > 0)) m.shield = 0.85;
  if (e.shield) m.shield = Math.max(m.shield, e.shield);
  return m;
}

// Кадровик в Шраме проходит сквозь удары, кроме каждого третьего кадра или в свете.
export function isPhased(g, e) {
  if (e.kind !== 'framer') return false;
  if (!stats(e).phased) return false;
  if (revealedAt(g, e.x, e.y)) return false;
  return Math.floor(e.t / 0.12) % 3 !== 0;
}

export function killEnemy(g, e) {
  if (e.dead) return;
  e.dead = true;
  // крупные квадраты разрушения и мелкая пыль
  burst(g, e.x, e.y - 8, e.def.colors, e.def.elite ? 24 : 8, e.def.elite ? 80 : 50, { size: 3, life: 0.9, grav: 60 });
  burst(g, e.x, e.y - 8, e.def.colors, e.def.elite ? 20 : 8, e.def.elite ? 100 : 70, { size: 1, life: 0.6 });
  g.audio.sfx.enemyDie();
  g.save.stats.kills++;
  const ash = e.def.ash ?? 0;
  for (let i = 0; i < ash; i++) g.spawnPickup('ash', e.x + (Math.random() - 0.5) * 10, e.y + (Math.random() - 0.5) * 6);
  for (let i = 0; i < (e.def.shards ?? 0); i++) g.spawnPickup('shard', e.x + (Math.random() - 0.5) * 14, e.y);
  // крошки хлеба Мары — редкое лечение
  if (!e.def.elite && e.kind !== 'echo' && Math.random() < 0.12) g.spawnPickup('heal', e.x, e.y, { amount: 15 });
  if (e.bites) for (const z of e.bites) z.t = 0;
  e.onDeath?.(g, e);
}

// Урон по врагу. Возвращает нанесённый урон, -1 — промах сквозь фазу.
export function damageEnemy(g, e, amount, o = {}) {
  if (e.dead || e.spawn > 0) return 0;
  if (e.redirect) return e.redirect(g, e, amount, o);
  if (!o.reflected && !o.pure && isPhased(g, e)) {
    addText(g, e.x, e.y - 18, '·', P.ash3, { life: 0.3 });
    return -1;
  }
  // остров памяти: Шрам слабеет, Отпечаток крепнет (П2)
  if (!o.pure && e.tl && g.memIslands?.length && inIslands(g.memIslands, e.x, e.y)) amount = Math.max(1, Math.round(amount * auraDamageMul(e.tl.phase)));
  e.hp -= amount;
  e.flash = 0.12;
  if (o.kx || o.ky) {
    const heavy = e.def.elite ? 0.25 : 1;
    e.kx += o.kx * heavy;
    e.ky += o.ky * heavy;
  }
  addText(g, e.x + (Math.random() - 0.5) * 6, e.y - (e.hitY + 10), Math.round(amount), o.perfect ? P.amberHi : o.reflected ? P.teal : P.milk, { big: o.perfect || o.reflected });
  if (o.reflected && e.kind === 'shadow') exposeShadow(g, e);
  if (e.hp <= 0) killEnemy(g, e);
  else if (!e.def.elite && (o.perfect || o.stagger)) e.stun = Math.max(e.stun, 0.25);
  return amount;
}

function exposeShadow(g, e) {
  e.exposed = 6;
  e.stun = 1.2;
  e.state = 'idle';
  g.audio.sfx.bell(330, true);
  g.toast('Звонкая Тень оглушена собственным звоном!');
  ringFx(g, e.x, e.y - 18, 4, 40, P.amberHi, 0.6);
}

function move(g, e, vx, vy, dt, flying = false) {
  const r = moveBox(e.x, e.y, e.r, 3, vx * dt, vy * dt, enemyBlocked(g, flying));
  e.x = r.x;
  e.y = r.y;
  if (vx || vy) e.walk = (e.walk + dt * 2.2) % 1;
  return r;
}

// Цель врага: герой или Эхо, если тень ближе (П4 — «отвлечь врага»).
const toHero = (g, e) => {
  const h = e.decoy || g.player;
  return { dx: h.x - e.x, dy: h.y - e.y, d: dist(e.x, e.y, h.x, h.y) };
};

// ── поведение ─────────────────────────────────────────────────────────
function aiHollow(g, e, dt) {
  const s = stats(e);
  const { dx, dy, d } = toHero(g, e);
  e.st -= dt;
  e.cd -= dt;
  if (e.state === 'idle' || e.state === 'chase') {
    e.state = 'chase';
    const [nx, ny] = norm(dx, dy);
    const wob = Math.sin(e.t * 2 + e.id) * 0.4;
    move(g, e, (nx - ny * wob) * s.speed, (ny + nx * wob) * s.speed, dt);
    e.face = Math.atan2(dy, dx);
    if (d < 24 && e.cd <= 0) {
      e.state = 'windup';
      e.st = s.windup;
      e.lock = Math.atan2(dy, dx);
    }
  } else if (e.state === 'windup') {
    if (e.st <= 0) {
      e.state = 'lunge';
      e.st = 0.16;
      e.hitDone = false;
    }
  } else if (e.state === 'lunge') {
    move(g, e, Math.cos(e.lock) * 150, Math.sin(e.lock) * 150, dt);
    if (!e.hitDone) {
      const hx = e.x + Math.cos(e.lock) * 8;
      const hy = e.y + Math.sin(e.lock) * 6;
      if (e.decoy && dist(hx, hy, e.decoy.x, e.decoy.y) < 11) {
        g.hitShade?.();
        e.hitDone = true;
      } else if (dist(hx, hy, g.player.x, g.player.y) < 11) {
        g.hurtPlayer(s.dmg, e.x, e.y, 'melee');
        e.hitDone = true;
      }
    }
    if (e.st <= 0) {
      e.state = 'recover';
      e.st = 0.55;
      e.cd = 0.5;
    }
  } else if (e.state === 'recover' && e.st <= 0) e.state = 'chase';
}

function aiFramer(g, e, dt) {
  const s = stats(e);
  const { dx, dy, d } = toHero(g, e);
  e.st -= dt;
  e.cd -= dt;
  e.look = clamp(Math.round(dx / 20), -1, 1);
  const lit = !s.phased || revealedAt(g, e.x, e.y);
  if (e.state === 'idle' || e.state === 'chase') {
    e.state = 'chase';
    const [nx, ny] = norm(dx, dy);
    const side = Math.sin(e.t * 1.3 + e.id) * 0.8;
    if (lit) move(g, e, (nx - ny * side) * s.speed, (ny + nx * side) * s.speed, dt);
    else {
      // рывки: перескакивает кадры
      e.jerk = (e.jerk ?? 0) - dt;
      if (e.jerk <= 0) {
        e.jerk = 0.18;
        move(g, e, (nx - ny * side) * s.speed * 0.18 * 5.5, (ny + nx * side) * s.speed * 0.18 * 5.5, 1 / 5.5);
      }
    }
    if (d < 16 && e.cd <= 0) {
      e.state = 'windup';
      e.st = s.windup;
    }
  } else if (e.state === 'windup' && e.st <= 0) {
    if (d < 18) g.hurtPlayer(s.dmg, e.x, e.y, 'melee');
    e.state = 'recover';
    e.st = 0.6;
    e.cd = 0.7;
  } else if (e.state === 'recover' && e.st <= 0) e.state = 'chase';
}

function aiRinger(g, e, dt) {
  const s = stats(e);
  const { dx, dy, d } = toHero(g, e);
  e.cd -= dt;
  e.st -= dt;
  const [nx, ny] = norm(dx, dy);
  e.face = Math.atan2(dy, dx);
  if (e.state === 'idle' || e.state === 'move') {
    e.state = 'move';
    let vx = 0;
    let vy = 0;
    if (d < 64) {
      vx = -nx;
      vy = -ny;
    } else if (d > 120) {
      vx = nx;
      vy = ny;
    } else {
      const side = Math.sin(e.t * 0.7 + e.id) > 0 ? 1 : -1;
      vx = -ny * side * 0.6;
      vy = nx * side * 0.6;
    }
    const r = move(g, e, vx * s.speed, vy * s.speed, dt);
    if (r.hitX || r.hitY) e.t += 1.3;
    if (e.cd <= 0 && d < 170 && lineOfSight(g.room, e.x, e.y - 8, g.player.x, g.player.y - 8)) {
      e.state = s.mode === 'charge' ? 'charge' : 'aim';
      e.st = s.mode === 'charge' ? 1.3 : 0.35;
      e.charge = s.mode === 'charge';
      if (e.charge) g.audio.sfx.charge();
    }
  } else if (e.state === 'aim' && e.st <= 0) {
    const base = Math.atan2(dy, dx);
    for (let i = -1; i <= 1; i++) {
      const a = base + i * 0.26;
      spawnNote(g, e, e.x, e.y - 9, Math.cos(a) * 95, Math.sin(a) * 95, { dmg: 6 });
    }
    g.audio.sfx.note();
    e.state = 'move';
    e.cd = s.cd;
  } else if (e.state === 'charge' && e.st <= 0) {
    spawnRing(g, e, e.x, e.y - 4, { speed: 62, max: 125, dmg: 14, width: 7 });
    g.audio.sfx.ring();
    e.charge = false;
    e.state = 'move';
    e.cd = s.cd;
  }
}

const SHADOW_ROTATION = ['dash', 'ring', 'erase', 'ring', 'dash', 'echo'];

function aiShadow(g, e, dt) {
  const s = stats(e);
  const { dx, dy, d } = toHero(g, e);
  const [nx, ny] = norm(dx, dy);
  e.st -= dt;
  e.cd -= dt / s.tempo;
  if (e.exposed > 0) e.exposed -= dt;
  e.face = Math.atan2(dy, dx);
  if (e.state === 'idle') {
    // держит дистанцию ~56
    const want = d > 70 ? 1 : d < 44 ? -1 : 0;
    const side = Math.sin(e.t * 0.5) > 0 ? 1 : -1;
    move(g, e, (nx * want - ny * side * 0.5) * s.speed, (ny * want + nx * side * 0.5) * s.speed, dt, true);
    if (e.cd <= 0) {
      e.rot = ((e.rot ?? -1) + 1) % SHADOW_ROTATION.length;
      const atk = SHADOW_ROTATION[e.rot];
      e.state = atk;
      e.st = (atk === 'dash' ? 0.75 : atk === 'ring' ? 0.8 : atk === 'erase' ? 0.5 : 0.6) * s.tempo;
      e.lock = Math.atan2(dy, dx);
      e.phaseStep = 0;
      if (atk === 'ring') g.audio.sfx.charge();
    }
    return;
  }
  if (e.state === 'dash') {
    if (e.phaseStep === 0) {
      e.lock = Math.atan2(g.player.y - e.y, g.player.x - e.x) * 0.3 + e.lock * 0.7;
      if (e.st <= 0) {
        e.phaseStep = 1;
        e.st = 0.36;
        e.hitDone = false;
        g.audio.sfx.dash();
      }
    } else {
      const sp = 240 / Math.sqrt(s.tempo);
      move(g, e, Math.cos(e.lock) * sp, Math.sin(e.lock) * sp, dt, true);
      if (!e.hitDone && dist(e.x, e.y, g.player.x, g.player.y) < 14) {
        g.hurtPlayer(14, e.x, e.y, 'dash');
        e.hitDone = true;
      }
      if (e.st <= 0) endShadowAttack(e, 1.1);
    }
  } else if (e.state === 'ring' && e.st <= 0) {
    spawnRing(g, e, e.x, e.y - 6, { speed: s.tempo > 1 ? 48 : 72, max: 160, dmg: 12, width: 7, backDmg: 45 });
    g.audio.sfx.ring();
    endShadowAttack(e, 1.4);
  } else if (e.state === 'erase' && e.st <= 0) {
    // удаляет маленькие участки арены вокруг героя
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : 26 + Math.random() * 14;
      g.voidZones.push({ x: g.player.x + Math.cos(a) * r, y: g.player.y + Math.sin(a) * r * 0.7, r: 14, warn: 1.0, t: 3.6, active: false });
    }
    g.audio.sfx.charge();
    endShadowAttack(e, 1.0);
  } else if (e.state === 'echo' && e.st <= 0) {
    const echo = createEnemy('echo', e.x, e.y, { spawn: 0.3, extra: { life: 5.5, delay: 0.9 } });
    g.enemies.push(echo);
    g.toast('Тень сняла с тебя копию');
    endShadowAttack(e, 1.0);
  }
}

function endShadowAttack(e, cd) {
  e.state = 'idle';
  e.cd = cd;
}

// Эхо повторяет путь героя с задержкой.
function aiEcho(g, e, dt) {
  e.life -= dt;
  const hist = g.player.history;
  const idx = Math.max(0, hist.length - 1 - Math.round(e.delay * 60));
  const target = hist[idx];
  if (target) {
    const [nx, ny] = norm(target.x - e.x, target.y - e.y);
    const d = dist(target.x, target.y, e.x, e.y);
    move(g, e, nx * Math.min(120, d * 8), ny * Math.min(120, d * 8), dt, true);
    e.face = target.aim;
  }
  if (dist(e.x, e.y, g.player.x, g.player.y) < 9) {
    g.hurtPlayer(8, e.x, e.y, 'echo');
    killEnemy(g, e);
  }
  if (e.life <= 0) killEnemy(g, e);
}

// Пожиратель Сцен: в Шраме откусывает арену, в Отпечатке возвращает откушенное.
function aiEater(g, e, dt) {
  const s = stats(e);
  const { dx, dy, d } = toHero(g, e);
  const [nx, ny] = norm(dx, dy);
  e.st -= dt;
  e.cd -= dt;
  e.face = Math.atan2(dy, dx);
  if (e.tl.phase === PAST && e.bites?.length) {
    for (const z of e.bites) {
      burst(g, z.x, z.y, [P.amber, P.amberHi, P.stone2], 10, 40);
      z.t = 0;
    }
    e.bites = [];
    g.toast('Пожиратель вернул откушенное');
  }
  if (e.state === 'idle' || e.state === 'move') {
    e.state = 'move';
    move(g, e, nx * s.speed, ny * s.speed, dt);
    if (d < 20 && e.cd <= 0) {
      e.state = 'windup';
      e.st = 0.6;
    } else if (e.tl.phase === PRESENT && (e.biteCd = (e.biteCd ?? 2) - dt) <= 0 && (e.bites?.length ?? 0) < 6) {
      e.biteCd = 3.4;
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2.4;
      const r = 30 + Math.random() * 30;
      const z = { x: g.player.x + Math.cos(a) * r, y: g.player.y + Math.sin(a) * r * 0.7, r: 17, warn: 1.1, t: Infinity, active: false, owner: e };
      g.voidZones.push(z);
      (e.bites ||= []).push(z);
      g.audio.sfx.charge();
      if (!g.flags._eaterHint) {
        g.flags._eaterHint = true;
        g.hint('Пожиратель Сцен откусывает арену. Верни его в прошлое — он отдаст всё назад и станет мягким.', 7);
      }
    }
  } else if (e.state === 'windup' && e.st <= 0) {
    if (d < 24) g.hurtPlayer(14, e.x, e.y, 'melee');
    burst(g, e.x + nx * 10, e.y + ny * 6, [P.crimson, P.void], 8, 50);
    e.state = 'move';
    e.cd = 1.4;
  }
}

const AI = { hollow: aiHollow, framer: aiFramer, ringer: aiRinger, shadow: aiShadow, echo: aiEcho, eater: aiEater };

export function updateEnemies(g, dt) {
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.t += dt;
    if (tickTimeline(e.tl, dt) === 'reverted') e.onRevert?.(g, e);
    if (e.flash > 0) e.flash -= dt;
    if (e.spawn > 0) {
      e.spawn -= dt;
      continue;
    }
    // горение от «Обратного жара»
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.5;
        damageEnemy(g, e, 3, { pure: true });
        burst(g, e.x, e.y - 10, [P.amber, P.amberHi], 3, 20, { up: 30 });
      }
    }
    // отброс
    if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
      move(g, e, e.kx, e.ky, dt, e.kind === 'shadow');
      e.kx *= Math.pow(0.82, dt * 60);
      e.ky *= Math.pow(0.82, dt * 60);
    }
    if (e.stun > 0) {
      e.stun -= dt;
      continue;
    }
    if (!e.aggro) {
      if (dist(e.x, e.y, g.player.x, g.player.y) < 120) e.aggro = true;
      else continue;
    }
    if (g.player.dead) continue;
    const sh = g.echoShade;
    e.decoy = sh && !sh.done && dist(e.x, e.y, sh.x, sh.y) < Math.min(110, dist(e.x, e.y, g.player.x, g.player.y)) ? sh : null;
    // дальние враги (за экраном от края кадра) думают раз в 4 кадра с накопленным временем
    const far = Math.abs(e.x - (g.cam.x + W / 2)) > W || Math.abs(e.y - (g.cam.y + H / 2)) > H;
    e.aiAcc = (e.aiAcc || 0) + dt;
    e.far = far;
    if (far && (g.frame + e.id) % 4 !== 0) continue;
    (e.ai || AI[e.kind])?.(g, e, e.aiAcc);
    e.aiAcc = 0;
  }
  // расталкивание
  const list = g.enemies.filter((e) => !e.dead && e.spawn <= 0 && !e.noPush);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const d = dist(a.x, a.y, b.x, b.y);
      const min = a.r + b.r + 2;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const [nx, ny] = norm(b.x - a.x, b.y - a.y);
        const blkA = enemyBlocked(g, a.kind === 'shadow');
        const blkB = enemyBlocked(g, b.kind === 'shadow');
        if (!blkA(a.x - nx * push, a.y - ny * push)) {
          a.x -= nx * push;
          a.y -= ny * push;
        }
        if (!blkB(b.x + nx * push, b.y + ny * push)) {
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
}

export const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export const inArc = (from, angle, target, span) => Math.abs(angleDiff(angle, Math.atan2(target.y - from.y, target.x - from.x))) <= span / 2;
export { PAST, PRESENT };
