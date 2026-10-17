// Система «Двойного отпечатка»: у объекта два состояния —
// Отпечаток (past, каким был) и Шрам (present, каким стал после Стирания).
// Сдвиг временный: через hold секунд объект возвращается к базовому состоянию.
// Модуль чистый: состояние передаётся параметром, никаких глобалов.

export const PAST = 'past';
export const PRESENT = 'present';

export const otherPhase = (p) => (p === PAST ? PRESENT : PAST);

export function createTimeline(o = {}) {
  const base = o.base ?? PRESENT;
  return {
    base,
    phase: base,
    hold: o.hold ?? 6, // сколько держится сдвиг; Infinity — переключатель
    switchTime: o.switchTime ?? 0.7, // время «импульса» у героя
    cost: o.cost ?? 1, // зарядов браслета за сдвиг
    switchable: o.switchable ?? true,
    left: 0,
    flash: 0, // вспышка смены состояния (1 → 0)
  };
}

export const isShifted = (tl) => tl.phase !== tl.base;

// Сдвинуть объект. Если уже сдвинут — вернуть досрочно (бесплатно).
export function shiftTimeline(tl, hold = tl.hold) {
  if (isShifted(tl)) {
    tl.phase = tl.base;
    tl.left = 0;
  } else {
    tl.phase = otherPhase(tl.base);
    tl.left = hold;
  }
  tl.flash = 1;
  return tl.phase;
}

// Принудительно поставить фазу (сюжет, зоны арены).
export function setPhase(tl, phase, hold = Infinity) {
  if (tl.phase === phase) return false;
  tl.phase = phase;
  tl.left = phase === tl.base ? 0 : hold;
  tl.flash = 1;
  return true;
}

// Возвращает 'reverted', когда сдвиг кончился.
export function tickTimeline(tl, dt) {
  if (tl.flash > 0) tl.flash = Math.max(0, tl.flash - dt * 3);
  if (isShifted(tl) && Number.isFinite(tl.left)) {
    tl.left -= dt;
    if (tl.left <= 0) {
      tl.phase = tl.base;
      tl.left = 0;
      tl.flash = 1;
      return 'reverted';
    }
  }
  return null;
}

// Скоро вернётся — объект начинает мигать.
export const isFading = (tl) => isShifted(tl) && Number.isFinite(tl.left) && tl.left < 1.5;

// Значение из таблицы {past, present} по текущей фазе.
export const byPhase = (tl, table) => table[tl.phase];

// Стоимость сдвига с учётом модификаторов (бесплатные сдвиги, «Окно Эха»).
export function shiftCost(tl, mods = {}) {
  if (isShifted(tl)) return 0; // вернуть назад — бесплатно
  if (mods.free) return 0;
  return Math.max(0, tl.cost - (mods.discount ?? 0));
}

// Время «импульса» — сокращается улучшениями, но не ниже 0.3 с (кроме мгновенных).
export function channelTime(tl, mods = {}) {
  if (mods.instant || isShifted(tl)) return 0;
  const t = tl.switchTime * (mods.speed ?? 1);
  return tl.switchTime <= 0 ? 0 : Math.max(0.3, t);
}

// Канал смены состояния: герой держит импульс, удар по нему сбивает канал.
export function createChannel(target, time) {
  return { target, time, t: 0 };
}

export function tickChannel(ch, dt) {
  ch.t += dt;
  return ch.t >= ch.time ? 'done' : null;
}

export const channelProgress = (ch) => (ch.time <= 0 ? 1 : Math.min(1, ch.t / ch.time));
