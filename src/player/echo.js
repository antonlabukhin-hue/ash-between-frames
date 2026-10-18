// Эхо (docs/TIME_DESIGN.md, П4): браслет записывает до ECHO_TIME секунд действий героя, затем
// тень Рена повторяет их в прошлом и замирает в последней позе ещё на ECHO_LINGER секунд —
// «держит вес». Эхо стоит на плитах прошлого, повторяет удары и сдвиги, отвлекает врагов,
// его можно сбить. Модуль чистый: позиции и события приходят снаружи.

export const ECHO_TIME = 5;
export const ECHO_LINGER = 4;
export const ECHO_HP = 3;
const STEP = 1 / 30; // частота записи позиции

export function createRecorder(x, y) {
  return { t: 0, acc: STEP, frames: [], events: [], start: { x, y } };
}

export const recordLeft = (rec) => Math.max(0, ECHO_TIME - rec.t);
export const recordFull = (rec) => rec.t >= ECHO_TIME;

// Кадр записи: pose = { x, y, dir, flip, aim }.
export function recordFrame(rec, dt, pose) {
  if (recordFull(rec)) return false;
  rec.t = Math.min(ECHO_TIME, rec.t + dt);
  rec.acc += dt;
  if (rec.acc >= STEP || recordFull(rec)) {
    rec.acc = 0;
    rec.frames.push({ t: rec.t, ...pose });
  }
  return true;
}

// Событие: { type: 'attack' | 'shift' | ..., ...данные }.
export function recordEvent(rec, ev) {
  if (!recordFull(rec)) rec.events.push({ t: rec.t, ...ev });
}

export function createShade(rec) {
  const f0 = rec.frames[0] || { ...rec.start, dir: 'down', flip: false, aim: 0 };
  return { rec, t: 0, ev: 0, hp: ECHO_HP, done: false, pose: { ...f0 }, x: f0.x, y: f0.y, linger: false };
}

// Поза в момент t — линейно между кадрами.
export function poseAt(rec, t) {
  const fr = rec.frames;
  if (!fr.length) return { ...rec.start, dir: 'down', flip: false, aim: 0 };
  if (t <= fr[0].t) return { ...fr[0] };
  for (let i = 1; i < fr.length; i++) {
    if (fr[i].t >= t) {
      const a = fr[i - 1];
      const b = fr[i];
      const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
      return { ...b, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return { ...fr[fr.length - 1] };
}

// Шаг тени. Возвращает события записи, наступившие за этот шаг.
export function stepShade(sh, dt) {
  if (sh.done) return [];
  sh.t += dt;
  const out = [];
  const evs = sh.rec.events;
  while (sh.ev < evs.length && evs[sh.ev].t <= sh.t) out.push(evs[sh.ev++]);
  sh.pose = poseAt(sh.rec, sh.t);
  sh.x = sh.pose.x;
  sh.y = sh.pose.y;
  sh.linger = sh.t > sh.rec.t;
  if (sh.t >= sh.rec.t + ECHO_LINGER) sh.done = true;
  return out;
}

// Удар по тени. true — тень рассыпалась.
export function hitShade(sh, n = 1) {
  if (sh.done) return false;
  sh.hp -= n;
  if (sh.hp <= 0) sh.done = true;
  return sh.done;
}

export const shadeFade = (sh) => (sh.linger ? Math.max(0, 1 - (sh.t - sh.rec.t) / ECHO_LINGER) : 1);
