// Профили качества Low / Medium / High. Читаемость боя одинакова во всех профилях:
// телеграфы, контуры, полоски здоровья и подсказки не зависят от профиля.
// 32-битная атмосфера: bloom — цветные ореолы огней, reflect — 0 нет / 1 огни в лужах /
// 2 ещё и персонажи, rain — лимит струй дождя, fog — туман, vignette — затемнение углов.

export const PROFILES = {
  low: {
    id: 'low', name: 'Низкое',
    particles: 80, particleMul: 0.45, ambient: 0,
    lights: 4, lightRings: 2, parallax: 1,
    shadows: 'flat', decorAnim: false, extraDecor: false, glitch: false,
    bloom: false, reflect: 0, rain: 50, fog: false, vignette: true,
  },
  medium: {
    id: 'medium', name: 'Среднее',
    particles: 200, particleMul: 1, ambient: 20,
    lights: 8, lightRings: 3, parallax: 2,
    shadows: 'stepped', decorAnim: true, extraDecor: false, glitch: true,
    bloom: true, reflect: 1, rain: 110, fog: true, vignette: true,
  },
  high: {
    id: 'high', name: 'Высокое',
    particles: 360, particleMul: 1.35, ambient: 45,
    lights: 14, lightRings: 4, parallax: 3,
    shadows: 'stepped', decorAnim: true, extraDecor: true, glitch: true,
    bloom: true, reflect: 2, rain: 180, fog: true, vignette: true,
  },
};

export const ORDER = ['low', 'medium', 'high'];

// Авто: телефоны и слабые машины — Medium, остальное — High.
export function detectProfile(env = {}) {
  const cores = env.cores ?? 4;
  const touch = !!env.touch;
  const mem = env.memory ?? 4;
  if (cores <= 2 || mem <= 2) return 'low';
  if (touch || cores <= 4) return 'medium';
  return 'high';
}

export function resolveProfile(setting, env) {
  const id = setting === 'auto' || !PROFILES[setting] ? detectProfile(env) : setting;
  return PROFILES[id];
}

// Понижение профиля в режиме «Авто», если кадр долго тяжёлый.
export function createAutoTuner({ limitMs = 20, holdS = 3 } = {}) {
  return { limitMs, holdS, slow: 0, cooldown: 0 };
}

// Возвращает id нового профиля или null.
export function tuneStep(tuner, current, avgMs, dt) {
  if (tuner.cooldown > 0) {
    tuner.cooldown -= dt;
    return null;
  }
  tuner.slow = avgMs > tuner.limitMs ? tuner.slow + dt : 0;
  if (tuner.slow < tuner.holdS) return null;
  tuner.slow = 0;
  tuner.cooldown = 6;
  const i = ORDER.indexOf(current);
  return i > 0 ? ORDER[i - 1] : null;
}
