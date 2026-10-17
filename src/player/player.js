// Рен, Последний Смотритель.
import { createCombo, pressAttack, tickCombo, isActiveFrame, inPerfectWindow, resetCombo } from '../combat/combo.js';
import { heroHitDamage, BALANCE } from '../combat/damage.js';
import { createCharges, tickCharges, spend, canSpend, hasten } from '../timeline/charges.js';
import { shiftTimeline, shiftCost, channelTime, createChannel, tickChannel, isShifted, PAST } from '../timeline/timeline.js';
import { moveBox } from '../world/room.js';
import { heroBlocked, isPit } from '../world/world.js';
import { enemyMods, isPhased, stats } from '../enemies/enemies.js';
import { projectileAnchor } from '../combat/projectiles.js';
import { burst, ringFx, slashFx, addText, boltFx } from '../world/fx.js';
import { dist, norm, angleDiff, clamp } from '../core/math.js';
import { propCenter } from '../world/props.js';
import { P } from '../art/palette.js';

const SPEED = 74;
const DODGE_TIME = 0.2;
const DODGE_SPEED = 205;
const DODGE_CD = 0.42;
const SHIFT_RANGE = 96;

export function createPlayer(x, y, save) {
  const maxHp = BALANCE.heroHp + (save.upgrades.hp || 0) * 20;
  return {
    x, y, r: 4, hp: maxHp, maxHp, invuln: 0, dead: false,
    aim: Math.PI / 2, dir: 'down', flip: false, walk: 0, sway: 0, moving: false,
    combo: createCombo(), swing: null, hitSet: new Set(),
    charges: createCharges(BALANCE.charges + (save.upgrades.charges || 0), 10),
    dodge: 0, dodgeCd: 0, dodgeDir: [0, 1], dodgeFresh: false,
    channel: null, echo: 0, rift: 0, critNext: false,
    shiftTarget: null, lastSafe: { x, y }, falling: 0, kx: 0, ky: 0,
    history: [], hurtFlash: 0, doubleOutline: 0, quietFrame: 0,
  };
}

export function resetPlayerCombat(p) {
  resetCombo(p.combo);
  p.swing = null;
  p.channel = null;
  p.dodge = 0;
  p.echo = 0;
}

