// Пул квадратных пиксельных частиц фиксированного размера.
// Структура массивов, удаление обменом с последним — без мусора для сборщика.

export function createParticlePool(cap) {
  return {
    cap, n: 0,
    x: new Float32Array(cap), y: new Float32Array(cap),
    vx: new Float32Array(cap), vy: new Float32Array(cap),
    life: new Float32Array(cap), max: new Float32Array(cap),
    grav: new Float32Array(cap), drag: new Float32Array(cap),
    size: new Uint8Array(cap), color: new Array(cap).fill('#fff'),
    dropped: 0,
  };
}

// Сменить ёмкость (смена профиля качества) — лишние частицы отбрасываются.
export function resizePool(pool, cap) {
  if (cap === pool.cap) return pool;
  const p = createParticlePool(cap);
  const n = Math.min(pool.n, cap);
  for (let i = 0; i < n; i++) copy(pool, i, p, i);
  p.n = n;
  return p;
}

function copy(a, i, b, j) {
  b.x[j] = a.x[i];
  b.y[j] = a.y[i];
  b.vx[j] = a.vx[i];
  b.vy[j] = a.vy[i];
  b.life[j] = a.life[i];
  b.max[j] = a.max[i];
  b.grav[j] = a.grav[i];
  b.drag[j] = a.drag[i];
  b.size[j] = a.size[i];
  b.color[j] = a.color[i];
}

export function spawnParticle(pool, x, y, vx, vy, life, color, size = 1, grav = 0, drag = 0.88) {
  if (pool.n >= pool.cap) {
    pool.dropped++;
    return false;
  }
  const i = pool.n++;
  pool.x[i] = x;
  pool.y[i] = y;
  pool.vx[i] = vx;
  pool.vy[i] = vy;
  pool.life[i] = life;
  pool.max[i] = life;
  pool.grav[i] = grav;
  pool.drag[i] = drag;
  pool.size[i] = size;
  pool.color[i] = color;
  return true;
}

export function updateParticles(pool, dt) {
  let i = 0;
  while (i < pool.n) {
    pool.life[i] -= dt;
    if (pool.life[i] <= 0) {
      const last = --pool.n;
      if (i !== last) copy(pool, last, pool, i);
      continue;
    }
    const k = Math.pow(pool.drag[i], dt * 60);
    pool.vx[i] *= k;
    pool.vy[i] = pool.vy[i] * k + pool.grav[i] * dt;
    pool.x[i] += pool.vx[i] * dt;
    pool.y[i] += pool.vy[i] * dt;
    i++;
  }
}

export function clearParticles(pool) {
  pool.n = 0;
}
