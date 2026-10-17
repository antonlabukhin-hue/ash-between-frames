// Активные способности трёх школ (клавиши 1, 2, 3). Открываются по ходу главы:
// Искра — после Разорванной дороги, Шов — после Площади, Тень — после Звонкой Тени.
import { P } from '../art/palette.js';
import { drawHero } from '../art/sprites.js';
import { px, line } from '../art/sprites.js';
import { isShifted } from '../timeline/timeline.js';
import { dist, norm } from '../core/math.js';
import { burst, ringFx, addText } from '../world/fx.js';

export const ABILITIES = [
  { id: 'spark', key: 'ab1', school: 'Школа Искры', name: 'Огненная цепь', desc: 'Рывок-разрез вперёд: режет и поджигает всех на пути.', cd: 6, color: P.amber, flag: 'abSpark' },
  { id: 'seam', key: 'ab2', school: 'Школа Шва', name: 'Шов-ловушка', desc: 'Шов на земле: враг, ступивший на него, проваливается в прошлое и замирает.', cd: 10, color: P.teal, flag: 'abSeam' },
  { id: 'shade', key: 'ab3', school: 'Школа Тени', name: 'Эхо Смотрителя', desc: 'Тень Рена четыре секунды рубит ближайших врагов.', cd: 14, color: P.blueHi, flag: 'abShade' },
];

export const createAbilityState = () => ({ cd: ABILITIES.map(() => 0) });

export const isUnlocked = (flags, i) => !!flags[ABILITIES[i].flag];

export function tickAbilities(st, dt) {
  for (let i = 0; i < st.cd.length; i++) st.cd[i] = Math.max(0, st.cd[i] - dt);
}

export const canUse = (st, flags, i) => isUnlocked(flags, i) && st.cd[i] <= 0;

export function markUsed(st, i) {
  st.cd[i] = ABILITIES[i].cd;
}

export const cooldownLeft = (st, i) => st.cd[i] / ABILITIES[i].cd;

// Открыть способность с карточкой.
export function unlockAbility(g, i) {
  const a = ABILITIES[i];
  if (g.flags[a.flag]) return;
  g.flags[a.flag] = true;
  g.ui.card(`Новая способность · ${a.school}`, `${a.name} — клавиша ${i + 1}`, a.desc, 4.5);
  g.audio.sfx.shard();
  g.persist();
}

// ── эффекты ───────────────────────────────────────────────────────────
export function castAbility(g, p, i) {
  const a = ABILITIES[i];
  if (a.id === 'spark') {
    p.dodge = 0.2;
    p.dodgeDir = [Math.cos(p.aim), Math.sin(p.aim)];
    p.dodgeFresh = false;
    p.spark = { t: 0.24, hit: new Set() };
    g.audio.sfx.dash();
    burst(g, p.x, p.y - 6, [P.amber, P.amberHi], 10, 60);
  } else if (a.id === 'seam') {
    const x = p.x + Math.cos(p.aim) * 26;
    const y = p.y + Math.sin(p.aim) * 18;
    const seam = g.addProp('ghostNpc', x, y, { drawFn: () => {}, noRift: true, life: 8, uses: 3 });
    seam.def = { ...seam.def, flat: true, draw: drawSeam };
    seam.x = x - 14;
    seam.y = y - 6;
    seam.w = 28;
    seam.h = 12;
    seam.update = updateSeam;
    g.audio.sfx.shift('past');
    ringFx(g, x, y, 2, 16, P.teal, 0.35);
  } else if (a.id === 'shade') {
    const s = g.addProp('ghostNpc', p.x - 10, p.y, { drawFn: drawShade, life: 4, swing: 0, aim: p.aim, noRift: true });
    s.update = updateShade;
    g.audio.sfx.shift('present');
    burst(g, s.x, s.y - 10, [P.blueHi, P.ink], 12, 40);
  }
  g.vibrate(15);
}

function drawSeam(ctx, p, g) {
  const a = Math.min(1, p.life / 1.5);
  ctx.globalAlpha = a;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  line(ctx, p.x, cy, p.x + p.w, cy, P.teal);
  for (let i = 2; i < p.w; i += 5) {
    const off = Math.round(Math.sin(g.time * 6 + i) * 1);
    line(ctx, p.x + i, cy - 3 + off, p.x + i + 2, cy + 3 + off, P.tealHi);
  }
  px(ctx, cx - 1, cy - 1, 3, 3, P.milk);
  ctx.globalAlpha = 1;
}

function updateSeam(g, p, dt) {
  p.life -= dt;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  for (const e of g.enemies) {
    if (p.uses <= 0) break;
    if (e.dead || e.spawn > 0 || e.seamed || e.def.elite) continue;
    if (dist(e.x, e.y, cx, cy) < 16) {
      e.seamed = true;
      p.uses--;
      if (e.tl.switchable && !isShifted(e.tl)) g.applyShiftFree(e);
      e.stun = Math.max(e.stun, 1.6);
      addText(g, e.x, e.y - 22, 'прошит', P.tealHi);
      ringFx(g, e.x, e.y - 6, 2, 14, P.teal, 0.3);
    }
  }
  if (p.life <= 0 || p.uses <= 0) p.removed = true;
}

function drawShade(ctx, x, y, o) {
  ctx.globalAlpha = 0.7;
  drawHero(ctx, x, y, { dir: 'down', t: o.t, aim: o.aim ?? 0, swing: o.swing > 0 ? 0.16 - o.swing : null, swingStep: 1, k: (c) => (c === P.void ? P.ink : P.blueLo), charges: 0 });
  ctx.globalAlpha = 1;
}

function updateShade(g, s, dt) {
  s.life -= dt;
  s.swing = Math.max(0, (s.swing || 0) - dt);
  s.cd = (s.cd || 0) - dt;
  let best = null;
  let bd = 120;
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0) continue;
    const d = dist(e.x, e.y, s.x, s.y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  if (best) {
    const [nx, ny] = norm(best.x - s.x, best.y - s.y);
    s.drawOpts = { aim: Math.atan2(ny, nx), swing: s.swing };
    if (bd > 14) {
      s.x += nx * 95 * dt;
      s.y += ny * 95 * dt;
    } else if (s.cd <= 0) {
      s.cd = 0.45;
      s.swing = 0.16;
      g.damageEnemy(best, 8, { kx: nx * 60, ky: ny * 50 });
      g.audio.sfx.hit(false);
    }
  }
  if (s.life <= 0) {
    burst(g, s.x, s.y - 10, [P.blueHi, P.ink], 10, 40);
    s.removed = true;
  }
}

// Удар «Огненной цепи» во время рывка.
export function updateSpark(g, p, dt) {
  if (!p.spark) return;
  p.spark.t -= dt;
  for (const e of g.enemies) {
    if (e.dead || e.spawn > 0 || p.spark.hit.has(e)) continue;
    if (dist(e.x, e.y - 6, p.x, p.y - 6) < 16 + e.r) {
      p.spark.hit.add(e);
      g.damageEnemy(e, 14, { pure: true, stagger: true });
      e.burn = Math.max(e.burn, 2.5);
      e.burnTick = 0.3;
      burst(g, e.x, e.y - 8, [P.amberHi, P.amber], 8, 60);
    }
  }
  if (Math.random() < 0.8) burst(g, p.x, p.y - 4, [P.amber, P.amberHi], 2, 20, { up: 20 });
  if (p.spark.t <= 0) p.spark = null;
}
