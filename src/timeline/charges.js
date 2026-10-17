// Заряды браслета для смены состояния.
// Восстанавливаются медленно сами и быстрее — за точные удары и идеальные уклонения.

export function createCharges(max = 3, regen = 10) {
  return { max, n: max, regen, t: 0 };
}

export const canSpend = (c, cost) => c.n >= cost;

export function spend(c, cost) {
  if (c.n < cost) return false;
  c.n -= cost;
  return true;
}

export function gain(c, n = 1) {
  c.n = Math.min(c.max, c.n + n);
  if (c.n >= c.max) c.t = 0;
}

// Ускорить восстановление (секунд), например за точный удар.
export function hasten(c, seconds) {
  if (c.n >= c.max) return false;
  c.t += seconds;
  return tickCharges(c, 0);
}

// Возвращает true, когда восстановился заряд.
export function tickCharges(c, dt) {
  if (c.n >= c.max) {
    c.t = 0;
    return false;
  }
  c.t += dt;
  if (c.t >= c.regen) {
    c.t -= c.regen;
    c.n += 1;
    if (c.n >= c.max) c.t = 0;
    return true;
  }
  return false;
}

export const regenProgress = (c) => (c.n >= c.max ? 1 : c.t / c.regen);
