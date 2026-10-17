// Снаряды тоже имеют два состояния. В Шраме (базовом) летят в героя.
// Переведённые в Отпечаток — возвращаются к тому, кто их выпустил:
// нота летит назад, звуковое кольцо сжимается к источнику.
import { createTimeline, PAST } from '../timeline/timeline.js';
import { dist, norm } from '../core/math.js';
import { isWall } from '../world/world.js';
import { burst, ringFx } from '../world/fx.js';
import { P } from '../art/palette.js';

export function spawnNote(g, owner, x, y, vx, vy, o = {}) {
  const pr = {
    kind: 'note', x, y, vx, vy, r: 3, dmg: o.dmg ?? 6, owner, life: o.life ?? 3.2, frozen: 0, light: 18,
    backDmg: o.backDmg ?? 24,
    tl: createTimeline({ hold: Infinity, cost: o.cost ?? 1, switchTime: 0 }),
  };
  g.projectiles.push(pr);
  return pr;
}

export function spawnRing(g, owner, x, y, o = {}) {
  const pr = {
    kind: 'ring', x, y, rad: 6, speed: o.speed ?? 70, max: o.max ?? 120, width: o.width ?? 6, dmg: o.dmg ?? 12,
    owner, hitHero: false, life: 99, frozen: 0, backDmg: o.backDmg ?? 40,
    tl: createTimeline({ hold: Infinity, cost: o.cost ?? 1, switchTime: 0 }),
  };
  g.projectiles.push(pr);
  return pr;
}

// Точка на кольце ближе всего к герою — сюда наводится сдвиг.
export function projectileAnchor(pr, hx, hy) {
  if (pr.kind !== 'ring') return [pr.x, pr.y];
  const [nx, ny] = norm(hx - pr.x, hy - pr.y);
  return [pr.x + nx * pr.rad, pr.y + ny * pr.rad * 0.6];
}

function hitOwner(g, pr) {
  const o = pr.owner;
  if (!o || o.dead) return;
  if (o.onReflect) o.onReflect(g, pr);
  else g.damageEnemy(o, pr.backDmg, { reflected: true });
}

export function updateProjectiles(g, dt) {
  const hero = g.player;
  for (const pr of g.projectiles) {
    if (pr.frozen > 0) {
      pr.frozen -= dt;
      continue;
    }
    const back = pr.tl.phase === PAST;
    if (pr.kind === 'note') {
      pr.life -= dt;
      if (back && pr.owner && !pr.owner.dead) {
        const [nx, ny] = norm(pr.owner.x - pr.x, pr.owner.y - (pr.owner.hitY ?? 8) - pr.y);
        pr.vx = nx * 170;
        pr.vy = ny * 170;
        if (dist(pr.x, pr.y, pr.owner.x, pr.owner.y - (pr.owner.hitY ?? 8)) < (pr.owner.r ?? 6) + 6) {
          hitOwner(g, pr);
          burst(g, pr.x, pr.y, [P.amberHi, P.amber], 8, 50);
          pr.life = 0;
        }
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (isWall(g, pr.x, pr.y)) {
        burst(g, pr.x, pr.y, [P.ash3, P.crimson], 4, 30);
        pr.life = 0;
      }
      if (!back && hero && !hero.dead && dist(pr.x, pr.y, hero.x, hero.y - 8) < pr.r + 5) {
        if (g.hurtPlayer(pr.dmg, pr.x, pr.y, 'note') === 'hit') pr.life = 0;
      }
    } else if (pr.kind === 'ring') {
      if (back) {
        pr.rad -= pr.speed * 1.5 * dt;
        if (pr.rad <= 6) {
          const o = pr.owner;
          if (o && !o.dead && dist(o.x, o.y, pr.x, pr.y) < 40) hitOwner(g, pr);
          ringFx(g, pr.x, pr.y, 2, 30, P.amberHi, 0.4);
          pr.life = 0;
        }
      } else {
        pr.rad += pr.speed * dt;
        if (pr.rad >= pr.max) pr.life = 0;
        if (hero && !hero.dead && !pr.hitHero) {
          // эллипс 3/4: вертикаль сжата
          const d = Math.hypot(hero.x - pr.x, (hero.y - 4 - pr.y) / 0.6);
          if (Math.abs(d - pr.rad) < pr.width / 2 + 3) {
            if (g.hurtPlayer(pr.dmg, pr.x, pr.y, 'ring')) pr.hitHero = true;
          }
        }
      }
    }
  }
  g.projectiles = g.projectiles.filter((pr) => pr.life > 0);
}
