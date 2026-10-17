// Брат Мел — звонарь, который звонит в колокол без башни.
// Фаза 1 «Неполный звон»: колокол бьёт волнами; его можно перевести в прошлое
//   (медленная большая волна) или оставить в настоящем (быстрая малая).
//   Любую волну, отправленную назад, колокол принимает обратно — Мела оглушает.
// Фаза 2 «Два брата»: Отпечаток и Шрам. Реален только тот, чья фаза сейчас у арены;
//   фазу арены меняют знаки на полу. Если долго бить одного — второй звереет.
// Фаза 3 «Колокол помнит»: снаряды зависают, их можно бесплатно вернуть в колокол.
import { createTimeline, setPhase, PAST, PRESENT, isShifted, tickTimeline } from '../timeline/timeline.js';
import { drawMel, drawGreatBell, ring, px, disc } from '../art/sprites.js';
import { P, PHASE_COLOR } from '../art/palette.js';
import { spawnRing, spawnNote } from '../combat/projectiles.js';
import { burst, ringFx, addText } from '../world/fx.js';
import { killEnemy, createEnemy } from './enemies.js';
import { moveBox } from '../world/room.js';
import { enemyBlocked } from '../world/world.js';
import { dist, norm } from '../core/math.js';
import { whiteK } from '../art/sprites.js';

export const MEL_HP = 1000;
export const PHASE_MARKS = [2 / 3, 1 / 3];

// Чистая функция: фаза по доле здоровья.
export function melPhaseFor(hp, max = MEL_HP) {
  const k = hp / max;
  if (k > PHASE_MARKS[0]) return 1;
  if (k > PHASE_MARKS[1]) return 2;
  return 3;
}

// Кто из братьев реален при данной фазе арены.
export const realBrother = (arenaPhase) => (arenaPhase === PAST ? 'imprint' : 'scar');

function makePart(g, boss, version, x, y) {
  const e = {
    id: 9000 + Math.floor(Math.random() * 1000), kind: 'mel', version, x, y, r: 12, hp: 1, maxHp: 1,
    def: { name: 'Брат Мел', elite: true, hitY: 34, colors: [P.milk, P.crimson1, P.brass, P.void], stats: { past: { dmgMul: 1.3, comboMul: 1 }, present: { dmgMul: 1, comboMul: 1 } } },
    tl: createTimeline({ hold: 5, cost: 1, switchTime: 0.7, switchable: version === 'whole' }),
    state: 'idle', st: 0, cd: 2, t: 0, flash: 0, kx: 0, ky: 0, stun: 0, spawn: 0, aggro: true, dead: false, hitY: 34, noPush: true,
  };
  e.redirect = (gg, part, amount, o) => damageMel(g, boss, part, amount, o);
  e.draw = (ctx, part, gg) => drawPart(ctx, boss, part, gg);
  e.ai = (gg, part, dt) => partAi(g, boss, part, dt);
  g.enemies.push(e);
  return e;
}

function isGhost(boss, part) {
  if (part.version === 'whole') return false;
  return realBrother(boss.arenaPhase) !== part.version;
}

function damageMel(g, boss, part, amount, o) {
  if (boss.dead || boss.cinematic) return 0;
  let dmg = amount;
  if (part.version === 'whole') {
    if (boss.phase === 3 && !(boss.exposed > 0) && !o.reflected) {
      addText(g, part.x, part.y - 50, '·', P.ash3, { life: 0.3 });
      return -1;
    }
    // в Шраме Мела держит звон: удары почти не проходят
    if (!o.reflected && part.tl.phase === PRESENT && !(boss.exposed > 0)) dmg *= 0.25;
    if (boss.exposed > 0 && boss.phase === 3) dmg *= 2;
  } else if (isGhost(boss, part)) {
    addText(g, part.x, part.y - 50, '·', P.ash3, { life: 0.3 });
    if (!g.flags._ghostHint) {
      g.flags._ghostHint = true;
      g.hint('Этот брат сейчас лишь отражение. Встань на знак на полу и нажми сдвиг — арена сменит версию.', 6);
    }
    return -1;
  } else {
    boss.hitStreak += dmg;
  }
  dmg = Math.max(1, Math.round(dmg));
  boss.hp = Math.max(0, boss.hp - dmg);
  part.flash = 0.1;
  addText(g, part.x + (Math.random() - 0.5) * 12, part.y - 56, dmg, o.perfect ? P.amberHi : o.reflected ? P.teal : P.milk, { big: true });
  return dmg;
}

