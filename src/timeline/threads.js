// Нити причин (docs/TIME_DESIGN.md, П3): причина → следствие. Пока причина в своей фазе
// (обычно — в прошлом), следствие тоже переходит в прошлое; цепочки идут каскадом.
// Следствие само по себе не сдвигается — менять надо причину. Модуль чистый.
import { PAST } from './timeline.js';

// Связать: cause → effect. when — фаза причины, в которой нить «тянет»; to — фаза следствия;
// need — что ещё должно быть в прошлом, чтобы причина работала (котёл кипит, если горит костёр).
export function link(cause, effect, { when = PAST, to = PAST, keepSwitch = false, need = [] } = {}) {
  (effect.causes ||= []).push({ cause, when, need });
  effect.threadTo = to;
  if (!keepSwitch) effect.tl.switchable = false;
  return effect;
}

const needMet = (c) => (c.need || []).every((n) => n.tl.phase === PAST);
export const threadPulls = (c) => !c.cause.removed && c.cause.tl.phase === c.when && needMet(c);

// Привести следствия в соответствие с причинами. Возвращает изменившиеся объекты.
export function resolveThreads(props, maxPasses = 8) {
  const changed = new Set();
  for (let pass = 0; pass < maxPasses; pass++) {
    let any = false;
    for (const p of props) {
      if (!p.causes?.length) continue;
      const on = p.causes.some(threadPulls);
      const want = on ? p.threadTo : p.tl.base;
      if (p.tl.phase === want) continue;
      p.tl.phase = want;
      p.tl.left = want === p.tl.base ? 0 : Infinity;
      changed.add(p);
      any = true;
    }
    if (!any) break;
  }
  return [...changed];
}

// Все нити для отрисовки: { from, to, on }.
export function threadList(props) {
  const out = [];
  for (const p of props) {
    for (const c of p.causes || []) {
      out.push({ from: c.cause, to: p, on: threadPulls(c) });
      // условие рисуется нитью к причине
      for (const n of c.need || []) out.push({ from: n, to: c.cause, on: n.tl.phase === PAST, need: true });
    }
  }
  return out;
}

// Нити, связанные с объектом (вся цепочка вверх и вниз) — их подсвечиваем при прицеле.
export function chainOf(props, obj) {
  const all = threadList(props);
  const seen = new Set([obj]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of all) {
      if (seen.has(t.from) !== seen.has(t.to)) {
        seen.add(t.from);
        seen.add(t.to);
        grew = true;
      }
    }
  }
  return all.filter((t) => seen.has(t.from) && seen.has(t.to));
}