function aimAngle(g, p) {
  const inp = g.input;
  if (inp.mouseAims()) {
    const wx = inp.mouse.x + g.cam.x;
    const wy = inp.mouse.y + g.cam.y;
    return Math.atan2(wy - (p.y - 8), wx - p.x);
  }
  if (inp.aimDir) return Math.atan2(inp.aimDir[1], inp.aimDir[0]);
  // автонаведение на ближайшего врага
  if (g.save.settings.autoAim) {
    let best = null;
    let bd = 80;
    for (const e of g.enemies) {
      if (e.dead || e.spawn > 0) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return Math.atan2(best.y - p.y, best.x - p.x);
  }
  if (inp.move.x || inp.move.y) return Math.atan2(inp.move.y, inp.move.x);
  return p.aim;
}

// Цель для смены состояния: ближайший переключаемый объект с учётом прицела.
export function pickShiftTarget(g, p) {
  let best = null;
  let bestScore = Infinity;
  const consider = (obj, x, y, type, range = SHIFT_RANGE) => {
    if (!obj.tl?.switchable) return;
    const d = dist(p.x, p.y - 6, x, y);
    if (d > range) return;
    const a = Math.atan2(y - (p.y - 6), x - p.x);
    const off = Math.abs(angleDiff(p.aim, a));
    const score = d + off * 26 + (type === 'prop' ? 6 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { obj, type, x, y };
    }
  };
  for (const e of g.enemies) if (!e.dead && e.spawn <= 0) consider(e, e.x, e.y - e.hitY, 'enemy');
  for (const pr of g.projectiles) {
    const [ax, ay] = projectileAnchor(pr, p.x, p.y);
    consider(pr, ax, ay, 'projectile', 80);
  }
  for (const pr of g.props) {
    if (pr.hidden || (pr.canTarget && !pr.canTarget(g))) continue;
    const [cx, cy] = propCenter(pr);
    consider(pr, cx, cy, 'prop', pr.def.flat ? SHIFT_RANGE + Math.max(pr.w, pr.h) / 2 : SHIFT_RANGE);
  }
  if (g.bossTargets) for (const t of g.bossTargets(g)) consider(t.obj, t.x, t.y, t.type);
  return best;
}

export function applyShift(g, target, { free = false } = {}) {
  const p = g.player;
  const obj = target.obj;
  const cost = free ? 0 : shiftCost(obj.tl, { free: p.echo > 0 || g.freeShift });
  if (!spend(p.charges, cost)) return false;
  if (p.echo > 0 && cost === 0 && !isShifted(obj.tl)) p.echo = 0;
  const phase = shiftTimeline(obj.tl);
  g.audio.sfx.shift(phase);
  const c = phase === PAST ? P.amberHi : P.crimsonHi;
  ringFx(g, target.x, target.y, 2, 22, c, 0.35);
  burst(g, target.x, target.y, phase === PAST ? [P.amber, P.amberHi, P.milk] : [P.crimson, P.crimsonHi, P.ink], 12, 50);
  p.doubleOutline = 0.12;
  g.flags._shifts = (g.flags._shifts || 0) + 1;
  // «Обратный жар»: смена состояния поджигает врага
  if (target.type === 'enemy' && g.hasFragment('backHeat')) {
    obj.burn = 3;
    obj.burnTick = 0.2;
  }
  obj.onShift?.(g, obj, phase);
  g.room.def.onShift?.(g, obj, phase, target.type);
  g.vibrate(15);
  return true;
}

function startSwing(g, p, hit) {
  p.swing = { ...hit, t: 0, aim: p.aim };
  p.hitSet.clear();
  g.audio.sfx.swing(hit.step);
  if (p.critNext) {
    p.swing.crit = true;
    p.critNext = false;
  }
  const span = hit.step === 3 ? Math.PI * 1.7 : 2.2;
  slashFx(g, p.x, p.y - 8, p.aim, span, 20, hit.perfect ? P.amberHi : P.milk, 0.16);
  // небольшой шаг вперёд
  p.kx += Math.cos(p.aim) * 40;
  p.ky += Math.sin(p.aim) * 30;
  if (hit.effect === 'rift') microRift(g, p.x + Math.cos(p.aim) * 18, p.y - 8 + Math.sin(p.aim) * 12);
}

// Третий точный удар — микроразлом: враги рядом бесплатно меняют состояние.
function microRift(g, x, y) {
  g.audio.sfx.rift();
  ringFx(g, x, y, 2, 30, P.milk, 0.45);
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0 || !e.tl.switchable) continue;
    if (dist(e.x, e.y - 8, x, y) < 30) applyShift(g, { obj: e, x: e.x, y: e.y - 8, type: 'enemy' }, { free: true });
  }
  g.player.rift = Math.min(1, g.player.rift + 0.34);
  addText(g, x, y - 10, 'РАЗЛОМ', P.milk, { big: true, life: 0.9 });
}

// Импульсный разлом (пробел): всё вокруг меняет состояние, враги отлетают.
export function riftPulse(g, p) {
  p.rift = 0;
  g.audio.sfx.rift();
  g.shake(4, 0.3);
  g.hitstop(0.08);
  ringFx(g, p.x, p.y - 6, 4, 70, P.milk, 0.5);
  ringFx(g, p.x, p.y - 6, 2, 50, P.amberHi, 0.4);
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    if (d > 64) continue;
    const [nx, ny] = norm(e.x - p.x, e.y - p.y);
    e.kx += nx * 260;
    e.ky += ny * 200;
    e.stun = Math.max(e.stun, 0.5);
    if (e.tl.switchable) applyShift(g, { obj: e, x: e.x, y: e.y - 8, type: 'enemy' }, { free: true });
  }
  for (const pr of g.projectiles) {
    const [ax, ay] = projectileAnchor(pr, p.x, p.y);
    if (dist(ax, ay, p.x, p.y) < 64 && pr.tl.switchable && !isShifted(pr.tl)) applyShift(g, { obj: pr, x: ax, y: ay, type: 'projectile' }, { free: true });
  }
  for (const pr of g.props) {
    if (!pr.tl.switchable || pr.hidden || pr.noRift) continue;
    const [cx, cy] = propCenter(pr);
    if (dist(cx, cy, p.x, p.y) < 64) applyShift(g, { obj: pr, x: cx, y: cy, type: 'prop' }, { free: true });
  }
  g.vibrate([20, 30, 40]);
}