function drawPart(ctx, boss, part, g) {
  const ghost = isGhost(boss, part);
  const enraged = ghost && boss.rage > 9;
  const o = { t: part.t, version: part.version === 'whole' ? undefined : part.version, windup: part.state === 'windup' };
  if (ghost && !enraged) ctx.globalAlpha = 0.3 + Math.sin(g.time * 6) * 0.08;
  if (enraged) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawMel(ctx, part.x + dx, part.y + dy, { ...o, k: () => P.crimsonHi });
  }
  if (part.version === 'whole' && isShifted(part.tl)) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawMel(ctx, part.x + dx, part.y + dy, { ...o, k: () => PHASE_COLOR[part.tl.phase] });
  }
  drawMel(ctx, part.x, part.y, { ...o, k: part.flash > 0 ? whiteK : undefined });
  ctx.globalAlpha = 1;
  if (boss.exposed > 0 && part.version === 'whole') {
    ring(ctx, part.x, part.y - 30, 18 + Math.sin(g.time * 10) * 2, P.milk, 0.5, 2);
  }
  if (part.state === 'dashAim') {
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 110; i += 6) px(ctx, part.x + Math.cos(part.lock) * i, part.y - 4 + Math.sin(part.lock) * i, 3, 1, P.crimsonHi);
    ctx.globalAlpha = 1;
  }
  if (part.state === 'stomp') ring(ctx, part.x, part.y - 2, 8 + (1 - part.st) * 20, 'rgba(236,228,207,0.5)', 0.6, 2);
}

function movePart(g, part, vx, vy, dt) {
  const r = moveBox(part.x, part.y, 8, 4, vx * dt, vy * dt, enemyBlocked(g, true));
  part.x = r.x;
  part.y = r.y;
}

function partAi(g, boss, part, dt) {
  if (boss.cinematic || boss.dead) return;
  part.st -= dt;
  part.cd -= dt;
  const h = g.player;
  const [nx, ny] = norm(h.x - part.x, h.y - part.y);
  const d = dist(part.x, part.y, h.x, h.y);
  if (part.version === 'whole') {
    if (boss.phase === 3) return;
    const slow = part.tl.phase === PAST ? 0.5 : 1;
    if (part.state === 'idle') {
      // парит у колокола, держит дистанцию
      const tx = boss.bell.x + Math.sin(part.t * 0.5) * 60;
      const ty = boss.bell.y + 78 + Math.cos(part.t * 0.4) * 10;
      const [mx, my] = norm(tx - part.x, ty - part.y);
      movePart(g, part, mx * 30 * slow, my * 30 * slow, dt);
      if (part.cd <= 0) {
        const seq = ['strike', 'chunks', 'strike', 'summon'];
        part.state = seq[boss.cycle++ % seq.length];
        part.st = part.state === 'strike' ? 0.9 / slow : 0.4;
        if (part.state === 'strike') g.audio.sfx.charge();
      }
      return;
    }
    if (part.state === 'strike' && part.st <= 0) {
      const past = boss.bell.tl.phase === PAST;
      spawnRing(g, boss.bell, boss.bell.x, boss.bell.y - 6, past ? { speed: 46, max: 230, dmg: 16, width: 9, backDmg: 50 } : { speed: 115, max: 130, dmg: 10, width: 6, backDmg: 50 });
      g.audio.sfx.bell(past ? 147 : 220);
      boss.bell.ringing = 1;
      g.shake(2, 0.3);
      part.state = 'idle';
      part.cd = 2.4 / slow;
    } else if (part.state === 'chunks' && part.st <= 0) {
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = i === 0 ? 0 : 22 + Math.random() * 26;
        boss.hazards.push({ x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * 0.7, r: 13, warn: 1 + i * 0.12, dmg: 12 });
      }
      part.state = 'idle';
      part.cd = 2 / slow;
    } else if (part.state === 'summon' && part.st <= 0) {
      const alive = g.enemies.filter((e) => e.kind === 'hollow').length;
      if (alive < 3) {
        for (const s of [-1, 1]) g.spawnWave([{ kind: 'hollow', x: boss.cx + s * 120, y: boss.cy + 30 }]);
      }
      part.state = 'idle';
      part.cd = 2.2;
    }
    return;
  }
  // братья
  const ghost = isGhost(boss, part);
  const enraged = ghost && boss.rage > 9;
  const active = !ghost || enraged;
  if (part.version === 'imprint') {
    // тяжёлый, предсказуемый: идёт и топает кольцами
    if (part.state === 'idle') {
      if (d > 50) movePart(g, part, nx * 18, ny * 18, dt);
      if (part.cd <= 0 && active) {
        part.state = 'stomp';
        part.st = 0.9;
        g.audio.sfx.charge();
      }
    } else if (part.state === 'stomp' && part.st <= 0) {
      spawnRing(g, part, part.x, part.y - 2, { speed: 70, max: 90, dmg: 12, width: 7, backDmg: 40 });
      g.audio.sfx.bell(110, true);
      g.shake(3, 0.25);
      part.state = 'idle';
      part.cd = enraged ? 2 : 3;
    }
  } else {
    // Шрам: быстрые рывки
    if (part.state === 'idle') {
      const side = Math.sin(part.t) > 0 ? 1 : -1;
      movePart(g, part, (nx * 0.5 - ny * side) * 50, (ny * 0.5 + nx * side) * 50, dt);
      if (part.cd <= 0 && active) {
        part.state = 'dashAim';
        part.st = 0.6;
        part.lock = Math.atan2(h.y - part.y, h.x - part.x);
      }
    } else if (part.state === 'dashAim') {
      part.lock = Math.atan2(h.y - part.y, h.x - part.x) * 0.2 + part.lock * 0.8;
      if (part.st <= 0) {
        part.state = 'dash';
        part.st = 0.4;
        part.hitDone = false;
        g.audio.sfx.dash();
      }
    } else if (part.state === 'dash') {
      movePart(g, part, Math.cos(part.lock) * 230, Math.sin(part.lock) * 230, dt);
      if (!part.hitDone && d < 16) {
        g.hurtPlayer(12, part.x, part.y, 'dash');
        part.hitDone = true;
      }
      if (part.st <= 0) {
        part.state = 'idle';
        part.cd = enraged ? 1.4 : 2.2;
      }
    }
  }
}

