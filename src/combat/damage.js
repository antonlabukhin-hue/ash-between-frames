// Расчёт урона — чистые функции.

export const BALANCE = {
  heroHp: 100,
  baseHit: 12,
  perfectHit: 18,
  finisherMul: 1.25, // третий удар серии
  critMul: 2,
  dodgeIframes: 0.25,
  charges: 3,
};

// hit: {perfect, step, crit}; mods цели: {dmgMul, comboMul, shield}
export function heroHitDamage(hit, target = {}) {
  let d = hit.perfect ? BALANCE.perfectHit : BALANCE.baseHit;
  if (hit.step === 3) d *= BALANCE.finisherMul;
  if (hit.crit) d *= BALANCE.critMul;
  d *= target.dmgMul ?? 1;
  if (hit.perfect) d *= target.comboMul ?? 1;
  if (target.shield) d *= 1 - target.shield;
  if (hit.bonus) d += hit.bonus;
  return Math.max(1, Math.round(d));
}

// Урон по герою с учётом неуязвимости.
export function applyHeroDamage(hero, amount, { iframes = 0 } = {}) {
  if (hero.invuln > 0 || hero.hp <= 0) return 0;
  const dealt = Math.min(hero.hp, Math.round(amount));
  hero.hp -= dealt;
  hero.invuln = iframes;
  return dealt;
}