function attackHits(g, p) {
  const sw = p.swing;
  const span = sw.step === 3 ? Math.PI * 2 : 2.4;
  const reach = sw.step === 3 ? 24 : 23;
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0 || p.hitSet.has(e)) continue;
    const ex = e.x;
    const ey = e.y - e.hitY * 0.6;
    const d = dist(p.x, p.y - 6, ex, ey);
    if (d > reach + e.r) continue;
    const a = Math.atan2(ey - (p.y - 6), ex - p.x);
    if (Math.abs(angleDiff(sw.aim, a)) > span / 2 && d > e.r + 4) continue;
    p.hitSet.add(e);
    const mods = enemyMods(g, e);
    const dmg = heroHitDamage(sw, mods);
    const [nx, ny] = norm(ex - p.x, ey - p.y);
    const res = g.damageEnemy(e, dmg, { kx: nx * (sw.step === 3 ? 180 : 110), ky: ny * 90, perfect: sw.perfect });
    if (res < 0) continue;
    g.audio.sfx.hit(sw.perfect);
    g.hitstop(sw.perfect ? 0.07 : 0.035);
    g.shake(sw.perfect ? 2 : 1, 0.1);
    burst(g, ex, ey, sw.perfect ? [P.amberHi, P.milk] : [P.milk, P.ash4], 6, 70);
    if (mods.shield > 0.5 && !g.flags._shieldHint) {
      g.flags._shieldHint = true;
      g.hint('Удары почти не проходят. Переведи её звуковую волну в прошлое (Q у волны) — пусть звон вернётся к ней.', 6);
    }
    if (sw.perfect) {
      hasten(p.charges, 2);
      p.rift = Math.min(1, p.rift + 0.12);
    }
    // Окно Эха: следующая атака бесплатно меняет состояние врага
    if (p.echo > 0 && e.tl.switchable) {
      p.echo = 0;
      applyShift(g, { obj: e, x: ex, y: ey, type: 'enemy' }, { free: true });
    }
    // Школа Искры: вторая точность — огненная цепь к соседям
    if (sw.effect === 'school') {
      let jumps = 2;
      let from = e;
      for (const o of g.enemies) {
        if (jumps <= 0) break;
        if (o === e || o.dead || o.spawn > 0) continue;
        if (dist(o.x, o.y, from.x, from.y) < 48) {
          boltFx(g, from.x, from.y - 8, o.x, o.y - 8, P.amberHi);
          g.damageEnemy(o, 7, { pure: true });
          from = o;
          jumps--;
        }
      }
      ringFx(g, ex, ey, 2, 14, P.amber, 0.25);
    }
  }
}

export function hurtPlayer(g, amount, sx, sy, kind) {
  const p = g.player;
  if (p.dead || g.cinematic) return null;
  if (p.dodge > 0) {
    // идеальное уклонение: атака пришла в первые кадры рывка
    if (p.dodgeFresh) {
      p.dodgeFresh = false;
      p.echo = 2.2;
      p.rift = Math.min(1, p.rift + 0.25);
      g.audio.sfx.perfectDodge();
      g.slowmo(0.25);
      addText(g, p.x, p.y - 26, 'ЭХО', P.tealHi, { big: true });
      ringFx(g, p.x, p.y - 8, 4, 20, P.tealHi, 0.3);
      g.vibrate(25);
      if (g.save.upgrades.quickSeam) hasten(p.charges, 99);
      g.onPerfectDodge?.();
    }
    return 'dodged';
  }
  if (p.invuln > 0) return null;
  p.hp = Math.max(0, p.hp - amount);
  p.invuln = 0.7;
  p.hurtFlash = 0.18;
  const [nx, ny] = norm(p.x - sx, p.y - sy);
  p.kx += nx * 140;
  p.ky += ny * 110;
  if (p.channel) {
    p.channel = null;
    g.audio.sfx.cancel();
    addText(g, p.x, p.y - 26, 'сбит', P.ash4);
  }
  g.audio.sfx.hurt();
  g.shake(3, 0.2);
  g.hitstop(0.06);
  g.vibrate(40);
  burst(g, p.x, p.y - 8, [P.milk, P.blue, P.crimson], 10, 60);
  addText(g, p.x, p.y - 24, `-${Math.round(amount)}`, P.crimsonHi);
  g.flags._tookDamage = true;
  g.room?.def.onHeroHurt?.(g);
  if (p.hp <= 0) g.killPlayer();
  return 'hit';
}