export function setupMel(g, cx, cy) {
  const boss = {
    hp: MEL_HP, max: MEL_HP, phase: 1, cycle: 0, cx, cy, hazards: [], arenaPhase: PRESENT, rage: 0, hitStreak: 0,
    volley: 0, volleyT: 0, exposed: 0, dead: false, cinematic: false, marks: PHASE_MARKS, parts: [],
  };
  const bell = {
    x: cx, y: cy - 92, r: 18, hitY: 16, dead: false, cracks: 0, ringing: 0,
    tl: createTimeline({ hold: 6, cost: 1, switchTime: 0.5 }),
  };
  bell.onReflect = (gg, pr) => {
    const dmg = pr.kind === 'note' ? 12 : 50;
    boss.hp = Math.max(0, boss.hp - dmg);
    bell.cracks++;
    bell.ringing = 1;
    g.audio.sfx.bell(pr.kind === 'note' ? 262 : 175, pr.kind === 'note');
    burst(g, bell.x, bell.y - 16, [P.brassHi, P.amber, P.milk], 14, 60);
    addText(g, bell.x, bell.y - 44, dmg, P.teal, { big: true });
    g.shake(3, 0.2);
    if (boss.phase === 1 && pr.kind === 'ring') {
      boss.exposed = 4;
      const whole = boss.parts.find((p) => p.version === 'whole');
      if (whole) whole.stun = 1.5;
      g.toast('Звон вернулся — Мел оглушён');
    }
  };
  boss.bell = bell;
  g.drawables.push({
    get y() {
      return bell.y;
    },
    kind: 'extra',
    draw: (ctx, gg) => {
      if (isShifted(bell.tl)) {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawGreatBell(ctx, bell.x + dx, bell.y + dy, { phase: bell.tl.phase, t: gg.time, k: () => PHASE_COLOR[bell.tl.phase] });
      }
      drawGreatBell(ctx, bell.x, bell.y + (boss.dead ? boss.fall : 0), { phase: bell.tl.phase, t: gg.time, ringing: bell.ringing > 0, cracks: Math.min(4, bell.cracks) });
    },
  });
  boss.parts.push(makePart(g, boss, 'whole', cx, cy - 20));
  // цели сдвига: колокол (фаза 1)
  g.bossTargets = () => (boss.phase === 1 && !boss.dead ? [{ obj: bell, x: bell.x, y: bell.y - 16, type: 'prop' }] : []);
  g.boss = boss;
  g.bossBar = boss;
  boss.update = (gg, dt) => updateBoss(g, boss, dt);
  return boss;
}

