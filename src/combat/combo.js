// Ритм ударов: Удар → Связка → Разлом.
// После каждого взмаха на оружии вспыхивает окно точности. Нажатие в окне —
// точный удар. Нажатия вне окна тоже работают (новичок просто жмёт кнопку),
// но цепочка точности сбрасывается.

export const COMBO = {
  swing: 0.3, // длительность взмаха
  activeFrom: 0.04, // удар наносит урон в этом промежутке
  activeTo: 0.16,
  windowStart: 0.26, // окно точности после начала взмаха
  windowEnd: 0.46,
  chainEnd: 0.8, // после этого серия начинается заново
};

export function createCombo() {
  return { step: 0, perfectChain: 0, t: 99, buffered: null, swinging: false };
}

export const inPerfectWindow = (c) => c.step > 0 && c.t >= COMBO.windowStart && c.t <= COMBO.windowEnd;

function startSwing(c, perfect, chained) {
  c.step = chained ? (c.step % 3) + 1 : 1;
  c.perfectChain = chained && perfect ? c.perfectChain + 1 : 0;
  c.t = 0;
  c.swinging = true;
  let effect = null;
  if (c.perfectChain === 2) effect = 'school';
  if (c.perfectChain >= 3) {
    effect = 'rift';
    c.perfectChain = 0;
  }
  return { step: c.step, perfect: chained && perfect, effect };
}

// Нажатие атаки. Возвращает начатый удар или null, если нажатие запомнено.
export function pressAttack(c) {
  if (c.swinging && c.t < COMBO.swing) {
    c.buffered = { perfect: c.t >= COMBO.windowStart };
    return null;
  }
  const chained = c.step > 0 && c.t < COMBO.chainEnd;
  const perfect = chained && c.t >= COMBO.windowStart && c.t <= COMBO.windowEnd;
  return startSwing(c, perfect, chained);
}

// Возвращает удар, если сработало запомненное нажатие.
export function tickCombo(c, dt) {
  c.t += dt;
  if (c.swinging && c.t >= COMBO.swing) {
    c.swinging = false;
    if (c.buffered) {
      const b = c.buffered;
      c.buffered = null;
      return startSwing(c, b.perfect, true);
    }
  }
  if (!c.swinging && c.t > COMBO.chainEnd) {
    c.step = 0;
    c.perfectChain = 0;
  }
  return null;
}

export const isActiveFrame = (c) => c.swinging && c.t >= COMBO.activeFrom && c.t <= COMBO.activeTo;

export function resetCombo(c) {
  c.step = 0;
  c.perfectChain = 0;
  c.buffered = null;
  c.swinging = false;
  c.t = 99;
}