export function updatePlayer(g, p, dt) {
  const inp = g.input;
  if (p.dead) return;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.doubleOutline = Math.max(0, p.doubleOutline - dt);
  p.echo = Math.max(0, p.echo - dt);
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  if (tickCharges(p.charges, dt)) g.audio.sfx.flash();

  // падение в пустоту
  if (p.falling > 0) {
    p.falling -= dt;
    if (p.falling <= 0) {
      p.x = p.lastSafe.x;
      p.y = p.lastSafe.y;
      p.invuln = 1;
      g.hurtFallen();
    }
    return;
  }

  const locked = g.cinematic || g.inputLocked;
  const mv = locked ? { x: 0, y: 0 } : inp.move;

  if (!locked) p.aim = aimAngle(g, p);

  // направление спрайта
  const face = p.swing || p.channel || g.input.mouseAims() || inp.aimDir ? p.aim : mv.x || mv.y ? Math.atan2(mv.y, mv.x) : null;
  if (face != null) {
    const c = Math.cos(face);
    const s = Math.sin(face);
    if (Math.abs(c) > 0.72) {
      p.dir = 'side';
      p.flip = c < 0;
    } else p.dir = s < 0 ? 'up' : 'down';
  }

  // ── уклонение ──
  if (!locked && inp.pressed('dodge') && p.dodgeCd <= 0 && p.dodge <= 0) {
    const [dx, dy] = mv.x || mv.y ? norm(mv.x, mv.y) : [Math.cos(p.aim), Math.sin(p.aim)];
    p.dodgeDir = [dx, dy];
    p.dodge = DODGE_TIME;
    p.dodgeFresh = true;
    p.dodgeCd = DODGE_CD;
    if (p.channel) {
      p.channel = null;
      g.audio.sfx.cancel();
    }
    p.swing = null;
    resetCombo(p.combo);
    g.audio.sfx.dodge();
    burst(g, p.x, p.y - 2, [P.ash3, P.ash2], 5, 30);
    if (g.hasFragment('firstStep')) p.critNext = true;
  }
  if (p.dodge > 0) {
    p.dodge -= dt;
    // идеальное окно — первые 0.12 с рывка; неуязвимость — 0.25 с
    if (p.dodge < DODGE_TIME - 0.13) p.dodgeFresh = false;
    if (p.dodge <= 0) p.invuln = Math.max(p.invuln, BALANCE.dodgeIframes - DODGE_TIME);
  }

  // ── атака ──
  const auto = g.save.settings.autoAttack && g.enemies.some((e) => !e.dead && e.spawn <= 0 && dist(e.x, e.y, p.x, p.y) < 30);
  if (!locked && p.dodge <= 0 && !p.channel && (inp.pressed('attack') || (auto && !p.swing && p.combo.t > 0.5))) {
    const hit = pressAttack(p.combo);
    if (hit) startSwing(g, p, hit);
  }
  const buffered = tickCombo(p.combo, dt);
  if (buffered && p.dodge <= 0) startSwing(g, p, buffered);
  if (p.swing) {
    p.swing.t += dt;
    if (isActiveFrame(p.combo)) attackHits(g, p);
    if (p.swing.t > 0.3) p.swing = null;
  }
  const glowNow = inPerfectWindow(p.combo);
  if (glowNow && !p.wasGlow) g.audio.sfx.flash();
  p.wasGlow = glowNow;

  // ── смена состояния ──
  p.shiftTarget = locked ? null : pickShiftTarget(g, p);
  if (!locked && inp.pressed('shift') && !p.channel) {
    const t = p.shiftTarget;
    if (!t) {
      g.hint('Рядом нечего сдвигать. Подойди к объекту с янтарным или малиновым контуром.', 2.5);
      g.audio.sfx.noCharge();
    } else {
      const free = p.echo > 0 || g.freeShift;
      const cost = shiftCost(t.obj.tl, { free });
      if (!canSpend(p.charges, cost)) {
        g.audio.sfx.noCharge();
        addText(g, p.x, p.y - 28, 'нет зарядов', P.ash4);
        g.hint('Заряды браслета копятся сами; точные удары и идеальные уклонения ускоряют их.', 3);
      } else {
        const ct = channelTime(t.obj.tl, { instant: free || t.type === 'projectile', speed: g.save.upgrades.quickSeam ? 0.75 : 1 });
        if (ct <= 0) applyShift(g, t);
        else {
          p.channel = createChannel(t, ct);
          g.audio.sfx.channel();
        }
      }
    }
  }
  if (p.channel) {
    const ch = p.channel;
    const o = ch.target.obj;
    if (o.dead || (ch.target.type === 'projectile' && o.life <= 0) || dist(p.x, p.y, ch.target.x, ch.target.y) > SHIFT_RANGE + 30) {
      p.channel = null;
      g.audio.sfx.cancel();
    } else {
      if (ch.target.type === 'enemy') {
        ch.target.x = o.x;
        ch.target.y = o.y - o.hitY;
      }
      if (tickChannel(ch, dt) === 'done') {
        p.channel = null;
        applyShift(g, ch.target);
      }
    }
  }

  // ── разлом ──
  if (!locked && inp.pressed('rift')) {
    if (p.rift >= 1) riftPulse(g, p);
    else {
      addText(g, p.x, p.y - 28, 'разлом не готов', P.ash4, { life: 0.6 });
    }
  }

  // ── взаимодействие ──
  if (!locked && (inp.pressed('interact') || inp.pressed('confirm'))) g.tryInteract();

  // ── движение ──
  let vx;
  let vy;
  if (p.dodge > 0) {
    vx = p.dodgeDir[0] * DODGE_SPEED;
    vy = p.dodgeDir[1] * DODGE_SPEED;
  } else {
    let sp = SPEED;
    if (p.channel) sp *= 0.45;
    if (p.swing) sp *= 0.35;
    vx = mv.x * sp;
    vy = mv.y * sp;
  }
  vx += p.kx;
  vy += p.ky;
  p.kx *= Math.pow(0.78, dt * 60);
  p.ky *= Math.pow(0.78, dt * 60);
  const r = moveBox(p.x, p.y, 4, 3, vx * dt, vy * dt, heroBlocked(g));
  p.x = clamp(r.x, 4, g.room.pxW - 4);
  p.y = clamp(r.y, 6, g.room.pxH - 2);
  p.moving = Math.hypot(mv.x, mv.y) > 0.1;
  if (p.moving) p.walk = (p.walk + dt * 2.6) % 1;
  p.sway += ((-mv.x * 2.5 - (p.dodge > 0 ? p.dodgeDir[0] * 3 : 0)) - p.sway) * Math.min(1, dt * 6);

  // история для Эха
  p.history.push({ x: p.x, y: p.y, aim: p.aim });
  if (p.history.length > 180) p.history.shift();

  // пустота: проверяем точку ног, но прощаем край
  if (isPit(g, p.x, p.y) && p.dodge <= 0) {
    p.falling = 0.5;
    p.channel = null;
    g.audio.sfx.fall();
    burst(g, p.x, p.y, [P.blue, P.ink, P.crimson], 10, 30);
  } else if (!isPit(g, p.x - 6, p.y) && !isPit(g, p.x + 6, p.y) && !isPit(g, p.x, p.y - 5) && !isPit(g, p.x, p.y + 5)) {
    p.lastSafe.x = p.x;
    p.lastSafe.y = p.y;
  }
}

export { stats, isPhased };