function enterPhase2(g, boss) {
  boss.phase = 2;
  boss.parts.forEach((p) => (p.dead = true));
  boss.parts = [];
  g.enemies = g.enemies.filter((e) => e.kind !== 'mel');
  const whole = { x: boss.cx, y: boss.cy - 10 };
  burst(g, whole.x, whole.y - 30, [P.milk, P.crimson, P.brass], 40, 80, { size: 2 });
  g.audio.sfx.bell(130);
  boss.parts.push(makePart(g, boss, 'imprint', boss.cx - 40, boss.cy));
  boss.parts.push(makePart(g, boss, 'scar', boss.cx + 40, boss.cy));
  boss.arenaPhase = PRESENT;
  boss.switchAt = g.time;
  g.glyphs?.forEach((gl) => {
    gl.hidden = false;
    gl.phase = PRESENT;
  });
  g.toast('Из колокола вышли два брата');
  g.hint('Отпечаток и Шрам. Реален только один — тот, чья версия сейчас у арены. Встань на знак и нажми сдвиг, чтобы сменить её.', 8);
}

async function enterPhase3(g, boss) {
  boss.phase = 3;
  boss.cinematic = true;
  boss.parts.forEach((p) => (p.dead = true));
  boss.parts = [];
  g.enemies.forEach((e) => {
    if (e.kind !== 'mel') killEnemy(g, e);
  });
  g.enemies = g.enemies.filter((e) => e.kind !== 'mel');
  g.projectiles = [];
  boss.hazards = [];
  g.glyphs?.forEach((gl) => (gl.hidden = true));
  const whole = makePart(g, boss, 'whole', boss.cx, boss.cy - 22);
  whole.tl.switchable = false;
  boss.parts.push(whole);
  g.audio.sfx.bell(98);
  await g.wait(0.8);
  await g.say([{ who: 'Брат Мел', text: 'Я звонил для них. Потом я звонил вместо них. Теперь я звоню, потому что иначе меня не будет.', portrait: 'mel', style: 'scar' }]);
  boss.cinematic = false;
  g.freeShift = true;
  boss.volley = 0;
  boss.volleyT = 1.2;
  g.hint('Снаряды замерли. Сдвиг по снаряду теперь бесплатный — верни звон в колокол.', 7);
}

function startVolley(g, boss) {
  const h = g.player;
  const n = 9 + boss.volley * 2;
  const r = 78;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = h.x + Math.cos(a) * r;
    const y = h.y - 8 + Math.sin(a) * r * 0.7;
    const [vx, vy] = norm(h.x - x, h.y - 8 - y);
    const pr = spawnNote(g, boss.bell, x, y, vx * 80, vy * 80, { dmg: 8, cost: 0, life: 6 });
    pr.frozen = 2.4;
  }
  g.audio.sfx.ring();
  boss.volleyLive = true;
}

async function finishBoss(g, boss) {
  boss.dead = true;
  boss.cinematic = true;
  g.freeShift = false;
  g.projectiles = [];
  boss.hazards = [];
  g.bossBar = null;
  g.ui.setBoss(null);
  g.enemies.forEach((e) => {
    if (e.kind !== 'mel') killEnemy(g, e);
  });
  const mel = boss.parts[0];
  boss.fall = 0;
  g.audio.sfx.death();
  g.vibrate([80, 60, 160]);
  g.shake(5, 1.2);
  for (let i = 0; i < 6; i++) {
    burst(g, mel.x + (Math.random() - 0.5) * 30, mel.y - 30 - Math.random() * 30, [P.milk, P.crimson, P.brassHi, P.void], 20, 70, { size: 2, life: 1.2 });
    await g.wait(0.25);
  }
  boss.parts.forEach((p) => (p.dead = true));
  g.enemies = [];
  for (let i = 0; i < 20; i++) g.spawnPickup('ash', boss.cx + (Math.random() - 0.5) * 60, boss.cy + (Math.random() - 0.5) * 30);
  for (let i = 0; i < 3; i++) g.spawnPickup('shard', boss.cx + (Math.random() - 0.5) * 40, boss.cy);
  boss.onDefeat?.(g);
}

function updateBoss(g, boss, dt) {
  const bell = boss.bell;
  // камера держит в кадре и героя, и босса
  const focus = boss.parts[0] || bell;
  g.camFocus = { x: g.player.x * 0.6 + focus.x * 0.4, y: g.player.y * 0.55 + (focus.y - 60) * 0.45 };
  tickTimeline(bell.tl, dt);
  bell.ringing = Math.max(0, bell.ringing - dt);
  if (boss.dead) {
    boss.fall = Math.min(60, (boss.fall ?? 0) + dt * 40);
    return;
  }
  if (boss.exposed > 0) boss.exposed -= dt;
  // опасные зоны: падающие куски площади
  for (const z of boss.hazards) {
    z.warn -= dt;
    if (z.warn <= 0 && !z.done) {
      z.done = true;
      burst(g, z.x, z.y, [P.stone2, P.stone3, P.ash2], 12, 60, { up: 40 });
      g.audio.sfx.hurt();
      if (dist(z.x, z.y, g.player.x, g.player.y) < z.r + 3) g.hurtPlayer(z.dmg, z.x, z.y, 'chunk');
    }
  }
  boss.hazards = boss.hazards.filter((z) => z.warn > -0.3);

  if (boss.phase === 1 && melPhaseFor(boss.hp) >= 2) enterPhase2(g, boss);
  else if (boss.phase === 2) {
    boss.rage = g.time - boss.switchAt;
    if (boss.rage > 9 && !boss.rageWarned) {
      boss.rageWarned = true;
      g.toast('Второй брат теряет терпение!');
    }
    if (melPhaseFor(boss.hp) >= 3) enterPhase3(g, boss);
  } else if (boss.phase === 3 && !boss.cinematic) {
    if (boss.exposed > 0) {
      if (boss.exposed <= dt) {
        boss.volley = 0;
        boss.volleyT = 1;
      }
    } else if (boss.volleyLive) {
      if (!g.projectiles.some((p) => p.kind === 'note')) {
        boss.volleyLive = false;
        boss.volley++;
        boss.volleyT = 1.2;
        if (boss.volley >= 3) {
          boss.exposed = 7;
          g.toast('Колокол треснул — Мел беззащитен!');
          g.audio.sfx.bell(110, true);
        }
      }
    } else {
      boss.volleyT -= dt;
      if (boss.volleyT <= 0) startVolley(g, boss);
    }
  }
  if (boss.hp <= 0) finishBoss(g, boss);
}

// Знак на полу во второй фазе: сдвиг меняет версию арены.
export function makeGlyphs(g, boss, spots) {
  g.glyphs = spots.map(([x, y]) => {
    const gl = g.addProp('glyph', x - 16, y - 12, { w: 32, h: 24, hidden: true, phase: PRESENT, timeline: { hold: Infinity, cost: 0, switchTime: 0 } });
    gl.canTarget = (gg) => dist(gg.player.x, gg.player.y, x, y) < 20 && g.boss?.phase === 2;
    gl.noRift = true;
    gl.onShift = () => {
      const b = g.boss;
      b.arenaPhase = b.arenaPhase === PAST ? PRESENT : PAST;
      b.switchAt = g.time;
      b.rageWarned = false;
      g.glyphs.forEach((o) => {
        o.phase = b.arenaPhase;
        o.tl.phase = o.tl.base;
      });
      setPhase(gl.tl, gl.tl.base);
      g.forceMusicPhase = b.arenaPhase;
      ringFx(g, x, y, 4, 60, PHASE_COLOR[b.arenaPhase], 0.5);
      g.toast(b.arenaPhase === PAST ? 'Арена в Отпечатке — реален тяжёлый брат' : 'Арена в Шраме — реален быстрый брат', 1.8);
    };
    return gl;
  });
}

export function drawHazards(g, ctx) {
  const boss = g.boss;
  if (!boss) return;
  for (const z of boss.hazards) {
    if (z.warn > 0) {
      const k = 1 - Math.min(1, z.warn);
      ring(ctx, z.x, z.y, z.r, Math.floor(g.time * 12) % 2 ? P.crimsonHi : P.crimson, 0.7, 2);
      disc(ctx, z.x, z.y - (1 - k) * 60, 3, P.stone3);
      ring(ctx, z.x, z.y, z.r * k, 'rgba(200,40,74,0.5)', 0.7);
    }
  }
}

export { createEnemy };
